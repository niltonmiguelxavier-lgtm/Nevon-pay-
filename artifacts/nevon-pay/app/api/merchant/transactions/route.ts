import { Prisma, type PaymentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { corsPreflight, json, requestId } from "@/lib/http";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { expireStaleSessions } from "@/lib/payments";

export const dynamic = "force-dynamic";

const VALID_STATUSES: PaymentStatus[] = [
  "OPEN",
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
];

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

/**
 * Listagem paginada e filtrável de transacções para o comerciante autenticado
 * (cookies SSR ou token Bearer). Garante isolamento estrito por comerciante.
 */
export async function GET(req: Request) {
  const rid = requestId(req);
  try {
    const { supabase } = await requireAuthenticatedUser(req);
    const url = new URL(req.url);

    const requestedMerchantId = url.searchParams.get("merchantId")?.trim() || null;
    const rawStatus = (url.searchParams.get("status") || "ALL").trim().toUpperCase();
    const providerFilter = url.searchParams.get("provider")?.trim() || null;
    const query = (url.searchParams.get("q") || "").trim();
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "25", 10) || 25));
    const offset = (page - 1) * limit;

    if (rawStatus !== "ALL" && !VALID_STATUSES.includes(rawStatus as PaymentStatus)) {
      return json(
        {
          success: false,
          error: { code: "INVALID_STATUS", message: "Estado de pagamento inválido." },
        },
        400,
        rid
      );
    }

    const links = await db.merchantUser.findMany({
      where: { userId: supabase.id },
      select: { merchantId: true },
    });
    const allowedMerchantIds = Array.from(new Set(links.map((item) => item.merchantId)));

    if (requestedMerchantId && !allowedMerchantIds.includes(requestedMerchantId)) {
      return json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Sem acesso a este espaço de trabalho." },
        },
        403,
        rid
      );
    }

    const merchantIds = requestedMerchantId ? [requestedMerchantId] : allowedMerchantIds;
    if (merchantIds.length === 0) {
      return json(
        {
          success: true,
          data: [],
          pagination: { page, limit, total: 0, hasMore: false },
        },
        200,
        rid
      );
    }

    await expireStaleSessions(merchantIds);

    let total = 0;
    let items: Array<{
      id: string;
      reference: string;
      status: PaymentStatus;
      amount: string;
      currency: string;
      provider: string | null;
      merchantId: string;
      merchantName: string;
      createdAt: string;
      customerName: string | null;
      customerEmail: string | null;
      customerPhone: string | null;
    }> = [];

    if (!query) {
      const where: Prisma.PaymentWhereInput = {
        merchantId: { in: merchantIds },
        ...(rawStatus !== "ALL" ? { status: rawStatus as PaymentStatus } : {}),
        ...(providerFilter ? { provider: { equals: providerFilter, mode: "insensitive" } } : {}),
      };

      const [count, rows] = await Promise.all([
        db.payment.count({ where }),
        db.payment.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: offset,
          take: limit,
          select: {
            id: true,
            reference: true,
            status: true,
            amount: true,
            currency: true,
            provider: true,
            merchantId: true,
            createdAt: true,
            merchant: { select: { name: true } },
            session: { select: { customer: true } },
          },
        }),
      ]);

      total = count;
      items = rows.map((row) => {
        const customer = customerFields(row.session?.customer ?? null);
        return {
          id: row.id,
          reference: row.reference,
          status: row.status,
          amount: row.amount.toFixed(2),
          currency: row.currency,
          provider: row.provider,
          merchantId: row.merchantId,
          merchantName: row.merchant.name,
          createdAt: row.createdAt.toISOString(),
          customerName: customer.name,
          customerEmail: customer.email,
          customerPhone: customer.phone,
        };
      });
    } else {
      const pattern = `%${query}%`;
      const statusClause =
        rawStatus !== "ALL"
          ? Prisma.sql`AND p."status" = ${rawStatus}::"app_payment_status"`
          : Prisma.empty;
      const providerClause = providerFilter
        ? Prisma.sql`AND LOWER(COALESCE(p."provider", '')) = LOWER(${providerFilter})`
        : Prisma.empty;

      const [countRows, matchedRows] = await Promise.all([
        db.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
          SELECT COUNT(*)::bigint AS total
          FROM "Payment" p
          LEFT JOIN "CheckoutSession" cs ON cs."paymentId" = p."id"
          WHERE p."merchantId" IN (${Prisma.join(merchantIds)})
            ${statusClause}
            ${providerClause}
            AND (
              p."reference" ILIKE ${pattern}
              OR COALESCE(p."provider", '') ILIKE ${pattern}
              OR COALESCE(p."providerRef", '') ILIKE ${pattern}
              OR COALESCE(cs."customer"::text, '') ILIKE ${pattern}
            )
        `),
        db.$queryRaw<
          Array<{
            id: string;
            reference: string;
            status: PaymentStatus;
            amount: Prisma.Decimal;
            currency: string;
            provider: string | null;
            merchantId: string;
            merchantName: string;
            createdAt: Date;
            customer: Prisma.JsonValue | null;
          }>
        >(Prisma.sql`
          SELECT p."id", p."reference", p."status", p."amount", p."currency", p."provider",
                 p."merchantId", m."name" AS "merchantName", p."createdAt", cs."customer"
          FROM "Payment" p
          INNER JOIN "Merchant" m ON m."id" = p."merchantId"
          LEFT JOIN "CheckoutSession" cs ON cs."paymentId" = p."id"
          WHERE p."merchantId" IN (${Prisma.join(merchantIds)})
            ${statusClause}
            ${providerClause}
            AND (
              p."reference" ILIKE ${pattern}
              OR COALESCE(p."provider", '') ILIKE ${pattern}
              OR COALESCE(p."providerRef", '') ILIKE ${pattern}
              OR COALESCE(cs."customer"::text, '') ILIKE ${pattern}
            )
          ORDER BY p."createdAt" DESC
          LIMIT ${limit} OFFSET ${offset}
        `),
      ]);

      total = Number(countRows[0]?.total ?? 0);
      items = matchedRows.map((row) => {
        const customer = customerFields(row.customer);
        return {
          id: row.id,
          reference: row.reference,
          status: row.status,
          amount: row.amount.toFixed(2),
          currency: row.currency,
          provider: row.provider,
          merchantId: row.merchantId,
          merchantName: row.merchantName,
          createdAt: row.createdAt.toISOString(),
          customerName: customer.name,
          customerEmail: customer.email,
          customerPhone: customer.phone,
        };
      });
    }

    return json(
      {
        success: true,
        data: items,
        pagination: {
          page,
          limit,
          total,
          hasMore: offset + items.length < total,
        },
      },
      200,
      rid
    );
  } catch (error) {
    if ((error as { code?: string }).code === "UNAUTHENTICATED") {
      return json({ success: false, error: { code: "UNAUTHENTICATED", message: "Inicie sessão." } }, 401, rid);
    }
    return handleApiError(error, rid);
  }
}

export function OPTIONS() {
  return corsPreflight("GET, OPTIONS");
}
