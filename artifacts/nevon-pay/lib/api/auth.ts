import { db } from "@/lib/db";
import { hashSecret } from "@/lib/security";
import { clientKey, rateLimit, rateLimitHeaders, type RateLimitResult } from "@/lib/rate-limit";

export type ApiKeyContext = {
  merchantId: string;
  merchantName: string;
  environment: "TEST" | "LIVE";
  apiKeyId: string;
  rateLimit: RateLimitResult;
};

export class ApiAuthError extends Error {
  status: number;
  code: string;
  detail?: string;
  rateLimit?: RateLimitResult;

  constructor(code: string, message: string, status = 401, detail?: string) {
    super(message);
    this.code = code;
    this.status = status;
    this.detail = detail;
    this.name = "ApiAuthError";
  }
}

/** Extrai a chave de `Authorization: Bearer <key>` ou `x-api-key: <key>`. */
export function extractApiKey(req: Request): string | null {
  const authorization = req.headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    const value = authorization.slice(7).trim();
    if (value) return value;
  }
  const headerKey = req.headers.get("x-api-key")?.trim();
  return headerKey || null;
}

/**
 * Autentica um pedido à API pública. Antes desta correcção as rotas /api/v1
 * aceitavam qualquer pedido anónimo e confiavam no `merchantId` enviado no
 * corpo — qualquer pessoa podia criar pagamentos em nome de outro comerciante.
 */
export async function authenticateApiKey(req: Request, options?: { scope?: string; max?: number }): Promise<ApiKeyContext> {
  const key = extractApiKey(req);
  if (!key) {
    throw new ApiAuthError(
      "MISSING_API_KEY",
      "Falta a chave de API. Envie o cabeçalho Authorization: Bearer <chave> ou x-api-key.",
      401
    );
  }

  const limit = rateLimit(clientKey(req, options?.scope ?? "api"), { max: options?.max ?? 120 });
  if (!limit.allowed) {
    const error = new ApiAuthError(
      "RATE_LIMITED",
      `Demasiados pedidos. Tente novamente em ${limit.retryAfterSeconds} segundos.`,
      429
    );
    error.rateLimit = limit;
    throw error;
  }

  const record = await db.apiKey.findUnique({
    where: { keyHash: hashSecret(key) },
    include: { merchant: { select: { id: true, name: true, status: true } } },
  });

  if (!record || !record.active) {
    throw new ApiAuthError("INVALID_API_KEY", "Chave de API inválida ou revogada.", 401);
  }

  if (record.merchant.status !== "ACTIVE") {
    throw new ApiAuthError(
      "MERCHANT_INACTIVE",
      `O espaço de trabalho "${record.merchant.name}" não está activo (estado: ${record.merchant.status}).`,
      403
    );
  }

  return {
    merchantId: record.merchant.id,
    merchantName: record.merchant.name,
    environment: record.environment,
    apiKeyId: record.id,
    rateLimit: limit,
  };
}

export function apiAuthHeaders(context?: { rateLimit?: RateLimitResult }) {
  return context?.rateLimit ? rateLimitHeaders(context.rateLimit) : {};
}

/** Garante que um comerciante indicado no pedido pertence à chave usada (anti-IDOR). */
export function assertMerchantScope(context: ApiKeyContext, requestedMerchantId?: string | null) {
  if (requestedMerchantId && requestedMerchantId !== context.merchantId) {
    throw new ApiAuthError(
      "MERCHANT_SCOPE_MISMATCH",
      "A chave de API apresentada não tem acesso a esse comerciante.",
      403
    );
  }
}
