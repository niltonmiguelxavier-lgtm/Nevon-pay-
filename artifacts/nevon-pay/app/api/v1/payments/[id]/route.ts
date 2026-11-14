import { db } from "@/lib/db";
import { json, requestId } from "@/lib/http";
import { authenticateApiKey } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/errors";

/**
 * Consulta de um pagamento. Antes não existia: a API criava pagamentos mas
 * não permitia confirmar o estado — o ficheiro `app/api/v1/payments/7` era
 * um resíduo do upload e era interpretado como rota inexistente.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const rid = requestId(req);
  try {
    const auth = await authenticateApiKey(req, { scope: "v1.payments.read" });
    const { id } = await params;

    const payment = await db.payment.findFirst({
      where: { OR: [{ id }, { reference: id }], merchantId: auth.merchantId },
      select: {
        id: true,
        reference: true,
        amount: true,
        currency: true,
        status: true,
        provider: true,
        providerRef: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
        session: {
          select: { id: true, status: true, expiresAt: true, successUrl: true, cancelUrl: true },
        },
      },
    });

    if (!payment) {
      return json(
        { success: false, error: { code: "NOT_FOUND", message: "Pagamento não encontrado para esta chave de API." } },
        404,
        rid
      );
    }

    return json({ success: true, payment }, 200, rid);
  } catch (error) {
    return handleApiError(error, rid);
  }
}
