# Fase 0: fundação

**Status: concluída com Supabase na nuvem.** Interface validada, ferramentas configuradas, CLI autenticado, repositório vinculado e conexão remota verificada. A Fase 1 ainda não começou.

## Escopo

Vite, React e TypeScript estrito; ESLint, Prettier, Vitest e Playwright; página inicial com a marca da v1; cores dos dois temas; fontes locais; configuração inicial do Supabase CLI e comandos de desenvolvimento.

A referência `docs/referencia/aerarium-v1.html` foi preservada. O antigo `index.html` tinha o mesmo SHA-256 da referência e foi substituído pela entrada do Vite.

## Decisões técnicas

- Node.js 24, compatível com o ambiente instalado. Dependências reproduzíveis por `npm ci` e `package-lock.json`.
- Fontes Bricolage Grotesque e Figtree servidas localmente via Fontsource.
- Tema automático com `prefers-color-scheme`; `data-theme` prevalece quando definido. Sem controle de tema novo na interface.
- Testes de iPhone usam WebKit em 390×844; computador usa Chromium em 1280×800. Isso não substitui a futura validação em iPhone físico.
- Backup real mantido no local original e ignorado pelo Git. O servidor de desenvolvimento também bloqueia backups, `scripts/data/`, `.git` e arquivos de ambiente.
- Sem login do app, regras financeiras, tabelas ou deploy nesta fase. A autenticação do CLI é apenas para administrar o ambiente.

## Ambiente na nuvem

O usuário escolheu continuar com Supabase hospedado. Docker e WSL deixaram de ser requisitos. O plano, o README e os comandos foram atualizados para o fluxo em [SUPABASE_NUVEM.md](SUPABASE_NUVEM.md).

O usuário criou o projeto `Aerarium`, identificador `idvbrfbudoxvubxpqdzs`. O CLI confirmou status `ACTIVE_HEALTHY`, região São Paulo (`sa-east-1`), PostgreSQL 17 e `linked: true`. Este é o projeto de desenvolvimento; produção deverá usar outro projeto.

A URL e a chave pública fornecida pelo usuário estão em `.env.local`, ignorado pelo Git. `npm run supabase:check` passou contra o projeto real: o endpoint de configurações públicas do Auth respondeu com sucesso. Essa checagem não testa tabelas, RLS ou login Google e não grava dados.

O usuário concluiu o login do CLI no próprio terminal. O comando `supabase link` vinculou o projeto e `supabase migration list` conectou ao banco remoto, retornando histórico vazio. Nenhuma migration de negócio foi aplicada; tabelas, RLS, views e seed ficam para a Fase 1.

O Docker Desktop instalado anteriormente foi mantido. O histórico opcional está em [AMBIENTE_WINDOWS.md](AMBIENTE_WINDOWS.md).

## Pontos para as próximas fases

O usuário delegou as escolhas ao implementador. Antes das migrations da Fase 1, consolidar no plano as decisões sobre: arredondamento da última parcela; vigência e histórico de assinaturas; assinaturas sem cartão; composição de fatura congelada; preservação de pagamentos manuais ao reabrir fatura; transporte de déficit e comprometimento sem entradas; prioridade do mês escolhido sobre o fechamento; exclusão de cartão e restauração; importação de faturas pagas e gastos; distinção entre fatura estimada e real no gráfico.

Essas regras não foram implementadas na Fase 0.

## Verificação

- `npm run check`: passou (ESLint, Prettier, 13 testes Vitest, TypeScript estrito e build Vite). São 12 verificações do utilitário de conexão e o teste original da interface.
- `npm run e2e`: 14 verificações passaram. Duas verificações de teclado foram puladas nos projetos de celular, por serem destinadas ao computador.
- Playwright: temas automáticos e forçados, fontes carregadas, ausência de erros de console e de rolagem lateral, atalho de teclado e bloqueio HTTP de backups fictícios.
- Revisão visual das capturas em 390×844 e 1280×800, nos temas claro e escuro. Capturas em `test-results/`, fora do Git.
- Agent Browser: página abriu, conteúdo e marca renderizaram, console sem erros e nenhum overlay de erro do Vite.
- Revisão React: componentes pequenos, marca SVG decorativa, conteúdo com landmarks e títulos, sem efeitos ou estado desnecessários.
- A stack local não é mais exigida. Nenhum teste de banco remoto foi declarado como aprovado.
- `npm run supabase:check`: passou usando a URL e a chave pública do projeto real.
- `git check-ignore .env.local`: confirmou que as configurações locais ficam fora do Git.
- `npm run supabase:projects`: projeto correto, saudável e vinculado.
- `npm run supabase -- migration list`: conexão administrativa ao banco remoto confirmada, sem migrations de negócio aplicadas.
