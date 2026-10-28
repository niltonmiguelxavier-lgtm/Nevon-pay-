# Nevon Pay

Gateway de pagamentos em desenvolvimento, inicialmente orientado para Moçambique.

## Stack
- Next.js
- TypeScript
- PostgreSQL
- Prisma

## Instalação

O projecto foi importado como aplicação Next.js no workspace Nevon Pay. O servidor de desenvolvimento e a porta são fornecidos pelo Replit.

Para preparar a base de dados de desenvolvimento:

```bash
pnpm --filter @workspace/nevon-pay run db:generate
pnpm --filter @workspace/nevon-pay run db:push
```

Para verificar os tipos:

```bash
pnpm --filter @workspace/nevon-pay run typecheck
```

## Capítulos incluídos

1. Fundação e arquitectura
2. Autenticação e segurança — base preparada
3. Comerciantes — base funcional
4. Wallet e ledger — modelo financeiro
5. API Gateway — API versionada
6. Checkout — sessões e página de checkout
7. e-Mola — integração bloqueada até receber documentação técnica oficial e acesso de teste
8. M-Pesa — portal oficial identificado; APIs detalhadas exigem conta de programador activada
9. Multi-provider — sandbox disponível; provedores sem adaptador falham de forma segura
10. Antifraude — fundação de segurança
11. Dashboard do comerciante — base
12. Dashboard administrativo — base
13. Comissões — arquitectura preparada
14. Notificações — arquitectura preparada
15. Sandbox e testes — ambiente sandbox
16. Documentação API — estrutura preparada
17. Deploy — configuração base
18. Produção — checklist

## Importante

Este pacote não contém credenciais reais nem implementa ligações reais a e-Mola/M-Pesa. O portal M-Pesa disponibiliza as especificações depois de activar uma conta de programador; não encontrámos documentação pública oficial para a API e-Mola. Pedidos para esses provedores respondem `503` e nunca são encaminhados silenciosamente para o sandbox.

O sandbox não deve ser usado em produção. Antes de processar dinheiro real, também é obrigatório implementar autenticação e gestão segura de chaves de comerciante, webhooks verificados, testes ponta a ponta e validação dos requisitos comerciais e de compliance de cada provedor.

## Login e base de dados Supabase

A aplicação inclui autenticação de email/palavra-passe com Supabase Auth, sessão SSR por cookies e protecção do dashboard. A senha é gerida pelo Supabase Auth; a tabela `User` guarda apenas o perfil e o ID do utilizador Supabase.

Configure estes valores no Secrets do Replit:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_DATABASE_URL` — use a connection string **Session pooler** do painel Supabase (porta `5432`) para o Prisma.

Não é necessário usar a chave `service_role`. Até `SUPABASE_DATABASE_URL` ser configurada, a aplicação continua explicitamente na base de desenvolvimento actual; o endpoint `/api/health` informa `database_provider`. Depois de ligar o projecto, confirme que o destino está vazio ou que pode receber as tabelas Nevon Pay antes de aplicar o schema Prisma.

No painel Supabase, active Email Auth e permita o URL de callback da aplicação terminado em `/auth/callback` na configuração de URLs de autenticação.
