# Nevon Pay — App Móvel do Comerciante

Aplicação móvel Expo / React Native para comerciantes acompanharem e operarem a sua conta **Nevon Pay** no **Android (Google Play)** e **iOS (App Store)**, ligada directamente à mesma infraestrutura backend Next.js + Prisma + Supabase do site.

## Funcionalidades implementadas

- **Autenticação Supabase com armazenamento seguro:**
  - Sessão persistida em `expo-secure-store` (com fragmentação automática para sessões JWT extensas e fallback seguro na web).
  - Login, criação de conta, recuperação de palavra-passe e renovação automática do token (`Bearer`).
- **Visão Geral (`Início`):**
  - Receita confirmada, transacções totais/concluídas/pendentes, saldo de teste, gráfico de recebimentos dos últimos 6 meses, últimos movimentos e onboarding para criar o primeiro espaço de trabalho.
  - Seletor multi-espaço (`Todos os espaços` ou espaço específico) e pull-to-refresh + actualização automática a cada 30s.
- **Transacções (`Transacções`):**
  - Paginação real ligada a `/api/merchant/transactions` (com pesquisa por referência/provedor/cliente, filtro por estado e carregamento incremental).
  - Modal de detalhe completo via `/api/merchant/transactions/[id]` com cópia da referência e dados da sessão de checkout/cliente.
  - Exportação CSV partilhável (`Share` nativo / área de transferência).
- **Negócio (`Negócio`):**
  - **Clientes:** lista pesquisável extraída das sessões de pagamento reais.
  - **Métodos & Provedores:** catálogo **dinâmico** obtido de `/api/capabilities` e `dashboard.capabilities.providers` — acompanha automaticamente quaisquer provedores adicionados ao servidor sem precisar de hardcode na app.
  - **Relatórios:** gráfico mensal e resumo de recebimentos + exportação CSV.
- **Integrações (`API`):**
  - Estado real de processamento comunicado pelo servidor (`capabilities.paymentProcessing.notice`).
  - Criação de chaves de API de teste, exibição única do segredo com botão copiar, listagem e revogação com confirmação.
- **Conta (`Conta`) e Notificações:**
  - Actualização do nome do perfil (`/api/account/profile`), criação e listagem de espaços de trabalho (`/api/v1/merchants`), alteração de palavra-passe com verificação da palavra-passe actual (`/api/account/password`), centro de notificações (`/api/notifications`) e diagnóstico de saúde (`/api/health`).

## Arquitetura dinâmica de provedores e capacidades

A aplicação **não contém listas fixas de métodos de pagamento**. Tanto `/api/capabilities` quanto `/api/dashboard` devolvem `capabilities`:

- `capabilities.providers`: lista dos provedores realmente registados em `artifacts/nevon-pay/lib/provider-registry.ts` (actualmente apenas `sandbox` para testes).
- `capabilities.paymentProcessing.liveEnabled`: indica ao cliente se já existe algum provedor pronto para cobrança real. Enquanto M-Pesa, e-Mola ou bancos não estiverem integrados no backend, a app apresenta claramente esse estado sem simular cobranças reais.
- `capabilities.features`: capacidades activas da plataforma (`exportCsv`, `pushNotifications`, etc.).

Sempre que um novo provedor for integrado no servidor (`provider-registry.ts`), a app móvel passa a apresentá-lo e a resolver o seu nome automaticamente.

## Desenvolvimento local

1. Configure as variáveis em `mobile-app/.env` (já preenchido com as variáveis públicas do projecto para testes, ou ajuste `EXPO_PUBLIC_API_URL` para apontar para o seu backend local/staging):
   ```env
   EXPO_PUBLIC_API_URL=https://nevon-pay.vercel.app
   EXPO_PUBLIC_SUPABASE_URL=https://mhrdefisamaflkpkqmiu.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=...
   ```
   > **Nota:** Nunca coloque `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` ou segredos privados em variáveis `EXPO_PUBLIC_*`.

2. Instale as dependências e inicie o Expo:
   ```bash
   cd mobile-app
   npm install
   npx expo start
   ```

3. Verificações locais de qualidade:
   ```bash
   npx tsc --noEmit
   npx expo export --platform android
   npx expo export --platform ios
   ```

## Publicação na Google Play e App Store (EAS Build)

O ficheiro `eas.json` já define os perfis `development`, `preview` (APK Android instalável directamente para testes internos) e `production` (AAB para Google Play e IPA para App Store).

1. Instale a CLI do EAS e autentique-se com a conta da empresa:
   ```bash
   npm install -g eas-cli
   eas login
   eas init
   ```
2. Configure as variáveis de ambiente públicas no painel EAS (ou em `eas.json`) para `production`.
3. Gere os builds de loja:
   ```bash
   eas build --platform android --profile production
   eas build --platform ios --profile production
   ```
4. Submeta às lojas:
   ```bash
   eas submit --platform android
   eas submit --platform ios
   ```

> **Pré-requisitos fora do código para publicação:**
> - Conta **Google Play Console** e **Apple Developer Program** activas em nome da empresa.
> - Política de Privacidade e Termos de Utilização públicos no domínio da empresa.
> - Se desejar que links de recuperação/confirmação de email abram directamente a app (`nevonpay://auth/callback`), adicione `nevonpay://**` à lista `Redirect URLs` no painel Authentication → URL Configuration do Supabase.
