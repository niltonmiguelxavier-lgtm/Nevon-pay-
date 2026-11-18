import { z } from "zod";
import { corsPreflight, json, requestId } from "@/lib/http";
import { getAuthenticatedAuthContext } from "@/lib/auth/session";
import { authErrorMessage } from "@/lib/auth/errors";
import { handleApiError } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { clientKey, rateLimit } from "@/lib/rate-limit";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Indique a palavra-passe actual."),
    newPassword: z
      .string()
      .min(8, "A nova palavra-passe tem de ter pelo menos 8 caracteres.")
      .max(72, "A palavra-passe não pode exceder 72 caracteres."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "A confirmação não coincide com a nova palavra-passe.",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "A nova palavra-passe tem de ser diferente da actual.",
    path: ["newPassword"],
  });

/**
 * Alteração de palavra-passe autenticada (cookies SSR ou token Bearer).
 * A palavra-passe actual é validada no servidor (reauth) antes da alteração.
 */
export async function POST(req: Request) {
  const rid = requestId(req);
  try {
    const limit = rateLimit(clientKey(req, "account.password"), { max: 8, windowSeconds: 300 });
    if (!limit.allowed) {
      return json(
        { success: false, error: { code: "RATE_LIMITED", message: "Demasiadas tentativas. Aguarde alguns minutos." } },
        429,
        rid
      );
    }

    const authContext = await getAuthenticatedAuthContext(req);
    if (!authContext || !authContext.supabase.email) {
      return json(
        { success: false, error: { code: "UNAUTHENTICATED", message: "Sessão inválida. Inicie sessão novamente." } },
        401,
        rid
      );
    }

    const input = schema.parse(await req.json());

    const { data: reauthData, error: reauthError } = await authContext.client.auth.signInWithPassword({
      email: authContext.supabase.email,
      password: input.currentPassword,
    });
    if (reauthError) {
      return json(
        { success: false, error: { code: "WRONG_PASSWORD", message: "A palavra-passe actual não está correcta." } },
        400,
        rid
      );
    }

    if (authContext.bearerToken) {
      const accessToken = reauthData.session?.access_token || authContext.bearerToken;
      const response = await fetch(`${authContext.config.url}/auth/v1/user`, {
        method: "PUT",
        headers: {
          apikey: authContext.config.publishableKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: input.newPassword }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error_code?: string;
          code?: string;
          msg?: string;
          message?: string;
        };
        const rawCode = payload.error_code ?? payload.code;
        const code = rawCode === "same_password" ? "SAME_PASSWORD" : "PASSWORD_UPDATE_FAILED";
        return json(
          {
            success: false,
            error: {
              code,
              message: authErrorMessage({ code: rawCode, message: payload.msg ?? payload.message }),
            },
          },
          400,
          rid
        );
      }
    } else {
      const { error: updateError } = await authContext.client.auth.updateUser({ password: input.newPassword });
      if (updateError) {
        const code = updateError.code === "same_password" ? "SAME_PASSWORD" : "PASSWORD_UPDATE_FAILED";
        return json({ success: false, error: { code, message: authErrorMessage(updateError) } }, 400, rid);
      }
    }

    await db.auditLog.create({
      data: {
        actorId: authContext.supabase.id,
        action: "account.password_changed",
        resource: "User",
        resourceId: authContext.supabase.id,
        requestId: rid,
      },
    });

    return json({ success: true, message: "Palavra-passe actualizada." }, 200, rid);
  } catch (error) {
    return handleApiError(error, rid);
  }
}

export function OPTIONS() {
  return corsPreflight("POST, OPTIONS");
}
