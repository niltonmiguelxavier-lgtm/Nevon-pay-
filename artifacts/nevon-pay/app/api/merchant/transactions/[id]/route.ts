import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { corsPreflight, json, requestId } from "@/lib/http";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { expireSessionIfNeeded } from "@/lib/payments";

export const dynamic = "force-dynamic";

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

/** Detalhe de uma transacção pertencente ao comerciante autenticado. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const rid = requestId(req);
  try {
    const { supabase } = await requireAuthenticatedUser(req);
    const { id } = await params;

    const links = await db.merchantUser.findMany({
      where: { userId: supabase.id },
      select: { merchantId: true },
    });
    const merchantIds = Array.from(new Set(links.map((item) => item.merchantId)));

    if (merchantIds.length === 0) {
      return json({ success: false, error: { code: "NOT_FOUND", message: "Transacção não encontrada." } }, 404, rid);
    }

    const existing = await db.payment.findFirst({
      where: {
        merchantId: { in: merchantIds },
        OR: [{ id }, { reference: id }],
      },
      select: { id: true, session: { select: { id: true } } },
    });

    if (!existing) {
      return json({ success: false, error: { code: "NOT_FOUND", message: "Transacção não encontrada." } }, 404, rid);
    }

    if (existing.session?.id) {
      await expireSessionIfNeeded(existing.session.id);
    }

    const payment = await db.payment.findUnique({
      where: { id: existing.id },
      select: {
        id: true,
        reference: true,
        status: true,
        amount: true,
        currency: true,
        provider: true,
        providerRef: true,
        merchantId: true,
        createdAt: true,
        updatedAt: true,
        merchant: { select: { id: true, name: true, status: true } },
        session: {
          select: {
            id: true,
            status: true,
            customer: true,
            expiresAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!payment) {
      return json({ success: false, error: { code: "NOT_FOUND", message: "Transacção não encontrada." } }, 404, rid);
    }

    const customer = customerFields(payment.session?.customer ?? null);

    return json(
      {
        success: true,
        transaction: {
          id: payment.id,
          reference: payment.reference,
          status: payment.status,
          amount: payment.amount.toFixed(2),
          currency: payment.currency,
          provider: payment.provider,
          providerRef: payment.providerRef,
          merchant: payment.merchant,
          customer,
          session: payment.session
            ? {
                id: payment.session.id,
                status: payment.session.status,
                expiresAt: payment.session.expiresAt.toISOString(),
                createdAt: payment.session.createdAt.toISOString(),
              }
            : null,
          createdAt: payment.createdAt.toISOString(),
          updatedAt: payment.updatedAt.toISOString(),
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
