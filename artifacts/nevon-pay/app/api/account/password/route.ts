import { z } from "zod";
import { json, requestId } from "@/lib/http";
import { createClient } from "@/lib/supabase/server";
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
 * Alteração de palavra-passe autenticada.
 * A palavra-passe actual é validada no servidor (reauth) antes da alteração —
 * sem isto, uma sessão sequestrada poderia trocar a palavra-passe sem saber a
 * antiga. As sessões começam a usar a nova palavra-passe imediatamente.
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

    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user?.email) {
      return json(
        { success: false, error: { code: "UNAUTHENTICATED", message: "Sessão inválida. Inicie sessão novamente." } },
        401,
        rid
      );
    }

    const input = schema.parse(await req.json());

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: userData.user.email,
      password: input.currentPassword,
    });
    if (reauthError) {
      return json(
        { success: false, error: { code: "WRONG_PASSWORD", message: "A palavra-passe actual não está correcta." } },
        400,
        rid
      );
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: input.newPassword });
    if (updateError) {
      const code = updateError.code === "same_password" ? "SAME_PASSWORD" : "PASSWORD_UPDATE_FAILED";
      return json({ success: false, error: { code, message: authErrorMessage(updateError) } }, 400, rid);
    }

    await db.auditLog.create({
      data: {
        actorId: userData.user.id,
        action: "account.password_changed",
        resource: "User",
        resourceId: userData.user.id,
        requestId: rid,
      },
    });

    return json({ success: true, message: "Palavra-passe actualizada." }, 200, rid);
  } catch (error) {
    return handleApiError(error, rid);
  }
}
