import type { Context } from "hono";

export type Env = {
  DB: D1Database;
  RATE_LIMIT: KVNamespace;
  APP_ENV: string;
  DEFAULT_CURRENCY: string;
  SUPPORTED_CURRENCIES: string;
  CORS_ORIGINS: string;
  RATE_LIMIT_MAX_REQUESTS: string;
  RATE_LIMIT_WINDOW_SECONDS: string;
  ADMIN_TOKEN?: string;
};
export type Vars = { rid: string; merchantId?: string; environment?: string };
export type C = Context<{ Bindings: Env; Variables: Vars }>;

const hex = (b: ArrayBuffer | Uint8Array) =>
  [...new Uint8Array(b as ArrayBuffer)].map((x) => x.toString(16).padStart(2, "0")).join("");

export async function sha256(value: string) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}
export function randomHex(bytes: number) {
  return hex(crypto.getRandomValues(new Uint8Array(bytes)));
}
export const newId = (prefix = "") => prefix + crypto.randomUUID().replace(/-/g, "");
export const generateReference = (prefix = "NP") => `${prefix}_${Date.now()}_${randomHex(5)}`;
export const now = () => new Date().toISOString();

/** Decimal string/number -> centavos (INTEGER). */
export const toMinor = (n: number) => Math.round(n * 100);
export const fromMinor = (n: number) => (n / 100).toFixed(2);

export function ok(c: C, data: Record<string, unknown>, status = 200) {
  return c.json({ success: true, ...data, request_id: c.get("rid") }, status as 200);
}
export function fail(c: C, status: number, code: string, message: string) {
  return c.json({ success: false, error: { code, message }, request_id: c.get("rid") }, status as 400);
}

export const parseJson = (s: string | null) => {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
};

export async function audit(c: C, action: string, resource?: string, resourceId?: string, merchantId?: string, metadata?: unknown) {
  await c.env.DB.prepare(
    "INSERT INTO AuditLog (id, merchantId, action, resource, resourceId, requestId, metadata) VALUES (?,?,?,?,?,?,?)"
  ).bind(newId("aud_"), merchantId ?? null, action, resource ?? null, resourceId ?? null, c.get("rid"),
    metadata ? JSON.stringify(metadata) : null).run();
}

type PaymentRow = { id: string; amount: number; metadata: string | null; [k: string]: unknown };
export const presentPayment = (p: PaymentRow) => ({ ...p, amount: fromMinor(p.amount), metadata: parseJson(p.metadata) });
export const presentSession = (s: any) => ({
  ...s, amount: fromMinor(s.amount), customer: parseJson(s.customer), metadata: parseJson(s.metadata)
});
