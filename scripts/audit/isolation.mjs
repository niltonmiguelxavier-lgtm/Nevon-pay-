/**
 * Testes de isolamento entre comerciantes e de expiração de sessões.
 * Usa o PostgreSQL local para preparar fixtures e expirar sessões de forma
 * determinística (sem alterar código da aplicação).
 */
import { createRequire } from "node:module";
import crypto from "node:crypto";
import { writeFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { Client } = require("pg");

const BASE = "http://127.0.0.1:3000";
const DB = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/nevon";
const results = [];

function record(id, name, status, detail) {
  results.push({ id, name, status, detail });
  console.log(`${status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⚠️"} [${id}] ${name} — ${detail}`);
}
async function check(id, name, fn) {
  try {
    record(id, name, "PASS", await fn());
  } catch (error) {
    record(id, name, "FAIL", error instanceof Error ? error.message : String(error));
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");

async function api(method, path, { body, key } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

const client = new Client({ connectionString: DB });
await client.connect();

const stamp = Date.now();
const fixtures = [
  { suffix: "a", name: "Loja A (isolamento)" },
  { suffix: "b", name: "Loja B (isolamento)" },
];
const keys = {};

for (const fixture of fixtures) {
  const userId = `iso_user_${fixture.suffix}_${stamp}`;
  const merchantId = `iso_merchant_${fixture.suffix}_${stamp}`;
  const key = `nv_test_${crypto.randomBytes(24).toString("hex")}`;
  keys[fixture.suffix] = { key, merchantId, userId };

  await client.query(`INSERT INTO "User" (id, email, "updatedAt") VALUES ($1,$2,now())`, [
    userId,
    `iso.${fixture.suffix}.${stamp}@nevonpay.test`,
  ]);
  await client.query(`INSERT INTO "Merchant" (id, name, email, status, "updatedAt") VALUES ($1,$2,$3,'ACTIVE',now())`, [
    merchantId,
    fixture.name,
    `loja.${fixture.suffix}.${stamp}@nevonpay.test`,
  ]);
  await client.query(`INSERT INTO "MerchantUser" (id, "userId", "merchantId") VALUES ($1,$2,$3)`, [
    `iso_mu_${fixture.suffix}_${stamp}`,
    userId,
    merchantId,
  ]);
  await client.query(
    `INSERT INTO "ApiKey" (id, "merchantId", name, "keyHash", environment, active) VALUES ($1,$2,$3,$4,'TEST',true)`,
    [`iso_key_${fixture.suffix}_${stamp}`, merchantId, "Chave isolamento", hash(key)]
  );
}

let paymentA = null;
await check("S1", "Pagamento criado com a chave da Loja A", async () => {
  const r = await api("POST", "/api/v1/payments", { body: { amount: 100, provider: "sandbox" }, key: keys.a.key });
  assert(r.status === 201, `status ${r.status} ${JSON.stringify(r.body)}`);
  paymentA = r.body.payment;
  return `pagamento ${paymentA.reference}`;
});

await check("S2", "Loja B não consegue ler o pagamento da Loja A (404)", async () => {
  const r = await api("GET", `/api/v1/payments/${paymentA.id}`, { key: keys.b.key });
  assert(r.status === 404, `status ${r.status}`);
  return "404 NOT_FOUND";
});

await check("S3", "Loja B não consegue criar pagamento em nome da Loja A (403)", async () => {
  const r = await api("POST", "/api/v1/payments", {
    body: { amount: 50, merchantId: keys.a.merchantId },
    key: keys.b.key,
  });
  assert(r.status === 403, `status ${r.status}`);
  assert(r.body.error?.code === "MERCHANT_SCOPE_MISMATCH", JSON.stringify(r.body));
  return "403 MERCHANT_SCOPE_MISMATCH";
});

await check("S4", "Listagem da Loja B não inclui pagamentos da Loja A", async () => {
  const r = await api("GET", "/api/v1/payments", { key: keys.b.key });
  assert(r.status === 200, `status ${r.status}`);
  assert(r.body.data.every((p) => p.id !== paymentA.id), "pagamento de A visível para B");
  return `lista com ${r.body.data.length} pagamentos próprios`;
});

let sessionA = null;
await check("S5", "Sessão de checkout criada pela Loja A", async () => {
  const r = await api("POST", "/api/v1/checkout/session", { body: { amount: 300 }, key: keys.a.key });
  assert(r.status === 201, `status ${r.status}`);
  sessionA = r.body;
  return `sessão ${sessionA.session.id.slice(0, 8)}…`;
});

await check("S6", "Loja B não consegue cancelar a sessão da Loja A", async () => {
  const r = await api("POST", `/api/v1/checkout/session/${sessionA.session.id}/cancel`, {
    body: { cancel_token: "token-errado" },
    key: keys.b.key,
  });
  assert(r.status === 401, `status ${r.status}`);
  return "401 UNAUTHORIZED";
});

await check("S7", "Sessão expirada passa a EXPIRED na consulta", async () => {
  await client.query(`UPDATE "CheckoutSession" SET "expiresAt" = now() - interval '1 minute' WHERE id = $1`, [
    sessionA.session.id,
  ]);
  const r = await api("GET", `/api/v1/checkout/session/${sessionA.session.id}`);
  assert(r.status === 200, `status ${r.status}`);
  assert(r.body.session.status === "EXPIRED", `estado ${r.body.session.status}`);
  return "EXPIRED (sem chamada explícita de expiração)";
});

await check("S8", "Cancelar sessão expirada devolve 409", async () => {
  const r = await api("POST", `/api/v1/checkout/session/${sessionA.session.id}/cancel`, {
    body: { cancel_token: sessionA.cancel_token },
  });
  assert(r.status === 409, `status ${r.status}`);
  assert(r.body.error?.code === "SESSION_EXPIRED", JSON.stringify(r.body));
  return "409 SESSION_EXPIRED";
});

await check("S9", "Pagamento da sessão expirada também fica EXPIRED", async () => {
  const rows = await client.query(
    `SELECT p.status FROM "Payment" p JOIN "CheckoutSession" s ON s."paymentId" = p.id WHERE s.id = $1`,
    [sessionA.session.id]
  );
  assert(rows.rows[0].status === "EXPIRED", `estado ${rows.rows[0].status}`);
  return "Payment EXPIRED";
});

await check("S10", "Notificações foram criadas para os eventos", async () => {
  const rows = await client.query(`SELECT type, count(*) FROM "Notification" GROUP BY type ORDER BY type`);
  const types = rows.rows.map((r) => r.type);
  assert(types.includes("payment.created"), `tipos: ${types.join(",")}`);
  return types.join(", ");
});

await check("S11", "AuditLog registou criação de pagamentos", async () => {
  const rows = await client.query(`SELECT count(*)::int AS total FROM "AuditLog" WHERE action = 'payment.created'`);
  assert(rows.rows[0].total > 0, "sem registos");
  return `${rows.rows[0].total} registos auditados`;
});

await check("S12", "Sincronização Supabase → PostgreSQL mantém um único perfil por utilizador", async () => {
  const rows = await client.query(`SELECT email, count(*)::int AS total FROM "User" GROUP BY email HAVING count(*) > 1`);
  assert(rows.rowCount === 0, `emails duplicados: ${JSON.stringify(rows.rows)}`);
  const total = await client.query(`SELECT count(*)::int AS total FROM "User"`);
  return `${total.rows[0].total} perfis, sem duplicados`;
});

// limpeza das fixtures de isolamento
await client.query(`DELETE FROM "User" WHERE id LIKE 'iso_user_%'`);
await client.query(`DELETE FROM "Merchant" WHERE id LIKE 'iso_merchant_%'`);
await client.end();

writeFileSync("./audit-results-isolation.json", JSON.stringify({ results }, null, 2));
const failed = results.filter((r) => r.status === "FAIL");
console.log(`\nResumo isolamento/estado: ${results.length - failed.length}/${results.length} passaram.`);
if (failed.length) process.exitCode = 1;
