import { db } from "@/lib/db";
import { json, requestId } from "@/lib/http";
import { handleApiError } from "@/lib/api/errors";
import { cancelCheckoutSession } from "@/lib/payments";
import { extractApiKey } from "@/lib/api/auth";
import { hashSecret } from "@/lib/security";

/**
 * Cancelamento de uma sessão de checkout.
 *
 * Autorização: chave de API do comerciante dono da sessão OU o `cancel_token`
 * devolvido na criação da sessão (usado pela página de checkout do cliente
 * final). Antes, qualquer pessoa que conhecesse o id podia cancelar qualquer
 * sessão — e o estado era alterado mesmo em pagamentos já concluídos.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const rid = requestId(req);
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { cancel_token?: string };
    const url = new URL(req.url);
    const token = (body.cancel_token || url.searchParams.get("cancel_token") || "").trim();

    const session = await db.checkoutSession.findUnique({
      where: { id },
      select: { id: true, merchantId: true, cancelToken: true },
    });
    if (!session) {
      return json({ success: false, error: { code: "NOT_FOUND", message: "Checkout não encontrado." } }, 404, rid);
    }

    let authorized = false;

    if (token && session.cancelToken && hashSecret(token) === hashSecret(session.cancelToken)) {
      authorized = true;
    } else {
      const apiKey = extractApiKey(req);
      if (apiKey) {
        const key = await db.apiKey.findUnique({
          where: { keyHash: hashSecret(apiKey) },
          select: { merchantId: true, active: true },
        });
        authorized = Boolean(key?.active && key.merchantId === session.merchantId);
      }
    }

    if (!authorized) {
      return json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message:
              "É necessário o cancel_token da sessão ou uma chave de API do comerciante dono do checkout.",
          },
        },
        401,
        rid
      );
    }

    const outcome = await cancelCheckoutSession(id);
    if (!outcome.ok) {
      return json({ success: false, error: { code: outcome.code, message: outcome.message } }, outcome.status, rid);
    }

    const updated = await db.checkoutSession.findUnique({
      where: { id },
      select: { id: true, status: true, amount: true, currency: true, expiresAt: true, cancelUrl: true },
    });

    return json({ success: true, session: updated, already_cancelled: outcome.alreadyCancelled }, 200, rid);
  } catch (error) {
    return handleApiError(error, rid);
  }
}
