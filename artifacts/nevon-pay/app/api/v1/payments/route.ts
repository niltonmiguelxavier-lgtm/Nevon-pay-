import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { json, requestId } from "@/lib/http";
import { generateReference } from "@/lib/security";
import { getProvider } from "@/lib/provider-registry";
import { authenticateApiKey, assertMerchantScope, apiAuthHeaders } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/errors";
import { notifyMerchantUsers } from "@/lib/notifications";

const schema = z.object({
  merchantId: z.string().min(1).optional(),
  amount: z.coerce.number().positive().max(1_000_000_000),
  currency: z.string().length(3).default("MZN"),
  provider: z.string().trim().min(1).max(60).default("sandbox"),
  reference: z.string().min(3).max(120).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(req: Request) {
  const rid = requestId(req);
  try {
    const auth = await authenticateApiKey(req, { scope: "v1.payments.create" });
    const input = schema.parse(await req.json());
    assertMerchantScope(auth, input.merchantId);

    const requestedProvider = input.provider.toLowerCase();

    // Em chaves LIVE não simulamos pagamentos: sem provedor real configurado,
    // recusamos em vez de marcar operações fictícias como pagas.
    if (auth.environment === "LIVE" && requestedProvider === "sandbox") {
      return json(
        {
          success: false,
          error: {
            code: "SANDBOX_NOT_AVAILABLE_IN_LIVE",
            message:
              "O provedor sandbox não está disponível com chaves de produção. Configure um provedor real (M-Pesa/e-Mola) antes de usar chaves nv_live_.",
          },
        },
        503,
        rid
      );
    }

    const idempotencyKey =
      req.headers.get("idempotency-key")?.trim() || req.headers.get("x-idempotency-key")?.trim() || null;

    if (idempotencyKey) {
      const existing = await db.payment.findUnique({
        where: { merchantId_idempotencyKey: { merchantId: auth.merchantId, idempotencyKey } },
      });
      if (existing) {
        return json({ success: true, payment: existing, idempotent_replay: true }, 200, rid);
      }
    }

    const provider = getProvider(requestedProvider);
    if (!provider.descriptor.environments.includes(auth.environment)) {
      return json(
        {
          success: false,
          error: {
            code: "PROVIDER_NOT_AVAILABLE_IN_ENVIRONMENT",
            message: `O provedor "${provider.descriptor.displayName}" não está disponível para chaves ${auth.environment}.`,
          },
        },
        503,
        rid
      );
    }
    const reference = input.reference?.trim() || generateReference("PAY");
    const currency = input.currency.toUpperCase();

    const result = await provider.createPayment({
      amount: input.amount.toFixed(4),
      currency,
      reference,
    });

    let payment;
    try {
      payment = await db.payment.create({
        data: {
          merchantId: auth.merchantId,
          amount: input.amount.toFixed(4),
          currency,
          reference,
          status: result.status,
          provider: provider.name,
          providerRef: result.providerRef,
          idempotencyKey,
          metadata: (input.metadata as Prisma.InputJsonValue) ?? undefined,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return json(
          {
            success: false,
            error: {
              code: "REFERENCE_CONFLICT",
              message: "Já existe um pagamento com esta referência ou chave de idempotência.",
            },
          },
          409,
          rid
        );
      }
      throw error;
    }

    await db.auditLog.create({
      data: {
        merchantId: auth.merchantId,
        action: "payment.created",
        resource: "Payment",
        resourceId: payment.id,
        requestId: rid,
        metadata: { provider: provider.name, amount: payment.amount.toString(), currency },
      },
    });

    await notifyMerchantUsers({
      merchantId: auth.merchantId,
      type: "payment.created",
      title: "Novo pagamento registado",
      description: `${reference} · ${payment.amount.toString()} ${currency} (${provider.name})`,
      severity: "info",
    });

    return json({ success: true, payment }, 201, rid);
  } catch (error) {
    return handleApiError(error, rid);
  }
}

/** Lista os pagamentos do comerciante autenticado pela chave de API. */
export async function GET(req: Request) {
  const rid = requestId(req);
  try {
    const auth = await authenticateApiKey(req, { scope: "v1.payments.list" });
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 25), 1), 100);

    const payments = await db.payment.findMany({
      where: { merchantId: auth.merchantId, ...(status ? { status: status as never } : {}) },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        reference: true,
        amount: true,
        currency: true,
        status: true,
        provider: true,
        providerRef: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return json({ success: true, data: payments, merchant_id: auth.merchantId }, 200, rid);
  } catch (error) {
    return handleApiError(error, rid);
  }
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { ...apiAuthHeaders(), Allow: "GET, POST, OPTIONS" },
  });
}
