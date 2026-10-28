import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { json, requestId } from "@/lib/http";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import type {
  DashboardChartPoint,
  DashboardCustomer,
  DashboardNotification,
  DashboardPayment,
  DashboardPayload,
} from "@/lib/dashboard-types";

export const dynamic = "force-dynamic";

const pendingStatuses = ["OPEN", "PENDING", "PROCESSING"] as const;
const currency = "MZN";

function money(value: Prisma.Decimal | null | undefined) {
  return value?.toFixed(2) ?? "0.00";
}

function customerFields(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { name: null, email: null, phone: null };
  }

  const record = value as Prisma.JsonObject;
  const read = (...keys: string[]) => {
    for (const key of keys) {
      const field = record[key];
      if (typeof field === "string" && field.trim()) return field.trim();
    }
    return null;
  };

  return {
    name: read("name", "fullName", "full_name"),
    email: read("email"),
    phone: read("phone", "phoneNumber", "phone_number"),
  };
}

function monthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("pt-MZ", { month: "short" })
    .format(date)
    .replace(".", "");
}

function emptyChart(now: Date): DashboardChartPoint[] {
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + index, 1));
    return {
      month: monthKey(date),
      label: monthLabel(date),
      received: "0.00",
      transactions: 0,
    };
  });
}

