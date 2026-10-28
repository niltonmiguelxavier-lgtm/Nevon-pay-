import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import {
  Env, Vars, C, ok, fail, sha256, randomHex, newId, generateReference, toMinor, fromMinor,
  presentPayment, presentSession, audit, now
} from "./lib";
import { getProvider, ProviderNotConfiguredError } from "./providers";

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

// ---- request id + CORS + erros
app.use("*", async (c, next) => {
  c.set("rid", c.req.header("x-request-id") || crypto.randomUUID());
  await next();
  c.res.headers.set("X-Request-ID", c.get("rid"));
});
app.use("*", (c, next) =>
  cors({
    origin: (origin) => (c.env.CORS_ORIGINS || "").split(",").map((s) => s.trim()).includes(origin) ? origin : "",
    allowHeaders: ["Content-Type", "Authorization", "Idempotency-Key", "X-Request-ID"],
    allowMethods: ["GET", "POST", "OPTIONS"]
  })(c, next)
);
app.onError((e, c) => {
  console.error(e);
  return fail(c, 500, "INTERNAL_ERROR", "Erro interno.");
});
app.notFound((c) => fail(c, 404, "NOT_FOUND", "Rota não encontrada."));

// ---- rate limit (KV, janela fixa; aproximado por natureza do KV)
app.use("/v1/*", async (c, next) => {
  const max = Number(c.env.RATE_LIMIT_MAX_REQUESTS || 100);
  const win = Number(c.env.RATE_LIMIT_WINDOW_SECONDS || 60);
  const ip = c.req.header("cf-connecting-ip") || "unknown";
  const key = `rl:${ip}:${Math.floor(Date.now() / 1000 / win)}`;
  const count = Number((await c.env.RATE_LIMIT.get(key)) || 0) + 1;
  if (count > max) return fail(c, 429, "RATE_LIMITED", "Demasiados pedidos.");
  await c.env.RATE_LIMIT.put(key, String(count), { expirationTtl: Math.max(60, win * 2) });
  await next();
});

// ---- autenticação
async function adminAuth(c: C, next: () => Promise<void>) {
  const token = c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!c.env.ADMIN_TOKEN || !token || (await sha256(token)) !== (await sha256(c.env.ADMIN_TOKEN))) {
    return fail(c, 401, "UNAUTHORIZED", "Token de administração inválido.");
  }
  await next();
}
async function apiKeyAuth(c: C, next: () => Promise<void>) {
  const key = c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!key) return fail(c, 401, "UNAUTHORIZED", "Chave de API em falta (Authorization: Bearer nv_...).");
  const row = await c.env.DB.prepare(
    "SELECT a.merchantId, a.environment, m.status FROM ApiKey a JOIN Merchant m ON m.id=a.merchantId WHERE a.keyHash=? AND a.active=1"
  ).bind(await sha256(key)).first<{ merchantId: string; environment: string; status: string }>();
  if (!row) return fail(c, 401, "UNAUTHORIZED", "Chave de API inválida.");
  if (row.status === "SUSPENDED") return fail(c, 403, "MERCHANT_SUSPENDED", "Comerciante suspenso.");
  c.set("merchantId", row.merchantId);
  c.set("environment", row.environment);
  await next();
}

// ---- health
app.get("/health", async (c) => {
  try {
    await c.env.DB.prepare("SELECT 1").first();
    return ok(c, { application: "healthy", database: "healthy", database_provider: "cloudflare-d1", environment: c.env.APP_ENV });
  } catch {
    return fail(c, 503, "DB_UNAVAILABLE", "Base de dados indisponível.");
  }
});

// ---- comerciantes (admin)
const merchantSchema = z.object({ name: z.string().min(2), email: z.string().email() });
app.post("/v1/merchants", adminAuth, async (c) => {
  const parsed = merchantSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 400, "VALIDATION_ERROR", parsed.error.issues[0].message);
  const id = newId("mer_");
  await c.env.DB.prepare("INSERT INTO Merchant (id,name,email) VALUES (?,?,?)").bind(id, parsed.data.name, parsed.data.email).run();
  await audit(c, "merchant.create", "Merchant", id, id);
  const merchant = await c.env.DB.prepare("SELECT * FROM Merchant WHERE id=?").bind(id).first();
  return ok(c, { merchant }, 201);
});
app.get("/v1/merchants/:id", adminAuth, async (c) => {
  const merchant = await c.env.DB.prepare("SELECT * FROM Merchant WHERE id=?").bind(c.req.param("id")).first();
  return merchant ? ok(c, { merchant }) : fail(c, 404, "MERCHANT_NOT_FOUND", "Comerciante não encontrado.");
});
app.post("/v1/merchants/:id/status", adminAuth, async (c) => {
  const p = z.object({ status: z.enum(["PENDING", "ACTIVE", "SUSPENDED"]) }).safeParse(await c.req.json().catch(() => null));
  if (!p.success) return fail(c, 400, "VALIDATION_ERROR", p.error.issues[0].message);
  const r = await c.env.DB.prepare("UPDATE Merchant SET status=?, updatedAt=? WHERE id=?").bind(p.data.status, now(), c.req.param("id")).run();
  if (!r.meta.changes) return fail(c, 404, "MERCHANT_NOT_FOUND", "Comerciante não encontrado.");
  await audit(c, "merchant.status", "Merchant", c.req.param("id"), c.req.param("id"), p.data);
  return ok(c, { status: p.data.status });
});

