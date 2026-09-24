# Aerarium

Finanças pessoais, mês a mês. Vite + React + TypeScript, com Supabase nas próximas fases. O escopo completo está em [docs/PLANO_AERARIUM.md](docs/PLANO_AERARIUM.md).

## Começar

Use Node.js 24 e npm. Na raiz do projeto:

```sh
npm ci
npm run dev
```

Abra http://127.0.0.1:5173. A fundação funciona sem credenciais e acompanha o tema do sistema. Para conferir um tema manualmente, atribua `data-theme="light"` ou `data-theme="dark"` ao elemento `html` no DevTools. Remova o atributo para voltar ao automático.

## Verificar

```sh
npm run check
npm run e2e:install
npm run e2e
```

`check` roda lint, formatação, Vitest e build com verificação de tipos. Playwright confere WebKit em 390×844 e Chromium em 1280×800, nos temas claro e escuro. Capturas ficam em `test-results/`, e o relatório em `playwright-report/`.

Outros comandos: `npm run test:watch`, `npm run format`, `npm run typecheck` e `npm run preview`.

## Supabase local

Instale e inicie o [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/), com o suporte a contêineres Linux funcionando. Depois:

```sh
npm run supabase:start
npm run supabase:status
```

Copie `.env.example` para `.env.local` e preencha a chave pública `anon` exibida pelo Supabase local. Não use `service_role` em variáveis `VITE_*`. A Fase 0 ainda não conecta a interface ao banco.

Para parar: `npm run supabase:stop`. Para recriar o banco local pelas migrations: `npm run supabase -- db reset`. Tabelas, policies e dados fictícios entram na Fase 1. Veja também a [documentação do ambiente local](https://supabase.com/docs/guides/local-development/cli/getting-started).

## Arquivos privados

Backups devem ficar em `scripts/data/`, fora do Git. O backup já existente na raiz também está ignorado pelo padrão `aerarium-backup-*.json`. O servidor Vite bloqueia esses caminhos e arquivos `.env`. Nunca coloque dados pessoais em `public/`, pois seu conteúdo é distribuído no build.

A referência original está preservada em `docs/referencia/aerarium-v1.html`. Estado da entrega: [docs/FASE_0.md](docs/FASE_0.md).
