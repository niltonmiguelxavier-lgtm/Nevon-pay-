import { json, requestId } from "@/lib/http";
import { createClient } from "@/lib/supabase/server";
import { countUnread, listNotifications, markAllNotificationsRead } from "@/lib/notifications";
import { handleApiError } from "@/lib/api/errors";

/** Notificações persistidas do utilizador autenticado. */
export async function GET(req: Request) {
  const rid = requestId(req);
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      return json({ success: false, error: { code: "UNAUTHENTICATED", message: "Inicie sessão." } }, 401, rid);
    }

    const url = new URL(req.url);
    const unreadOnly = url.searchParams.get("unread") === "1";
    const limit = Number(url.searchParams.get("limit") || 20);

    const [items, unread] = await Promise.all([
      listNotifications(data.user.id, { limit, unreadOnly }),
      countUnread(data.user.id),
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
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      return json({ success: false, error: { code: "UNAUTHENTICATED", message: "Inicie sessão." } }, 401, rid);
    }
    const updated = await markAllNotificationsRead(data.user.id);
    return json({ success: true, updated }, 200, rid);
  } catch (error) {
    return handleApiError(error, rid);
  }
}
