/**
 * Limitador de pedidos em memória.
 *
 * Nota: por processo. Em ambiente serverless com múltiplas instâncias o limite
 * é aproximado; para limites globais é necessário Redis/Upstash. Esta limitação
 * está documentada no relatório da auditoria.
 */
type Bucket = { count: number; reset: number };

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number) {
  // Evita crescimento indefinido do mapa (o código anterior nunca expirava entradas).
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.reset <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

export function rateLimit(key: string, options?: { max?: number; windowSeconds?: number }): RateLimitResult {
  const max = options?.max ?? Number(process.env.RATE_LIMIT_MAX_REQUESTS || 100);
  const windowSeconds = options?.windowSeconds ?? Number(process.env.RATE_LIMIT_WINDOW_SECONDS || 60);
  const windowMs = windowSeconds * 1000;
  const now = Date.now();
  sweep(now);

  const current = buckets.get(key);
  if (!current || current.reset <= now) {
    const bucket = { count: 1, reset: now + windowMs };
    buckets.set(key, bucket);
    return {
      allowed: true,
      limit: max,
      remaining: Math.max(0, max - 1),
      resetAt: bucket.reset,
      retryAfterSeconds: windowSeconds,
    };
  }

  current.count += 1;
  return {
    allowed: current.count <= max,
    limit: max,
    remaining: Math.max(0, max - current.count),
    resetAt: current.reset,
    retryAfterSeconds: Math.max(1, Math.ceil((current.reset - now) / 1000)),
  };
}

/** Identifica o cliente para efeitos de limite (proxy-aware). */
export function clientKey(req: Request, scope: string) {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return `${scope}:${ip}`;
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    ...(result.allowed ? {} : { "Retry-After": String(result.retryAfterSeconds) }),
  };
}
