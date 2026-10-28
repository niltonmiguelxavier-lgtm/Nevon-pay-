const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string) {
  const max = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 100);
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_SECONDS || 60) * 1000;
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.reset <= now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { allowed: true };
  }

  current.count++;
  return { allowed: current.count <= max, remaining: Math.max(0, max - current.count) };
}
