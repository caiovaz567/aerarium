# Fase 9: PWA e deploy

**Status: parte do código concluída. Falta o deploy**, que depende de contas do usuário (GitHub, Vercel e o projeto Supabase de produção). Seções 10.2 e 10.3.

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

## Deploy (pendente)

Ordem planejada; os passos com (usuário) exigem login nas contas dele:

1. (usuário) Criar o repositório no GitHub, privado. Depois o código é enviado com `git push`.
2. Produção no Supabase, projeto separado `aerarium-prod`, região São Paulo:
   - (usuário) criar o projeto;
   - vincular com `npm run supabase -- link --project-ref REF_PROD`, conferir com `db push --dry-run` e aplicar com `db push`. Nada de seed nem `db:test` em produção (os scripts recusam projeto fora de `supabase/development.json`);
   - (usuário) Authentication → URL Configuration: Site URL com o endereço da Vercel;
   - (usuário) Authentication → Providers → Google: mesmo Client ID e Secret, e no Google Cloud acrescentar o redirect `https://REF_PROD.supabase.co/auth/v1/callback`.
   - Depois de vincular a produção, voltar o vínculo do CLI para o desenvolvimento.
3. (usuário) Vercel: importar o repositório e cadastrar `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (produção com as do `aerarium-prod`).
4. Conferir no iPhone: Safari → Compartilhar → Adicionar à Tela de Início, abre em tela cheia com o templo, e um push atualiza o app.
