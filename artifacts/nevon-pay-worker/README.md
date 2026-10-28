# Nevon Pay API (Cloudflare Worker + D1)

Worker `nevon-pay-api` (Hono) ligado à base D1 `nevon-pay-db` e ao KV `nevon-pay-ratelimit` (ids em `wrangler.toml`).
O schema já foi aplicado na D1 (`migrations/0001_init.sql`). Valores monetários guardados em centavos (INTEGER) e expostos como string decimal.

## Deploy
```bash
npm install
npx wrangler login            # ou CLOUDFLARE_API_TOKEN
npx wrangler secret put ADMIN_TOKEN
npx wrangler deploy
```

## Rotas
| Método | Rota | Auth |
|---|---|---|
| GET | /health | — |
| POST | /v1/merchants | ADMIN_TOKEN |
| GET | /v1/merchants/:id | ADMIN_TOKEN |
| POST | /v1/merchants/:id/status | ADMIN_TOKEN |
| POST | /v1/merchants/:id/api-keys | ADMIN_TOKEN |
| POST | /v1/api-keys/:id/revoke | ADMIN_TOKEN |
| POST/GET | /v1/payments, /v1/payments/:id | chave de API (`Authorization: Bearer nv_test_...`), suporta `Idempotency-Key` |
| POST | /v1/checkout/sessions | chave de API |
| GET | /v1/checkout/sessions/:id | chave de API |
| POST | /v1/checkout/sessions/:id/cancel | chave de API |
| GET | /checkout/:id | pública |

Provedores `mpesa`/`emola` respondem 503 até existirem adaptadores oficiais; só `sandbox` funciona.
