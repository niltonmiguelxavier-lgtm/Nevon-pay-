import type { User as SupabaseUser } from "@supabase/supabase-js";
import { z } from "zod";
import { corsPreflight, json, requestId } from "@/lib/http";
import { getAuthenticatedAuthContext } from "@/lib/auth/session";
import { authErrorMessage } from "@/lib/auth/errors";
import { handleApiError } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { syncSupabaseUser } from "@/lib/auth/sync-user";

const schema = z.object({
  name: z.string().trim().max(120).optional(),
});

/**
 * Actualização do perfil. Suporta cookies SSR (site) e token Bearer (app móvel),
 * mantendo Supabase Auth (`user_metadata`) e PostgreSQL `User` alinhados.
 */
export async function PATCH(req: Request) {
  const rid = requestId(req);
  try {
    const authContext = await getAuthenticatedAuthContext(req);
    if (!authContext) {
      return json(
        { success: false, error: { code: "UNAUTHENTICATED", message: "Sessão inválida. Inicie sessão novamente." } },
        401,
        rid
      );
    }

    const input = schema.parse(await req.json());
    const name = input.name?.trim() || null;

    let refreshedUser: SupabaseUser | null = null;

    if (authContext.bearerToken) {
      const response = await fetch(`${authContext.config.url}/auth/v1/user`, {
        method: "PUT",
        headers: {
          apikey: authContext.config.publishableKey,
          Authorization: `Bearer ${authContext.bearerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: { full_name: name } }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        user?: SupabaseUser;
        code?: string;
        msg?: string;
        message?: string;
        error_code?: string;
      };
      if (!response.ok) {
        return json(
          {
            success: false,
            error: {
              code: "PROFILE_UPDATE_FAILED",
              message: authErrorMessage({
                code: payload.error_code ?? payload.code,
                message: payload.msg ?? payload.message,
              }),
            },
          },
          400,
          rid
        );
      }
      refreshedUser = payload.user ?? (payload as unknown as SupabaseUser);
    } else {
      const { error } = await authContext.client.auth.updateUser({ data: { full_name: name } });
      if (error) {
        return json({ success: false, error: { code: "PROFILE_UPDATE_FAILED", message: authErrorMessage(error) } }, 400, rid);
      }
      const { data: refreshed } = await authContext.client.auth.getUser();
      refreshedUser = refreshed.user ?? null;
    }

    const profile = refreshedUser ? await syncSupabaseUser(refreshedUser) : null;

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
    const authContext = await getAuthenticatedAuthContext(req);
    if (!authContext) {
      return json({ success: false, error: { code: "UNAUTHENTICATED", message: "Inicie sessão." } }, 401, rid);
    }
    const profile = await db.user.findUnique({
      where: { id: authContext.supabase.id },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
    return json({ success: true, profile }, 200, rid);
  } catch (error) {
    return handleApiError(error, rid);
  }
}

export function OPTIONS() {
  return corsPreflight("GET, PATCH, OPTIONS");
}
