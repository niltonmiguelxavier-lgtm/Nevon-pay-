# Nevon Pay

Gateway de pagamentos em desenvolvimento, inicialmente orientado para Moçambique.

## Stack
- Next.js 15 (App Router) + React 19
- TypeScript
- PostgreSQL (Supabase) + Prisma
- Supabase Auth com sessão SSR por cookies

## Instalação

```bash
pnpm install
cp .env.example .env      # preencher as variáveis
pnpm db:generate          # prisma generate
pnpm db:push              # sincroniza o schema (desenvolvimento)
# ou, para aplicar as migrações versionadas:
pnpm db:migrate
pnpm dev
```

## Variáveis de ambiente

Ver [`.env.example`](./.env.example). Resumo:

| Variável | Obrigatória | Notas |
|---|---|---|
| `DATABASE_URL` | sim | Connection string PostgreSQL. **É a variável canónica.** |
| `SUPABASE_DATABASE_URL` | não | Só usada quando `DATABASE_URL` não existe. Se ambas apontarem para bases diferentes, `/api/health` mostra um aviso. |
| `NEXT_PUBLIC_SUPABASE_URL` | sim | URL do projeto Supabase. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | sim | Chave publicável (`sb_publishable_…`). A `service_role` **nunca** deve ser usada na aplicação. |
| `NEXT_PUBLIC_APP_URL` | recomendado | Usado nos links de email e nos `checkout_url` devolvidos pela API. |
| `EMAIL_PROVIDER` / `EMAIL_API_KEY` / `EMAIL_FROM` | não | Notificações por email (`resend`, `brevo` ou `webhook`). Sem estas variáveis as notificações ficam registadas na base de dados mas não são enviadas. |

`GET /api/health` devolve o estado real da base de dados, se o schema está aplicado,
qual a variável de ligação em uso e se o email está configurado.

## Base de dados

O schema Prisma está versionado em `prisma/migrations`. Projeto Supabase já preparado:
`public.User`, `Merchant`, `MerchantUser`, `ApiKey`, `Wallet`, `LedgerEntry`, `Payment`,
`CheckoutSession`, `WebhookEvent`, `AuditLog`, `Notification`.

Se o ambiente já tiver o schema aplicado (foi o caso do projeto Supabase existente),
não corra `db:push` às cegas: use `prisma migrate status` para confirmar.

## Autenticação

Fluxos implementados em `app/`:

| Fluxo | Onde |
|---|---|
| Criar conta | `/login` (modo “Criar conta”) |
| Confirmação de email | email do Supabase → `/auth/callback` (suporta `?code=` PKCE e `?token_hash=&type=`) |
| Reenviar confirmação | `/login` (botão após o registo) |
| Iniciar sessão | `/login` |
| Terminar sessão | `POST /auth/logout` (limpa cookies SSR) + botão no dashboard |
| Recuperar palavra-passe | `/auth/recuperar` → `/auth/callback` → `/auth/redefinir` |
| Alterar palavra-passe | Dashboard → Configurações (reauth com a palavra-passe actual) |
| Actualizar perfil | Dashboard → Configurações → `PATCH /api/account/profile` |

O perfil em PostgreSQL é sincronizado a partir do Supabase Auth (`lib/auth/sync-user.ts`),
com detecção explícita de conflitos de email em vez de falha silenciosa.

### Configuração do projeto Supabase

- **Site URL**: URL pública da aplicação.
- **Redirect URLs**: `https://<app>/**`, `http://localhost:3000/**` e `/auth/callback`.
- **Email auth** activo e confirmação de email **obrigatória**.
- **SMTP próprio**: obrigatório para produção. O SMTP por omissão do Supabase é limitado
  (algumas mensagens por hora) e devolve `429 over_email_send_rate_limit`.

## API pública (`/api/v1`)

Autenticação por chave de API (`Authorization: Bearer nv_test_…` ou `x-api-key`).
As chaves são geradas no dashboard (Integrações API) e guardadas apenas como hash SHA-256.

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/v1/payments` | Cria pagamento (aceita `Idempotency-Key`) |
| `GET` | `/api/v1/payments` | Lista pagamentos do comerciante |
| `GET` | `/api/v1/payments/{id ou referência}` | Consulta um pagamento |
| `POST` | `/api/v1/checkout/session` | Cria sessão de checkout (devolve `checkout_url` e `cancel_token`) |
| `GET` | `/api/v1/checkout/session/{id}` | Consulta pública da sessão (sem segredos) |
| `POST` | `/api/v1/checkout/session/{id}/cancel` | Cancela (chave de API do dono **ou** `cancel_token`) |
| `GET/POST` | `/api/v1/merchants` | Lista/cria espaços de trabalho do utilizador com sessão |
| `GET/POST` | `/api/v1/api-keys` | Lista/cria chaves (sessão) |
| `DELETE` | `/api/v1/api-keys/{id}` | Revoga chave (sessão) |

Provedores: apenas `sandbox` (não liquida dinheiro). `mpesa` e `emola` respondem `503
PROVIDER_NOT_CONFIGURED`. Chaves `nv_live_` não podem usar o sandbox — não há forma de
simular um pagamento real como concluído.

## Notificações

Persistidas na tabela `Notification` (criadas em `lib/notifications.ts`), com estado de
leitura, contador de não lidas, `GET /api/notifications` e envio de email opcional.
Sem `EMAIL_PROVIDER` configurado, o dashboard indica que o email não está activo e nenhuma
notificação é marcada como enviada.

## Capítulos incluídos

1. Fundação e arquitectura
2. Autenticação e segurança — **implementado** (registo, confirmação, recuperação, alteração)
3. Comerciantes — **implementado** (criação autenticada + espaços de trabalho)
4. Wallet e ledger — modelo financeiro (sem movimentos automáticos)
5. API Gateway — **implementado** com autenticação por chave
6. Checkout — **implementado** (sessões, expiração, cancelamento)
7. e-Mola — bloqueado até documentação/acesso oficial
8. M-Pesa — bloqueado até conta de programador
9. Multi-provider — sandbox disponível; provedores sem adaptador falham de forma segura
10. Antifraude — fundação de segurança (rate limit, auditoria)
11. Dashboard do comerciante — **funcional**
12. Dashboard administrativo — **não implementado** (ver relatório de auditoria)
13. Comissões — arquitectura preparada
14. Notificações — **implementado** (base de dados + email opcional)
15. Sandbox e testes — ambiente sandbox
16. Documentação API — estrutura preparada
17. Deploy — configuração base
18. Produção — checklist

## Importante

Este pacote não contém credenciais reais nem implementa ligações reais a e-Mola/M-Pesa.
Pedidos para esses provedores respondem `503` e nunca são encaminhados silenciosamente
para o sandbox.

O sandbox não deve ser usado em produção. Antes de processar dinheiro real é obrigatório
implementar webhooks verificados, testes ponta a ponta dos provedores e validação dos
requisitos comerciais e de compliance de cada provedor.
