import { corsPreflight, json, requestId } from "@/lib/http";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { countUnread, listNotifications, markAllNotificationsRead } from "@/lib/notifications";
import { handleApiError } from "@/lib/api/errors";

/** Notificações persistidas do utilizador autenticado (cookie SSR ou Bearer). */
export async function GET(req: Request) {
  const rid = requestId(req);
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return json({ success: false, error: { code: "UNAUTHENTICATED", message: "Inicie sessão." } }, 401, rid);
    }

    const url = new URL(req.url);
    const unreadOnly = url.searchParams.get("unread") === "1";
    const limit = Number(url.searchParams.get("limit") || 20);

    const [items, unread] = await Promise.all([
      listNotifications(authUser.supabase.id, { limit, unreadOnly }),
      countUnread(authUser.supabase.id),
    ]);

    return json({ success: true, data: items, unread }, 200, rid);
  } catch (error) {
    return handleApiError(error, rid);
  }
}

/** Marca todas as notificações como lidas. */
export async function POST(req: Request) {
  const rid = requestId(req);
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return json({ success: false, error: { code: "UNAUTHENTICATED", message: "Inicie sessão." } }, 401, rid);
    }
    const updated = await markAllNotificationsRead(authUser.supabase.id);
    return json({ success: true, updated }, 200, rid);
  } catch (error) {
    return handleApiError(error, rid);
  }
}

export function OPTIONS() {
  return corsPreflight("GET, POST, OPTIONS");
}
