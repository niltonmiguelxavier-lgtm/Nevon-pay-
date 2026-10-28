// Nevon Pay API — Worker de ficheiro único (sem dependências).
// Bindings necessários: DB (D1 nevon-pay-db), RATE_LIMIT (KV), secret ADMIN_TOKEN.
// Variáveis opcionais: APP_ENV, DEFAULT_CURRENCY, SUPPORTED_CURRENCIES, CORS_ORIGINS,
// RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_SECONDS.

const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const sha256 = async (s) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
const randomHex = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));
const newId = (p = "") => p + crypto.randomUUID().replace(/-/g, "");
const ref = (p = "NP") => `${p}_${Date.now()}_${randomHex(5)}`;
const now = () => new Date().toISOString();
const toMinor = (n) => Math.round(n * 100);
const fromMinor = (n) => (n / 100).toFixed(2);
const parse = (s) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const isEmail = (s) => typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const isUrl = (s) => { try { return ["http:", "https:"].includes(new URL(s).protocol); } catch { return false; } };
const isObj = (o) => o && typeof o === "object" && !Array.isArray(o);

class HttpError extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } }
const bad = (m) => new HttpError(400, "VALIDATION_ERROR", m);

function reply(ctx, data, status = 200) {
  const body = data.error ? { success: false, ...data } : { success: true, ...data };
  return new Response(JSON.stringify({ ...body, request_id: ctx.rid }), {
    status, headers: { "content-type": "application/json", "x-request-id": ctx.rid, ...ctx.cors }
  });
}
const err = (ctx, status, code, message) => reply(ctx, { error: { code, message } }, status);

const presentPayment = (p) => ({ ...p, amount: fromMinor(p.amount), metadata: parse(p.metadata) });
const presentSession = (s) => ({ ...s, amount: fromMinor(s.amount), customer: parse(s.customer), metadata: parse(s.metadata) });

async function body(req) {
  let j; try { j = await req.json(); } catch { throw bad("JSON inválido."); }
  if (!isObj(j)) throw bad("O corpo deve ser um objecto JSON.");
  return j;
}
function amountOf(j) {
  const n = Number(j.amount);
  if (!Number.isFinite(n) || n <= 0 || n > 1e9) throw bad("amount deve ser um número positivo.");
  return toMinor(n);
}
function currencyOf(j, env) {
  const c = String(j.currency || env.DEFAULT_CURRENCY || "MZN").toUpperCase();
  if (c.length !== 3) throw bad("currency deve ter 3 letras.");
  if (!(env.SUPPORTED_CURRENCIES || "MZN,USD,EUR,ZAR").split(",").includes(c))
    throw new HttpError(400, "UNSUPPORTED_CURRENCY", "Moeda não suportada.");
  return c;
}

async function audit(ctx, action, resource, resourceId, merchantId) {
  await ctx.env.DB.prepare("INSERT INTO AuditLog (id,merchantId,action,resource,resourceId,requestId) VALUES (?,?,?,?,?,?)")
    .bind(newId("aud_"), merchantId ?? null, action, resource ?? null, resourceId ?? null, ctx.rid).run();
}

// ---- autenticação
async function requireAdmin(ctx) {
  const t = ctx.req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!ctx.env.ADMIN_TOKEN || !t || (await sha256(t)) !== (await sha256(ctx.env.ADMIN_TOKEN)))
    throw new HttpError(401, "UNAUTHORIZED", "Token de administração inválido.");
}
async function requireKey(ctx) {
  const k = ctx.req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!k) throw new HttpError(401, "UNAUTHORIZED", "Chave de API em falta (Authorization: Bearer nv_...).");
  const row = await ctx.env.DB.prepare(
    "SELECT a.merchantId, a.environment, m.status FROM ApiKey a JOIN Merchant m ON m.id=a.merchantId WHERE a.keyHash=? AND a.active=1"
  ).bind(await sha256(k)).first();
  if (!row) throw new HttpError(401, "UNAUTHORIZED", "Chave de API inválida.");
  if (row.status === "SUSPENDED") throw new HttpError(403, "MERCHANT_SUSPENDED", "Comerciante suspenso.");
  ctx.merchantId = row.merchantId;
}
async function rateLimit(ctx) {
  const max = Number(ctx.env.RATE_LIMIT_MAX_REQUESTS || 100), win = Number(ctx.env.RATE_LIMIT_WINDOW_SECONDS || 60);
  if (!ctx.env.RATE_LIMIT) return;
  const ip = ctx.req.headers.get("cf-connecting-ip") || "unknown";
  const key = `rl:${ip}:${Math.floor(Date.now() / 1000 / win)}`;
  const n = Number((await ctx.env.RATE_LIMIT.get(key)) || 0) + 1;
  if (n > max) throw new HttpError(429, "RATE_LIMITED", "Demasiados pedidos.");
  await ctx.env.RATE_LIMIT.put(key, String(n), { expirationTtl: Math.max(60, win * 2) });
}

