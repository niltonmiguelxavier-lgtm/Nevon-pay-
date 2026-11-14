import { ZodError } from "zod";
import { ApiAuthError } from "./auth";
import { ProviderNotConfiguredError } from "@/lib/provider-registry";
import { apiError } from "@/lib/http";
import { rateLimitHeaders } from "@/lib/rate-limit";

/** Converte excepções conhecidas em respostas JSON consistentes. */
export function handleApiError(error: unknown, requestId: string) {
  if (error instanceof ApiAuthError) {
    return Response.json(
      {
        success: false,
        error: { code: error.code, message: error.message, ...(error.detail ? { details: error.detail } : {}) },
        request_id: requestId,
      },
      {
        status: error.status,
        headers: { "X-Request-ID": requestId, "Cache-Control": "no-store", ...(error.rateLimit ? rateLimitHeaders(error.rateLimit) : {}) },
      }
    );
  }

  if (error instanceof ZodError) {
    return apiError(
      "VALIDATION_ERROR",
      "Os dados enviados não são válidos.",
      400,
      requestId,
      error.issues.map((issue) => ({ campo: issue.path.join(".") || "(raiz)", problema: issue.message }))
    );
  }

  if (error instanceof ProviderNotConfiguredError) {
    return apiError(
      "PROVIDER_NOT_CONFIGURED",
      "Este provedor ainda não está configurado para pagamentos reais. Nenhum pagamento foi criado.",
      503,
      requestId
    );
  }

  const message = error instanceof Error ? error.message : "Erro inesperado.";
  console.error(`[nevon-pay][${requestId}]`, error);
  return apiError("INTERNAL_ERROR", "Não foi possível concluir o pedido.", 500, requestId, message);
}
