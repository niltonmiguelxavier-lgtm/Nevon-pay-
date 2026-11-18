import { corsPreflight, json, requestId } from "@/lib/http";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { markNotificationRead } from "@/lib/notifications";
import { handleApiError } from "@/lib/api/errors";

/** Marca uma notificação concreta como lida (só se pertencer ao utilizador). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const rid = requestId(req);
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return json({ success: false, error: { code: "UNAUTHENTICATED", message: "Inicie sessão." } }, 401, rid);
    }

    const { id } = await params;
    const result = await markNotificationRead(authUser.supabase.id, id);
    if (!result.ok) {
      return json({ success: false, error: { code: "NOT_FOUND", message: "Notificação não encontrada." } }, 404, rid);
    }
    return json({ success: true, id }, 200, rid);
  } catch (error) {
    return handleApiError(error, rid);
  }
}

export function OPTIONS() {
  return corsPreflight("POST, OPTIONS");
}