export async function GET(req: Request) {
  const id = requestId(req);

  if (!getSupabaseConfig()) {
    return json({
      success: false,
      error: {
        code: "AUTH_NOT_CONFIGURED",
        message: "A autenticação ainda não está configurada.",
      },
    }, 503, id);
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return json({
        success: false,
        error: {
          code: "UNAUTHENTICATED",
          message: "Inicie sessão para consultar o dashboard.",
        },
      }, 401, id);
    }

    const links = await db.merchantUser.findMany({
      where: { userId: user.id },
      select: {
        merchant: {
          select: { id: true, name: true, status: true },
        },
      },
    });
    const workspaces = links
      .map(({ merchant }) => merchant)
      .filter((merchant, index, all) => all.findIndex((item) => item.id === merchant.id) === index);
    const merchantIds = workspaces.map(({ id: merchantId }) => merchantId);
    const now = new Date();

    const basePayload: DashboardPayload = {
      user: {
        email: user.email ?? "",
        name: typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : typeof user.user_metadata?.name === "string"
            ? user.user_metadata.name
            : null,
      },
      workspaces,
      summary: {
        availableBalance: "0.00",
        receivedTotal: "0.00",
        totalTransactions: 0,
        pendingAmount: "0.00",
        pendingTransactions: 0,
        completedTransactions: 0,
      },
      chart: emptyChart(now),
      transactions: [],
      customers: [],
      methods: [],
      notifications: [],
      updatedAt: now.toISOString(),
    };

    if (merchantIds.length === 0) {
      return json({ success: true, data: basePayload }, 200, id);
    }

    const merchantFilter = { merchantId: { in: merchantIds } };
    const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));

    const [
      wallets,
      totalTransactions,
      received,
      pending,
      completed,
      recentRows,
      methodRows,
      sessionRows,
      chartRows,
    ] = await Promise.all([
      db.wallet.aggregate({
        where: { ...merchantFilter, currency },
        _sum: { balance: true },
      }),
      db.payment.count({ where: merchantFilter }),
      db.payment.aggregate({
        where: { ...merchantFilter, currency, status: "COMPLETED" },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      db.payment.aggregate({
        where: { ...merchantFilter, currency, status: { in: [...pendingStatuses] } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      db.payment.count({
        where: { ...merchantFilter, currency, status: "COMPLETED" },
      }),
      db.payment.findMany({
        where: merchantFilter,
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          reference: true,
          status: true,
          amount: true,
          currency: true,
          provider: true,
          createdAt: true,
          session: { select: { customer: true } },
        },
      }),
      db.payment.groupBy({
        by: ["provider", "currency", "status"],
        where: merchantFilter,
        _count: { _all: true },
        _sum: { amount: true },
      }),
      db.checkoutSession.findMany({
        where: merchantFilter,
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          customer: true,
          createdAt: true,
        },
      }),
      db.$queryRaw<Array<{ month: Date; total: Prisma.Decimal; transactionCount: bigint }>>(Prisma.sql`
        SELECT date_trunc('month', "createdAt") AS month,
               COALESCE(SUM(amount), 0)::numeric(20, 4) AS total,
               COUNT(*)::bigint AS "transactionCount"
        FROM "Payment"
        WHERE "merchantId" IN (${Prisma.join(merchantIds)})
          AND "currency" = ${currency}
          AND "status" = 'COMPLETED'
          AND "createdAt" >= ${sixMonthsAgo}
        GROUP BY date_trunc('month', "createdAt")
        ORDER BY month ASC
      `),
    ]);

    const chartTotals = new Map(chartRows.map((row) => [
      monthKey(row.month),
      { received: row.total.toFixed(2), transactions: Number(row.transactionCount) },
    ]));
    const chart = emptyChart(now).map((point) => ({
      ...point,
      ...chartTotals.get(point.month),
    }));

    const transactions: DashboardPayment[] = recentRows.map((payment) => {
      const customer = customerFields(payment.session?.customer ?? null);
      return {
        id: payment.id,
        reference: payment.reference,
        status: payment.status,
        amount: payment.amount.toFixed(2),
        currency: payment.currency,
        provider: payment.provider,
        createdAt: payment.createdAt.toISOString(),
        customerName: customer.name,
        customerEmail: customer.email,
      };
    });

    const customerMap = new Map<string, DashboardCustomer>();
    for (const session of sessionRows) {
      const customer = customerFields(session.customer);
      if (!customer.name && !customer.email && !customer.phone) continue;
      const key = (customer.email ?? customer.phone ?? customer.name ?? session.id).toLocaleLowerCase();
      const current = customerMap.get(key);
      if (current) {
        current.transactionCount += 1;
        if (session.createdAt > new Date(current.lastPaymentAt)) {
          current.lastPaymentAt = session.createdAt.toISOString();
        }
      } else {
        customerMap.set(key, {
          id: key,
          ...customer,
          transactionCount: 1,
          lastPaymentAt: session.createdAt.toISOString(),
        });
      }
    }

    const methodMap = new Map<string, {
      provider: string;
      currency: string;
      transactions: number;
      completedTransactions: number;
      received: Prisma.Decimal;
    }>();
    for (const row of methodRows) {
      const provider = row.provider ?? "unknown";
      const key = `${provider}:${row.currency}`;
      const current = methodMap.get(key) ?? {
        provider,
        currency: row.currency,
        transactions: 0,
        completedTransactions: 0,
        received: new Prisma.Decimal(0),
      };
      current.transactions += row._count._all;
      if (row.status === "COMPLETED") {
        current.completedTransactions += row._count._all;
        current.received = current.received.plus(row._sum.amount ?? 0);
      }
      methodMap.set(key, current);
    }

    const notifications: DashboardNotification[] = transactions
      .filter((payment) => ["FAILED", "PENDING", "PROCESSING"].includes(payment.status))
      .slice(0, 6)
      .map((payment) => ({
        id: payment.id,
        title: payment.status === "FAILED" ? "Pagamento falhado" : "Pagamento por acompanhar",
        description: `${payment.reference} · ${payment.amount} ${payment.currency}`,
        createdAt: payment.createdAt,
        severity: "attention",
      }));

    const data: DashboardPayload = {
      ...basePayload,
      summary: {
        availableBalance: money(wallets._sum.balance),
        receivedTotal: money(received._sum.amount),
        totalTransactions,
        pendingAmount: money(pending._sum.amount),
        pendingTransactions: pending._count._all,
        completedTransactions: completed,
      },
      chart,
      transactions,
      customers: [...customerMap.values()],
      methods: [...methodMap.values()].map((method) => ({
        ...method,
        received: method.received.toFixed(2),
      })),
      notifications,
      updatedAt: new Date().toISOString(),
    };

    return json({ success: true, data }, 200, id);
  } catch {
    return json({
      success: false,
      error: {
        code: "DASHBOARD_DATA_UNAVAILABLE",
        message: "Não foi possível consultar os dados do dashboard. Verifique a ligação à base de dados.",
      },
    }, 503, id);
  }
}