// ---- chaves de API (admin cria; o segredo só é mostrado uma vez)
app.post("/v1/merchants/:id/api-keys", adminAuth, async (c) => {
  const p = z.object({ name: z.string().min(1).default("default"), environment: z.enum(["TEST", "LIVE"]).default("TEST") })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!p.success) return fail(c, 400, "VALIDATION_ERROR", p.error.issues[0].message);
  const mid = c.req.param("id");
  const m = await c.env.DB.prepare("SELECT id, status FROM Merchant WHERE id=?").bind(mid).first<{ status: string }>();
  if (!m) return fail(c, 404, "MERCHANT_NOT_FOUND", "Comerciante não encontrado.");
  if (p.data.environment === "LIVE" && c.env.APP_ENV !== "production")
    return fail(c, 400, "LIVE_DISABLED", "Chaves LIVE só em produção.");
  const key = `nv_${p.data.environment === "LIVE" ? "live" : "test"}_${randomHex(24)}`;
  const id = newId("key_");
  await c.env.DB.prepare("INSERT INTO ApiKey (id,merchantId,name,keyHash,keyPrefix,environment) VALUES (?,?,?,?,?,?)")
    .bind(id, mid, p.data.name, await sha256(key), key.slice(0, 12), p.data.environment).run();
  await audit(c, "apikey.create", "ApiKey", id, mid);
  return ok(c, { api_key: { id, key, environment: p.data.environment, note: "Guarde esta chave; não será mostrada novamente." } }, 201);
});
app.post("/v1/api-keys/:id/revoke", adminAuth, async (c) => {
  const r = await c.env.DB.prepare("UPDATE ApiKey SET active=0 WHERE id=?").bind(c.req.param("id")).run();
  return r.meta.changes ? ok(c, { revoked: true }) : fail(c, 404, "NOT_FOUND", "Chave não encontrada.");
});

// ---- pagamentos (chave de API)
const CURRENCIES = (c: C) => (c.env.SUPPORTED_CURRENCIES || "MZN").split(",");
const paymentSchema = z.object({
  amount: z.coerce.number().positive().max(1_000_000_000),
  currency: z.string().length(3).optional(),
  provider: z.enum(["sandbox", "mpesa", "emola"]).default("sandbox"),
  metadata: z.record(z.any()).optional()
});

app.post("/v1/payments", apiKeyAuth, async (c) => {
  const p = paymentSchema.safeParse(await c.req.json().catch(() => null));
  if (!p.success) return fail(c, 400, "VALIDATION_ERROR", p.error.issues[0].message);
  const currency = (p.data.currency || c.env.DEFAULT_CURRENCY || "MZN").toUpperCase();
  if (!CURRENCIES(c).includes(currency)) return fail(c, 400, "UNSUPPORTED_CURRENCY", "Moeda não suportada.");
  const merchantId = c.get("merchantId")!;
  const idem = c.req.header("idempotency-key") || null;
  if (idem) {
    const prev = await c.env.DB.prepare("SELECT * FROM Payment WHERE merchantId=? AND idempotencyKey=?").bind(merchantId, idem).first<any>();
    if (prev) return ok(c, { payment: presentPayment(prev), idempotent_replay: true });
  }
  let provider;
  try { provider = getProvider(p.data.provider); }
  catch (e) {
    if (e instanceof ProviderNotConfiguredError)
      return fail(c, 503, "PROVIDER_NOT_CONFIGURED", "Este provedor ainda não está configurado para pagamentos reais.");
    throw e;
  }
  const minor = toMinor(p.data.amount);
  const reference = generateReference("PAY");
  const result = await provider.createPayment({ amount: fromMinor(minor), currency, reference });
  const id = newId("pay_");
  await c.env.DB.prepare(
    "INSERT INTO Payment (id,merchantId,amount,currency,status,reference,provider,providerRef,idempotencyKey,metadata) VALUES (?,?,?,?,?,?,?,?,?,?)"
  ).bind(id, merchantId, minor, currency, result.status, reference, provider.name, result.providerRef, idem,
    p.data.metadata ? JSON.stringify(p.data.metadata) : null).run();
  await audit(c, "payment.create", "Payment", id, merchantId);
  const row = await c.env.DB.prepare("SELECT * FROM Payment WHERE id=?").bind(id).first<any>();
  return ok(c, { payment: presentPayment(row) }, 201);
});

app.get("/v1/payments", apiKeyAuth, async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 20), 100);
  const { results } = await c.env.DB.prepare("SELECT * FROM Payment WHERE merchantId=? ORDER BY createdAt DESC LIMIT ?")
    .bind(c.get("merchantId"), limit).all<any>();
  return ok(c, { payments: results.map(presentPayment) });
});
app.get("/v1/payments/:id", apiKeyAuth, async (c) => {
  const row = await c.env.DB.prepare("SELECT * FROM Payment WHERE id=? AND merchantId=?").bind(c.req.param("id"), c.get("merchantId")).first<any>();
  return row ? ok(c, { payment: presentPayment(row) }) : fail(c, 404, "NOT_FOUND", "Pagamento não encontrado.");
});

