export function requestId(req: Request) {
  return req.headers.get("x-request-id") || crypto.randomUUID();
}

export type ApiErrorBody = {
  success: false;
  error: { code: string; message: string; details?: unknown };
  request_id: string;
};

export type ApiSuccessBody<T> = { success: true; request_id: string } & T;

export function mobileCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, X-Request-ID, Idempotency-Key, X-API-Key",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  };
}

export function corsPreflight(methods = "GET, POST, PATCH, DELETE, OPTIONS") {
  return new Response(null, {
    status: 204,
    headers: {
      ...mobileCorsHeaders(),
      "Access-Control-Allow-Methods": methods,
      Allow: methods,
    },
  });
}

/**
 * Resposta JSON uniforme. Mantém o formato `{ success, ... , request_id }`
 * usado pela aplicação, mas sem a lógica anterior que inferia `success`
 * a partir do status HTTP e podia contradizer o corpo da resposta.
 */
export function json(data: Record<string, unknown>, status = 200, reqIdent?: string) {
  const request_id = reqIdent || crypto.randomUUID();
  const success = (data as { success?: boolean }).success ?? status < 400;
  return Response.json(
    { ...data, success, request_id },
    {
      status,
      headers: {
        "X-Request-ID": request_id,
        "Cache-Control": "no-store",
        ...mobileCorsHeaders(),
      },
    }
  );
}

export function apiError(
  code: string,
  message: string,
  status: number,
  reqIdent?: string,
  details?: unknown
) {
  return json({ success: false, error: { code, message, ...(details ? { details } : {}) } }, status, reqIdent);
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

/**
 * Origem pública do pedido.
 *
 * O `new URL(request.url)` em produção atrás de proxy (Vercel, Replit, túneis)
 * pode devolver o endereço interno do servidor (ex.: 0.0.0.0:3000). Redireccionar
 * para esse endereço muda a origem da página e os cookies de sessão deixam de ser
 * enviados — foi exactamente o que aconteceu no callback de recuperação de
 * palavra-passe durante os testes. Preferimos os cabeçalhos do proxy.
 */
export function requestOrigin(request: Request): string {
  const headers = request.headers;
  const forwardedHost = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || headers.get("host") || new URL(request.url).host;
  const forwardedProto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto || (new URL(request.url).protocol === "https:" ? "https" : "http");
  return `${protocol}://${host}`;
}

export function absoluteUrl(request: Request, pathname: string, query?: Record<string, string>) {
  const url = new URL(pathname, requestOrigin(request));
  if (query) for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url;
}
