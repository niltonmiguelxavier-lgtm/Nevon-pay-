import { z } from "zod";
import { db } from "@/lib/db";
import { json, requestId } from "@/lib/http";
import { generateReference } from "@/lib/security";

const schema = z.object({
  merchantId: z.string().min(1),
  amount: z.coerce.number().positive(),
  currency: z.string().length(3).default("MZN"),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  customer: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional()
});

export async function POST(req: Request) {
  const rid = requestId(req);
  try {
    const input = schema.parse(await req.json());
    const merchant = await db.merchant.findUnique({ where: { id: input.merchantId } });
    if (!merchant) return json({ success:false, error:{code:"MERCHANT_NOT_FOUND",message:"Comerciante não encontrado"} },404,rid);

    const payment = await db.payment.create({
      data: {
        merchantId: merchant.id,
        amount: input.amount.toFixed(4),
        currency: input.currency.toUpperCase(),
        reference: generateReference("PAY"),
        status: "PENDING",
        metadata: input.metadata
      }
    });

    const session = await db.checkoutSession.create({
      data: {
        merchantId: merchant.id,
        paymentId: payment.id,
        amount: input.amount.toFixed(4),
        currency: input.currency.toUpperCase(),
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
        customer: input.customer,
        metadata: input.metadata,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000)
      }
    });

    return json({ success:true, session, checkout_url:`/checkout/${session.id}` },201,rid);
  } catch (e:any) {
    return json({ success:false, error:{code:"VALIDATION_ERROR",message:e?.message || "Pedido inválido"} },400,rid);
  }
}
