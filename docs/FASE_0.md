# Fase 0: fundação

## Escopo

Vite, React e TypeScript estrito; ESLint, Prettier, Vitest e Playwright; página inicial com a marca da v1; cores dos dois temas; fontes locais; configuração inicial do Supabase CLI e comandos de desenvolvimento.

A referência `docs/referencia/aerarium-v1.html` foi preservada. O antigo `index.html` tinha o mesmo SHA-256 da referência e foi substituído pela entrada do Vite.

## Decisões técnicas

- Node.js 24, compatível com o ambiente instalado. Dependências reproduzíveis por `npm ci` e `package-lock.json`.
- Fontes Bricolage Grotesque e Figtree servidas localmente via Fontsource.
- Tema automático com `prefers-color-scheme`; `data-theme` prevalece quando definido. Sem controle de tema novo na interface.
- Testes de iPhone usam WebKit em 390×844; computador usa Chromium em 1280×800. Isso não substitui a futura validação em iPhone físico.
- Backup real mantido no local original e ignorado pelo Git. O servidor de desenvolvimento também bloqueia backups, `scripts/data/`, `.git` e arquivos de ambiente.
- Sem autenticação, regras financeiras, tabelas ou deploy nesta fase.

## Pendência de ambiente

O Supabase CLI foi inicializado, mas `npm run supabase:start` falhou porque Docker e Podman não estão instalados/disponíveis no PATH. `wsl --status` também informa que WSL não está instalado. Portanto, o requisito de banco local rodando ainda não foi validado.

Após instalar e iniciar Docker Desktop com contêineres Linux, executar `npm run supabase:start` e verificar `npm run supabase:status` antes de encerrar integralmente a Fase 0.

## Pontos para as próximas fases

O usuário delegou as escolhas ao implementador. Antes das migrations da Fase 1, consolidar no plano as decisões sobre: arredondamento da última parcela; vigência e histórico de assinaturas; assinaturas sem cartão; composição de fatura congelada; preservação de pagamentos manuais ao reabrir fatura; transporte de déficit e comprometimento sem entradas; prioridade do mês escolhido sobre o fechamento; exclusão de cartão e restauração; importação de faturas pagas e gastos; distinção entre fatura estimada e real no gráfico.

Essas regras não foram implementadas na Fase 0.

## Verificação

- `npm run check`: passou (ESLint, Prettier, 1 teste Vitest, TypeScript estrito e build Vite).
- `npm run e2e`: 14 verificações passaram. Duas verificações de teclado foram puladas nos projetos de celular, por serem destinadas ao computador.
- Playwright: temas automáticos e forçados, fontes carregadas, ausência de erros de console e de rolagem lateral, atalho de teclado e bloqueio HTTP de backups fictícios.
- Revisão visual das capturas em 390×844 e 1280×800, nos temas claro e escuro. Capturas em `test-results/`, fora do Git.
- Agent Browser: página abriu, conteúdo e marca renderizaram, console sem erros e nenhum overlay de erro do Vite.
- Revisão React: componentes pequenos, marca SVG decorativa, conteúdo com landmarks e títulos, sem efeitos ou estado desnecessários.
- `npm run supabase:start`: bloqueado por ausência de Docker/Podman. Nenhum teste de banco foi declarado como aprovado.
