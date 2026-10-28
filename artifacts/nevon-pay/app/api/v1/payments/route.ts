import { z } from "zod";
import { db } from "@/lib/db";
import { json, requestId } from "@/lib/http";
import { generateReference } from "@/lib/security";
import { getProvider, ProviderNotConfiguredError } from "@/lib/provider-registry";

const schema = z.object({
  merchantId: z.string().min(1),
  amount: z.coerce.number().positive(),
  currency: z.string().length(3).default("MZN"),
  provider: z.enum(["sandbox", "mpesa", "emola"]).default("sandbox")
});

export async function POST(req: Request) {
  const rid=requestId(req);
  try {
    const input = schema.parse(await req.json());
    const provider = getProvider(input.provider);
    const merchant = await db.merchant.findUnique({ where: { id: input.merchantId } });
    if (!merchant) {
      return json({ success: false, error: { code: "MERCHANT_NOT_FOUND", message: "Comerciante não encontrado" } }, 404, rid);
    }

    const reference = generateReference("PAY");
    const currency = input.currency.toUpperCase();
    const result = await provider.createPayment({
      amount: input.amount.toFixed(4),
      currency,
      reference
    });
    const payment = await db.payment.create({
      data: {
        merchantId: merchant.id,
        amount: input.amount.toFixed(4),
        currency,
        reference,
        status: result.status,
        provider: provider.name,
        providerRef: result.providerRef
      }
    });

    return json({ success: true, payment }, 201, rid);
  } catch (error) {
    if (error instanceof ProviderNotConfiguredError) {
      return json({
        success: false,
        error: {
          code: "PROVIDER_NOT_CONFIGURED",
          message: "Este provedor ainda não está configurado para pagamentos reais."
        }
      }, 503, rid);
    }

    return json({
      success: false,
      error: {
        code: "PAYMENT_ERROR",
        message: error instanceof Error ? error.message : "Não foi possível criar o pagamento."
      }
    }, 400, rid);
  }
}
