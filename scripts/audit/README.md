# Testes de auditoria (ponta a ponta)

Scripts usados na auditoria técnica de 14/11/2026. Não fazem parte do build da aplicação.

## Requisitos

```bash
pnpm add -D playwright pg
npx playwright install chromium
```

## Variáveis

| Variável | Descrição |
|---|---|
| `BASE_URL` | URL da aplicação em execução (por omissão `http://127.0.0.1:3000`) |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE` | Chave `service_role` **apenas** para gerar links de confirmação nos testes — nunca usar na aplicação |
| `DATABASE_URL` | Postgres usado pelos testes de isolamento |
| `EXPECT_CONFIRMATION=1` | Executa a ronda de confirmação de email obrigatória |

## Execução

```bash
node scripts/audit/e2e.mjs              # registo, login, dashboard, pagamentos, palavra-passe
node scripts/audit/isolation.mjs        # isolamento entre comerciantes, expiração, auditoria
node scripts/audit/dashboard-ui.mjs     # navegação, filtros, exportação CSV
node scripts/audit/cleanup-test-users.mjs  # remove as contas criadas (prefixo nevon.audit.)
```

Os resultados são escritos em `audit-results*.json` e as capturas em `audit-screenshots/`.
