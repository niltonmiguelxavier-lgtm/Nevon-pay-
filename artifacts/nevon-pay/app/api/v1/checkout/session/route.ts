import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { json, requestId } from "@/lib/http";
import { generateCancelToken, generateReference } from "@/lib/security";
import { authenticateApiKey, assertMerchantScope } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/errors";
import { notifyMerchantUsers } from "@/lib/notifications";
import { getPublicAppUrl } from "@/lib/env";

const schema = z.object({
  merchantId: z.string().min(1).optional(),
  amount: z.coerce.number().positive().max(1_000_000_000),
  currency: z.string().length(3).default("MZN"),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  customer: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  expiresInMinutes: z.coerce.number().int().min(5).max(24 * 60).default(30),
});

export async function POST(req: Request) {
  const rid = requestId(req);
  try {
    const auth = await authenticateApiKey(req, { scope: "v1.checkout.create" });
    const input = schema.parse(await req.json());
    assertMerchantScope(auth, input.merchantId);

    const payment = await db.payment.create({
      data: {
        merchantId: auth.merchantId,
        amount: input.amount.toFixed(4),
        currency: input.currency.toUpperCase(),
        reference: generateReference("PAY"),
        status: "PENDING",
        metadata: (input.metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });

    const session = await db.checkoutSession.create({
      data: {
        merchantId: auth.merchantId,
        paymentId: payment.id,
        amount: input.amount.toFixed(4),
        currency: input.currency.toUpperCase(),
        cancelToken: generateCancelToken(),
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
        customer: (input.customer as Prisma.InputJsonValue) ?? undefined,
        metadata: (input.metadata as Prisma.InputJsonValue) ?? undefined,
        expiresAt: new Date(Date.now() + input.expiresInMinutes * 60 * 1000),
      },
    });

    await db.auditLog.create({
      data: {
        merchantId: auth.merchantId,
        action: "checkout.session.created",
        resource: "CheckoutSession",
        resourceId: session.id,
        requestId: rid,
        metadata: { amount: session.amount.toString(), currency: session.currency },
      },
    });

    await notifyMerchantUsers({
      merchantId: auth.merchantId,
      type: "checkout.created",
      title: "Nova sessão de checkout",
      description: `${session.amount.toString()} ${session.currency} · expira em ${input.expiresInMinutes} minutos.`,
      severity: "info",
    });

    const base = getPublicAppUrl();
    return json(
      {
        success: true,
        session,
        payment_reference: payment.reference,
        checkout_url: `${base}/checkout/${session.id}`,
        cancel_token: session.cancelToken,
        expires_at: session.expiresAt,
      },
      201,
      rid
    );
  } catch (error) {
    return handleApiError(error, rid);
  }
}
