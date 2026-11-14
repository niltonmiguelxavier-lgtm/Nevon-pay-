import { db } from "@/lib/db";
import { json, requestId } from "@/lib/http";
import { handleApiError } from "@/lib/api/errors";
import { expireSessionIfNeeded } from "@/lib/payments";
import { authenticateApiKey } from "@/lib/api/auth";

/**
 * Consulta pública da sessão (usada pela página de checkout).
 * Devolve apenas campos não sensíveis do comerciante. O `cancel_token` só é
 * devolvido quando o pedido é autenticado com a chave de API do comerciante.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const rid = requestId(req);
  try {
    const { id } = await params;
    await expireSessionIfNeeded(id);

    const session = await db.checkoutSession.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        amount: true,
        currency: true,
        expiresAt: true,
        successUrl: true,
        cancelUrl: true,
        cancelToken: true,
        createdAt: true,
        payment: { select: { reference: true, status: true, provider: true } },
        merchant: { select: { name: true } },
      },
    });

    if (!session) {
      return json({ success: false, error: { code: "NOT_FOUND", message: "Checkout não encontrado." } }, 404, rid);
    }

    let includeSecret = false;
    try {
      const auth = await authenticateApiKey(req, { scope: "v1.checkout.read" });
      const owner = await db.checkoutSession.findFirst({
        where: { id, merchantId: auth.merchantId },
        select: { id: true },
      });
      includeSecret = Boolean(owner);
    } catch {
      includeSecret = false;
    }

    const { cancelToken, ...publicFields } = session;
    return json(
      {
        success: true,
        session: includeSecret ? { ...publicFields, cancel_token: cancelToken } : publicFields,
      },
      200,
      rid
    );
  } catch (error) {
    return handleApiError(error, rid);
  }
}
