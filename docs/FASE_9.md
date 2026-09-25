# Fase 9: PWA e deploy

**Status: concluída.** App no ar em https://aerarium-delta.vercel.app, com banco de produção próprio, e instalado no iPhone do usuário. Seções 10.2 e 10.3.

## Entrega (código)

- **PWA** com `vite-plugin-pwa` (`vite.config.ts`): manifesto conforme a seção 10.3 (`Aerarium`, `standalone`, `#0D0F15`, `start_url` `/`, `pt-BR`).
- **Ícones** em `public/icons/`: 192, 512, maskable 512 e `apple-touch-icon` 180×180. Templo branco sobre `#3140C2`, cantos retos. Gerados por `npm run icons` (`scripts/make-icons.mjs`, desenha com o Chromium do Playwright); os PNGs ficam no Git.
- **Metas do iPhone** em `index.html`: `apple-mobile-web-app-capable`, `black-translucent`, título, `apple-touch-icon` e `theme-color` por tema. `viewport-fit=cover` já existia.
- **Service worker só com a casca:** guarda HTML, JS, CSS, fontes `woff2` e ícones. Nenhuma regra de cache em tempo de execução, então as chamadas ao Supabase (dados financeiros) sempre vão pela rede. Sem internet, o app abre a casca e mostra o login ou o erro de carregamento, nunca uma tela em branco.
- **Aviso de versão nova** (`src/app/UpdatePrompt.tsx`): "Nova versão disponível. [Atualizar]". Fica até ser tocado, acima do aviso de Desfazer, sem substituí-lo. O app procura versão nova a cada hora e sempre que volta pra frente (o app instalado no iPhone costuma ser retomado, não reaberto).
- **Build dividido:** React, Supabase e as outras bibliotecas saem em arquivos próprios (fim do aviso de arquivo acima de 500 kB). Como mudam menos que o app, o celular baixa menos a cada atualização.
- **`vercel.json`:** todas as rotas caem no `index.html`; `sw.js`, `index.html` e o manifesto nunca ficam presos em cache; `assets/` com cache longo (os nomes mudam a cada build); cabeçalhos básicos de segurança.
- **Correção de brinde:** o aviso (toast) quebrava a linha sem precisar ("Uber / excluído"), porque ficava espremido na metade da tela.

## Testes

- `npm run check`: 273 testes Vitest (novos: aviso de versão nova escondido, aparece e atualiza, e procura versão ao voltar pro app).
- `npm run e2e`: 101 verificações. Novo projeto `pwa`, que roda no build de produção (`npm run build` + `preview` na porta 4173): manifesto, os quatro ícones, metas do iPhone, service worker com cache só de arquivos do próprio app e abertura sem internet.

## Deploy

- **GitHub:** repositório privado `caiovaz567/aerarium`. Antes do primeiro envio, o histórico foi conferido: sem chaves secretas, backup ou e-mail. A pedido do usuário, as linhas `Co-Authored-By` foram retiradas de todos os commits, e o histórico foi reescrito (conteúdo dos arquivos idêntico).
- **Produção no Supabase:** projeto `aerarium-prod`, ref `kpzupvajcjhjoarxjcvq`, São Paulo. O usuário aplicou as 5 migrations com `db push` (o Claude Code bloqueia mexer em produção; ensaio com `--dry-run` antes). Sem seed e sem testes lá.
  - URL Configuration: Site URL e Redirect URLs com `https://aerarium-delta.vercel.app`.
  - Google ligado com o mesmo cliente OAuth; no Google Cloud entrou o redirect do projeto de produção.
  - "Allow manual linking" precisa estar ligado para "Conectar conta Google" em Ajustes (vem desligado em projeto novo).
  - Conta do usuário criada pelo painel (Auto Confirm), porque o e-mail padrão do Supabase é limitado.
- **Import:** o usuário rodou `import:backup --gravar` na produção. Os 3 meses bateram com a v1, sem diferenças nem avisos.
- **Vercel:** projeto `aerarium`, preset Vite, variáveis só em Production (`VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` do `aerarium-prod`). Os Previews ficam sem banco. Conferido no ar: rotas, manifesto, ícones, cabeçalhos de cache e segurança, chave pública certa e nenhuma chave secreta no JavaScript.
- **Correção nos scripts de banco:** o Supabase CLI devolve tabela no terminal de uma pessoa e JSON para agentes de IA. `import-backup.ts`, `database.mjs`, `e2e-user.mjs` e `tests/db/domain.test.ts` agora pedem sempre JSON (`--agent yes`). O import também mostra a etapa e o erro real quando falha.

## Regras de produção

- O CLI fica vinculado ao desenvolvimento. Para mexer na produção, o usuário vincula `kpzupvajcjhjoarxjcvq`, roda o comando e volta com `npm run supabase -- link --project-ref idvbrfbudoxvubxpqdzs`.
- Toda migration nova vai primeiro para o desenvolvimento e depois o usuário aplica na produção.
- Cada push em `main` publica o app. No iPhone, aparece "Nova versão disponível" quando o app muda (push só de documentação não gera versão nova). A primeira conferência disso no iPhone fica para o primeiro push da Fase 10.

## Pendências para a Fase 10 ou depois

- SMTP próprio no Supabase de produção, para "Esqueci a senha" e cadastro por e-mail funcionarem para qualquer pessoa.
- Tela de consentimento do Google com a marca do app e publicação do app do Google (hoje em modo de teste).
