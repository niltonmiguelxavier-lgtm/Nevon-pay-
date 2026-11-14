import { z } from "zod";
import { json, requestId } from "@/lib/http";
import { createClient } from "@/lib/supabase/server";
import { authErrorMessage } from "@/lib/auth/errors";
import { handleApiError } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { syncSupabaseUser } from "@/lib/auth/sync-user";

const schema = z.object({
  name: z.string().trim().max(120).optional(),
});

/**
 * Actualização do perfil. Mantém Supabase Auth (user_metadata) e a tabela
 * PostgreSQL `User` alinhados no mesmo pedido; antes o dashboard só alterava o
 * metadata e o nome da base de dados era sobrescrito no sync seguinte.
 */
export async function PATCH(req: Request) {
  const rid = requestId(req);
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return json(
        { success: false, error: { code: "UNAUTHENTICATED", message: "Sessão inválida. Inicie sessão novamente." } },
        401,
        rid
      );
    }

    const input = schema.parse(await req.json());
    const name = input.name?.trim() || null;

    const { error } = await supabase.auth.updateUser({ data: { full_name: name } });
    if (error) {
      return json({ success: false, error: { code: "PROFILE_UPDATE_FAILED", message: authErrorMessage(error) } }, 400, rid);
    }

    const { data: refreshed } = await supabase.auth.getUser();
    const profile = refreshed.user ? await syncSupabaseUser(refreshed.user) : null;

    return json(
      { success: true, profile: { id: profile?.id, email: profile?.email, name: profile?.name ?? null } },
      200,
      rid
    );
  } catch (error) {
    return handleApiError(error, rid);
  }
}

export async function GET(req: Request) {
  const rid = requestId(req);
  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return json({ success: false, error: { code: "UNAUTHENTICATED", message: "Inicie sessão." } }, 401, rid);
    }
    const profile = await db.user.findUnique({
      where: { id: userData.user.id },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
    return json({ success: true, profile }, 200, rid);
  } catch (error) {
    return handleApiError(error, rid);
  }
}