// ---- provedores (só sandbox até haver adaptadores oficiais)
const providers = {
  sandbox: { name: "sandbox", create: async (i) => ({ status: "PENDING", providerRef: `sandbox_${i.reference}` }) }
};

async function loadSession(ctx, id, merchantId) {
  const row = merchantId
    ? await ctx.env.DB.prepare("SELECT * FROM CheckoutSession WHERE id=? AND merchantId=?").bind(id, merchantId).first()
    : await ctx.env.DB.prepare("SELECT * FROM CheckoutSession WHERE id=?").bind(id).first();
  if (row && row.status === "OPEN" && row.expiresAt < now()) {
    await ctx.env.DB.batch([
      ctx.env.DB.prepare("UPDATE CheckoutSession SET status='EXPIRED' WHERE id=?").bind(id),
      ctx.env.DB.prepare("UPDATE Payment SET status='EXPIRED', updatedAt=? WHERE id=?").bind(now(), row.paymentId)
    ]);
    row.status = "EXPIRED";
  }
  return row;
}

// ---- rotas
const routes = [];
const add = (method, pattern, handler) =>
  routes.push({ method, re: new RegExp("^" + pattern.replace(/:(\w+)/g, "(?<$1>[^/]+)") + "$"), handler });

add("GET", "/health", async (ctx) => {
  try { await ctx.env.DB.prepare("SELECT 1").first(); }
  catch { return err(ctx, 503, "DB_UNAVAILABLE", "Base de dados indisponível."); }
  return reply(ctx, { application: "healthy", database: "healthy", database_provider: "cloudflare-d1", environment: ctx.env.APP_ENV || "sandbox" });
});

add("POST", "/v1/merchants", async (ctx) => {
  await requireAdmin(ctx);
  const j = await body(ctx.req);
  if (typeof j.name !== "string" || j.name.trim().length < 2) throw bad("name deve ter pelo menos 2 caracteres.");
  if (!isEmail(j.email)) throw bad("email inválido.");
  const id = newId("mer_");
  await ctx.env.DB.prepare("INSERT INTO Merchant (id,name,email) VALUES (?,?,?)").bind(id, j.name.trim(), j.email).run();
  await audit(ctx, "merchant.create", "Merchant", id, id);
  return reply(ctx, { merchant: await ctx.env.DB.prepare("SELECT * FROM Merchant WHERE id=?").bind(id).first() }, 201);
});
add("GET", "/v1/merchants/:id", async (ctx) => {
  await requireAdmin(ctx);
  const m = await ctx.env.DB.prepare("SELECT * FROM Merchant WHERE id=?").bind(ctx.p.id).first();
  return m ? reply(ctx, { merchant: m }) : err(ctx, 404, "MERCHANT_NOT_FOUND", "Comerciante não encontrado.");
});
add("POST", "/v1/merchants/:id/status", async (ctx) => {
  await requireAdmin(ctx);
  const j = await body(ctx.req);
  if (!["PENDING", "ACTIVE", "SUSPENDED"].includes(j.status)) throw bad("status inválido.");
  const r = await ctx.env.DB.prepare("UPDATE Merchant SET status=?, updatedAt=? WHERE id=?").bind(j.status, now(), ctx.p.id).run();
  if (!r.meta.changes) return err(ctx, 404, "MERCHANT_NOT_FOUND", "Comerciante não encontrado.");
  await audit(ctx, "merchant.status", "Merchant", ctx.p.id, ctx.p.id);
  return reply(ctx, { status: j.status });
});
add("POST", "/v1/merchants/:id/api-keys", async (ctx) => {
  await requireAdmin(ctx);
  const j = ctx.req.headers.get("content-length") === "0" ? {} : await body(ctx.req).catch(() => ({}));
  const env = j.environment === "LIVE" ? "LIVE" : "TEST";
  if (env === "LIVE" && ctx.env.APP_ENV !== "production") throw new HttpError(400, "LIVE_DISABLED", "Chaves LIVE só em produção.");
  const m = await ctx.env.DB.prepare("SELECT id FROM Merchant WHERE id=?").bind(ctx.p.id).first();
  if (!m) return err(ctx, 404, "MERCHANT_NOT_FOUND", "Comerciante não encontrado.");
  const key = `nv_${env === "LIVE" ? "live" : "test"}_${randomHex(24)}`, id = newId("key_");
  await ctx.env.DB.prepare("INSERT INTO ApiKey (id,merchantId,name,keyHash,keyPrefix,environment) VALUES (?,?,?,?,?,?)")
    .bind(id, ctx.p.id, String(j.name || "default"), await sha256(key), key.slice(0, 12), env).run();
  await audit(ctx, "apikey.create", "ApiKey", id, ctx.p.id);
  return reply(ctx, { api_key: { id, key, environment: env, note: "Guarde esta chave; não será mostrada novamente." } }, 201);
});
add("POST", "/v1/api-keys/:id/revoke", async (ctx) => {
  await requireAdmin(ctx);
  const r = await ctx.env.DB.prepare("UPDATE ApiKey SET active=0 WHERE id=?").bind(ctx.p.id).run();
  return r.meta.changes ? reply(ctx, { revoked: true }) : err(ctx, 404, "NOT_FOUND", "Chave não encontrada.");
});

