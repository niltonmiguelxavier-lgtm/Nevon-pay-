# App móvel Nevon Pay — auditoria inicial

## Objectivo confirmado
App móvel para comerciantes, com publicação pretendida na Google Play e App Store. Reutilizar Supabase, PostgreSQL/Prisma e os serviços da aplicação actual. Não substituir serviços nem expor segredos no cliente móvel. O utilizador confirmou que a app deve evoluir em conjunto com o site e, quando forem integrados novos provedores de pagamento no backend, esses provedores devem aparecer na app sem uma segunda implementação manual.

## Critério de actualização com o site e provedores
A app deve consumir uma API/capacidades partilhadas no servidor, não manter uma lista fixa de provedores nem regras duplicadas no cliente. O backend será a fonte de verdade para provedores disponíveis, métodos, estados e capacidades. Quando um provedor novo for integrado no backend usando o contrato comum, a app deve obter a configuração dinamicamente e apresentar o método/estado correspondente. Uma nova operação ou experiência incompatível com o contrato comum ainda poderá exigir alteração e nova publicação da app; não prometer actualização automática de código sem release.

## Funcionalidades existentes no painel web
Com base na revisão inicial de `app/dashboard/DashboardClient.tsx` e das rotas `app/api`:

| Área | Situação observada | Trabalho para app móvel |
|---|---|---|
| Autenticação e sessão | Supabase no site via cookies SSR | Implementar login nativo e autenticação de chamadas via token Bearer; as rotas actuais não devem ser presumidas compatíveis com app nativa. |
| Visão geral, saldos, gráficos, pagamentos recentes | `GET /api/dashboard`, sessão por cookie | Criar/estender endpoint móvel protegido; confirmar a semântica do saldo disponível e autorização por comerciante. |
| Transacções / pesquisa / exportação | Dados dashboard limitados aos 50 pagamentos mais recentes; exportação CSV no cliente web | Ecrã móvel, filtros e exportação; avaliar paginação no servidor para histórico completo. |
| Clientes | Resumo de clientes derivado de pagamentos recentes | Confirmar limite/cobertura dos dados; evitar afirmar que representa um cadastro completo sem fonte própria. |
| Métodos de pagamento | Estatísticas derivadas de registos existentes | Leitura informativa; o próprio painel declara que processamento não está configurado. Não criar cobranças fictícias. |
| Relatórios | Agregados e gráfico de seis meses | Adaptar visualizações e exportação; conferir consistência com API móvel. |
| Chaves de API | Criar/listar/revogar em `/api/v1/api-keys` | Adaptar chamadas para Bearer, proteger a chave completa (apresentada uma única vez) e confirmar que só é possível revogar chave própria. |
| Perfil / palavra-passe | Endpoints existentes, cookie de sessão | Fluxos nativos e chamadas autenticadas; testar reautenticação, validações e sessão. |
| Notificações | Listagem e marcação como lida | Adaptar endpoints para Bearer; push notifications são uma capacidade adicional, não confirmada na aplicação. |
| Criar comerciante | `POST /api/v1/merchants` | Testar política e estado de aprovação; expor apenas se a regra de negócio estiver confirmada. |
| Processamento/saques/gestão financeira | O painel indica explicitamente que M-Pesa/e-Mola/bancos não estão configurados | Fora do âmbito funcional actual até existirem provedores, endpoints e credenciais oficiais configuradas no servidor. |

## Bloqueios e cautelas
- As rotas actuais usam autenticação Supabase SSR por cookies. Uma app iOS/Android precisa de fluxo Bearer suportado e verificação server-side; não se deve pôr `service_role`, password de PostgreSQL ou segredos de provedores na app.
- O ambiente de trabalho não contém contas de publicação Apple/Google. A submissão final terá de ser feita nas contas da Nevon Pay e aprovada pelas lojas.
- Ainda não foram executados testes com uma conta de comerciante autenticada nem testes de dispositivos físicos.
- Não há aqui prova de configuração de provedores de pagamento nem de notificações push.

## Próximos passos de implementação
1. Definir uma API móvel versionada que valide token Supabase no servidor e mantenha escopo de comerciante em cada operação.
2. Criar app React Native/Expo com login, sessão segura, dashboard e transacções.
3. Adicionar clientes, relatórios, métodos, notificações, perfil, palavra-passe e chaves API, verificando cada fluxo ponta-a-ponta.
4. Automatizar testes de autorização, expiracão de sessão, isolamento entre comerciantes e erros de rede; construir Android/iOS.
5. Preparar branding, privacidade, capturas e submissão — dependente das contas de loja fornecidas pelo proprietário.