// ---- checkout sessions
const sessionSchema = z.object({
  amount: z.coerce.number().positive().max(1_000_000_000),
  currency: z.string().length(3).optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  customer: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional()
});

app.post("/v1/checkout/sessions", apiKeyAuth, async (c) => {
  const p = sessionSchema.safeParse(await c.req.json().catch(() => null));
  if (!p.success) return fail(c, 400, "VALIDATION_ERROR", p.error.issues[0].message);
  const currency = (p.data.currency || c.env.DEFAULT_CURRENCY || "MZN").toUpperCase();
  if (!CURRENCIES(c).includes(currency)) return fail(c, 400, "UNSUPPORTED_CURRENCY", "Moeda não suportada.");
  const merchantId = c.get("merchantId")!;
  const minor = toMinor(p.data.amount);
  const payId = newId("pay_");
  const sesId = newId("cs_");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO Payment (id,merchantId,amount,currency,status,reference,metadata) VALUES (?,?,?,?, 'PENDING',?,?)")
      .bind(payId, merchantId, minor, currency, generateReference("PAY"), p.data.metadata ? JSON.stringify(p.data.metadata) : null),
    c.env.DB.prepare("INSERT INTO CheckoutSession (id,merchantId,paymentId,amount,currency,customer,metadata,successUrl,cancelUrl,expiresAt) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .bind(sesId, merchantId, payId, minor, currency, p.data.customer ? JSON.stringify(p.data.customer) : null,
        p.data.metadata ? JSON.stringify(p.data.metadata) : null, p.data.successUrl ?? null, p.data.cancelUrl ?? null, expiresAt)
  ]);
  await audit(c, "checkout.create", "CheckoutSession", sesId, merchantId);
  const row = await c.env.DB.prepare("SELECT * FROM CheckoutSession WHERE id=?").bind(sesId).first<any>();
  return ok(c, { session: presentSession(row), checkout_url: `/checkout/${sesId}` }, 201);
});

async function loadSession(c: C, id: string, merchantId?: string) {
  const row = await c.env.DB.prepare(
    merchantId ? "SELECT * FROM CheckoutSession WHERE id=? AND merchantId=?" : "SELECT * FROM CheckoutSession WHERE id=?"
  ).bind(...(merchantId ? [id, merchantId] : [id])).first<any>();
  if (row && row.status === "OPEN" && row.expiresAt < now()) {
    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE CheckoutSession SET status='EXPIRED' WHERE id=?").bind(id),
      c.env.DB.prepare("UPDATE Payment SET status='EXPIRED', updatedAt=? WHERE id=?").bind(now(), row.paymentId)
    ]);
    row.status = "EXPIRED";
  }
  return row;
}

app.get("/v1/checkout/sessions/:id", apiKeyAuth, async (c) => {
  const row = await loadSession(c, c.req.param("id"), c.get("merchantId"));
  return row ? ok(c, { session: presentSession(row) }) : fail(c, 404, "NOT_FOUND", "Checkout não encontrado.");
});
app.post("/v1/checkout/sessions/:id/cancel", apiKeyAuth, async (c) => {
  const row = await loadSession(c, c.req.param("id"), c.get("merchantId"));
  if (!row) return fail(c, 404, "NOT_FOUND", "Checkout não encontrado.");
  if (!["OPEN", "PENDING"].includes(row.status)) return fail(c, 409, "INVALID_STATE", `Não é possível cancelar um checkout ${row.status}.`);
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE CheckoutSession SET status='CANCELLED' WHERE id=?").bind(row.id),
    c.env.DB.prepare("UPDATE Payment SET status='CANCELLED', updatedAt=? WHERE id=?").bind(now(), row.paymentId)
  ]);
  await audit(c, "checkout.cancel", "CheckoutSession", row.id, row.merchantId);
  return ok(c, { session: presentSession({ ...row, status: "CANCELLED" }) });
});

// ---- página pública de checkout (só leitura; o ID da sessão é o segredo)
const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));
app.get("/checkout/:id", async (c) => {
  const row = await loadSession(c, c.req.param("id"));
  if (!row) return c.html("<h1>Checkout não encontrado</h1>", 404);
  const m = await c.env.DB.prepare("SELECT name FROM Merchant WHERE id=?").bind(row.merchantId).first<{ name: string }>();
  return c.html(`<!doctype html><html lang="pt"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Nevon Pay</title><body style="font-family:system-ui;max-width:420px;margin:12vh auto;padding:0 16px">
<h1>${esc(m?.name ?? "")}</h1><p style="color:#666">Pagamento Nevon Pay</p>
<h2>${fromMinor(row.amount)} ${esc(row.currency)}</h2><p>Estado: ${esc(row.status)}</p>
<p style="color:#666">Os métodos de pagamento reais serão activados através dos provedores oficiais configurados.</p></body></html>`);
});

export default app;