add("POST", "/v1/payments", async (ctx) => {
  await requireKey(ctx);
  const j = await body(ctx.req);
  const minor = amountOf(j), currency = currencyOf(j, ctx.env);
  const pname = j.provider || "sandbox";
  if (!["sandbox", "mpesa", "emola"].includes(pname)) throw bad("provider inválido.");
  if (j.metadata !== undefined && !isObj(j.metadata)) throw bad("metadata deve ser um objecto.");
  const idem = ctx.req.headers.get("idempotency-key");
  if (idem) {
    const prev = await ctx.env.DB.prepare("SELECT * FROM Payment WHERE merchantId=? AND idempotencyKey=?").bind(ctx.merchantId, idem).first();
    if (prev) return reply(ctx, { payment: presentPayment(prev), idempotent_replay: true });
  }
  const provider = providers[pname];
  if (!provider) return err(ctx, 503, "PROVIDER_NOT_CONFIGURED", "Este provedor ainda não está configurado para pagamentos reais.");
  const reference = ref("PAY");
  const res = await provider.create({ amount: fromMinor(minor), currency, reference });
  const id = newId("pay_");
  await ctx.env.DB.prepare("INSERT INTO Payment (id,merchantId,amount,currency,status,reference,provider,providerRef,idempotencyKey,metadata) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .bind(id, ctx.merchantId, minor, currency, res.status, reference, provider.name, res.providerRef, idem, j.metadata ? JSON.stringify(j.metadata) : null).run();
  await audit(ctx, "payment.create", "Payment", id, ctx.merchantId);
  return reply(ctx, { payment: presentPayment(await ctx.env.DB.prepare("SELECT * FROM Payment WHERE id=?").bind(id).first()) }, 201);
});
add("GET", "/v1/payments", async (ctx) => {
  await requireKey(ctx);
  const limit = Math.min(Math.max(Number(new URL(ctx.req.url).searchParams.get("limit")) || 20, 1), 100);
  const { results } = await ctx.env.DB.prepare("SELECT * FROM Payment WHERE merchantId=? ORDER BY createdAt DESC LIMIT ?").bind(ctx.merchantId, limit).all();
  return reply(ctx, { payments: results.map(presentPayment) });
});
add("GET", "/v1/payments/:id", async (ctx) => {
  await requireKey(ctx);
  const p = await ctx.env.DB.prepare("SELECT * FROM Payment WHERE id=? AND merchantId=?").bind(ctx.p.id, ctx.merchantId).first();
  return p ? reply(ctx, { payment: presentPayment(p) }) : err(ctx, 404, "NOT_FOUND", "Pagamento não encontrado.");
});

add("POST", "/v1/checkout/sessions", async (ctx) => {
  await requireKey(ctx);
  const j = await body(ctx.req);
  const minor = amountOf(j), currency = currencyOf(j, ctx.env);
  for (const k of ["successUrl", "cancelUrl"]) if (j[k] !== undefined && !isUrl(j[k])) throw bad(`${k} inválido.`);
  for (const k of ["customer", "metadata"]) if (j[k] !== undefined && !isObj(j[k])) throw bad(`${k} deve ser um objecto.`);
  const payId = newId("pay_"), sesId = newId("cs_");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const meta = j.metadata ? JSON.stringify(j.metadata) : null;
  await ctx.env.DB.batch([
    ctx.env.DB.prepare("INSERT INTO Payment (id,merchantId,amount,currency,status,reference,metadata) VALUES (?,?,?,?, 'PENDING',?,?)")
      .bind(payId, ctx.merchantId, minor, currency, ref("PAY"), meta),
    ctx.env.DB.prepare("INSERT INTO CheckoutSession (id,merchantId,paymentId,amount,currency,customer,metadata,successUrl,cancelUrl,expiresAt) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .bind(sesId, ctx.merchantId, payId, minor, currency, j.customer ? JSON.stringify(j.customer) : null, meta, j.successUrl ?? null, j.cancelUrl ?? null, expiresAt)
  ]);
  await audit(ctx, "checkout.create", "CheckoutSession", sesId, ctx.merchantId);
  const s = await ctx.env.DB.prepare("SELECT * FROM CheckoutSession WHERE id=?").bind(sesId).first();
  return reply(ctx, { session: presentSession(s), checkout_url: `/checkout/${sesId}` }, 201);
});
add("GET", "/v1/checkout/sessions/:id", async (ctx) => {
  await requireKey(ctx);
  const s = await loadSession(ctx, ctx.p.id, ctx.merchantId);
  return s ? reply(ctx, { session: presentSession(s) }) : err(ctx, 404, "NOT_FOUND", "Checkout não encontrado.");
});
add("POST", "/v1/checkout/sessions/:id/cancel", async (ctx) => {
  await requireKey(ctx);
  const s = await loadSession(ctx, ctx.p.id, ctx.merchantId);
  if (!s) return err(ctx, 404, "NOT_FOUND", "Checkout não encontrado.");
  if (!["OPEN", "PENDING"].includes(s.status)) return err(ctx, 409, "INVALID_STATE", `Não é possível cancelar um checkout ${s.status}.`);
  await ctx.env.DB.batch([
    ctx.env.DB.prepare("UPDATE CheckoutSession SET status='CANCELLED' WHERE id=?").bind(s.id),
    ctx.env.DB.prepare("UPDATE Payment SET status='CANCELLED', updatedAt=? WHERE id=?").bind(now(), s.paymentId)
  ]);
  await audit(ctx, "checkout.cancel", "CheckoutSession", s.id, s.merchantId);
  return reply(ctx, { session: presentSession({ ...s, status: "CANCELLED" }) });
});

add("GET", "/checkout/:id", async (ctx) => {
  const s = await loadSession(ctx, ctx.p.id);
  const html = (b, st) => new Response(b, { status: st, headers: { "content-type": "text/html; charset=utf-8" } });
  if (!s) return html("<h1>Checkout não encontrado</h1>", 404);
  const m = await ctx.env.DB.prepare("SELECT name FROM Merchant WHERE id=?").bind(s.merchantId).first();
  return html(`<!doctype html><html lang="pt"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nevon Pay</title>
<body style="font-family:system-ui;max-width:420px;margin:12vh auto;padding:0 16px"><h1>${esc(m?.name ?? "")}</h1><p style="color:#666">Pagamento Nevon Pay</p>
<h2>${fromMinor(s.amount)} ${esc(s.currency)}</h2><p>Estado: ${esc(s.status)}</p>
<p style="color:#666">Os métodos de pagamento reais serão activados através dos provedores oficiais configurados.</p></body></html>`, 200);
});

export default {
  async fetch(req, env) {
    const ctx = { req, env, rid: req.headers.get("x-request-id") || crypto.randomUUID(), cors: {}, p: {} };
    const origin = req.headers.get("origin");
    if (origin && (env.CORS_ORIGINS || "").split(",").map((s) => s.trim()).includes(origin))
      ctx.cors = { "access-control-allow-origin": origin, vary: "origin" };
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers: { ...ctx.cors, "access-control-allow-headers": "Content-Type, Authorization, Idempotency-Key, X-Request-ID", "access-control-allow-methods": "GET, POST, OPTIONS" } });
    try {
      const path = new URL(req.url).pathname.replace(/\/+$/, "") || "/";
      if (path.startsWith("/v1/")) await rateLimit(ctx);
      for (const r of routes) {
        const m = r.method === req.method && path.match(r.re);
        if (m) { ctx.p = m.groups || {}; return await r.handler(ctx); }
      }
      return err(ctx, 404, "NOT_FOUND", "Rota não encontrada.");
    } catch (e) {
      if (e instanceof HttpError) return err(ctx, e.status, e.code, e.message);
      console.error(e);
      return err(ctx, 500, "INTERNAL_ERROR", "Erro interno.");
    }
  }
};
