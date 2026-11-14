import { z } from "zod";
import { db } from "@/lib/db";
import { json, requestId } from "@/lib/http";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { generateApiKey, hashSecret } from "@/lib/security";
import { handleApiError } from "@/lib/api/errors";
import { rateLimit, clientKey } from "@/lib/rate-limit";

const schema = z.object({
  merchantId: z.string().min(1),
  name: z.string().min(2).max(60),
  environment: z.enum(["TEST", "LIVE"]).default("TEST"),
});

async function assertOwnership(userId: string, merchantId: string) {
  const link = await db.merchantUser.findFirst({ where: { userId, merchantId }, select: { id: true } });
  return Boolean(link);
}

/** Lista as chaves do comerciante (nunca devolve o segredo, apenas o prefixo). */
export async function GET(req: Request) {
  const rid = requestId(req);
  try {
    const { supabase } = await requireAuthenticatedUser();
    const merchantId = new URL(req.url).searchParams.get("merchantId");
    if (!merchantId) {
      return json({ success: false, error: { code: "MERCHANT_REQUIRED", message: "Indique merchantId." } }, 400, rid);
    }
    if (!(await assertOwnership(supabase.id, merchantId))) {
      return json({ success: false, error: { code: "FORBIDDEN", message: "Sem acesso a este comerciante." } }, 403, rid);
    }

    const keys = await db.apiKey.findMany({
      where: { merchantId },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, environment: true, active: true, createdAt: true },
    });
    return json({ success: true, data: keys }, 200, rid);
  } catch (error) {
    if ((error as { code?: string }).code === "UNAUTHENTICATED") {
      return json({ success: false, error: { code: "UNAUTHENTICATED", message: "Inicie sessão." } }, 401, rid);
    }
    return handleApiError(error, rid);
  }
}

/**
 * Cria uma chave de API. O segredo só é mostrado uma vez (guardamos apenas o
 * hash SHA-256), pelo que a resposta inclui `key` e o dashboard a apresenta
 * num aviso de cópia única.
 */
export async function POST(req: Request) {
  const rid = requestId(req);
  try {
    const { supabase } = await requireAuthenticatedUser();
    const limit = rateLimit(clientKey(req, "apikeys.create"), { max: 10, windowSeconds: 60 });
    if (!limit.allowed) {
      return json(
        { success: false, error: { code: "RATE_LIMITED", message: "Demasiados pedidos de criação de chaves. Aguarde um minuto." } },
        429,
        rid
      );
    }

    const input = schema.parse(await req.json());
    if (!(await assertOwnership(supabase.id, input.merchantId))) {
      return json({ success: false, error: { code: "FORBIDDEN", message: "Sem acesso a este comerciante." } }, 403, rid);
    }

    const key = generateApiKey(input.environment);
    const created = await db.apiKey.create({
      data: {
        merchantId: input.merchantId,
        name: input.name,
        // Guardamos o hash da chave completa; o prefixo fica visível para o utilizador distinguir chaves.
        keyHash: hashSecret(key),
        environment: input.environment,
      },
      select: { id: true, name: true, environment: true, active: true, createdAt: true },
    });

    await db.auditLog.create({
      data: {
        actorId: supabase.id,
        merchantId: input.merchantId,
        action: "api_key.created",
        resource: "ApiKey",
        resourceId: created.id,
        requestId: rid,
        metadata: { environment: input.environment, prefix: key.slice(0, 12) },
      },
    });

    return json({ success: true, api_key: { ...created, key, prefix: key.slice(0, 12) } }, 201, rid);
  } catch (error) {
    if ((error as { code?: string }).code === "UNAUTHENTICATED") {
      return json({ success: false, error: { code: "UNAUTHENTICATED", message: "Inicie sessão." } }, 401, rid);
    }
    return handleApiError(error, rid);
  }
}
