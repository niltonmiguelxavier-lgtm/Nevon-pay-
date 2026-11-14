import { db } from "@/lib/db";
import { json, requestId } from "@/lib/http";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";

/** Revoga (desactiva) uma chave de API do próprio comerciante. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const rid = requestId(req);
  try {
    const { supabase } = await requireAuthenticatedUser();
    const { id } = await params;

    const key = await db.apiKey.findUnique({ where: { id }, select: { id: true, merchantId: true } });
    if (!key) {
      return json({ success: false, error: { code: "NOT_FOUND", message: "Chave não encontrada." } }, 404, rid);
    }

    const link = await db.merchantUser.findFirst({
      where: { userId: supabase.id, merchantId: key.merchantId },
      select: { id: true },
    });
    if (!link) {
      return json({ success: false, error: { code: "FORBIDDEN", message: "Sem acesso a esta chave." } }, 403, rid);
    }

    await db.apiKey.update({ where: { id }, data: { active: false } });
    await db.auditLog.create({
      data: {
        actorId: supabase.id,
        merchantId: key.merchantId,
        action: "api_key.revoked",
        resource: "ApiKey",
        resourceId: id,
        requestId: rid,
      },
    });

    return json({ success: true, revoked: id }, 200, rid);
  } catch (error) {
    if ((error as { code?: string }).code === "UNAUTHENTICATED") {
      return json({ success: false, error: { code: "UNAUTHENTICATED", message: "Inicie sessão." } }, 401, rid);
    }
    return handleApiError(error, rid);
  }
}
