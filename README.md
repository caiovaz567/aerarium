# Aerarium

Finanças pessoais, mês a mês. Vite + React + TypeScript, com banco Supabase, publicado na Vercel e instalável no iPhone.

- Como o app funciona hoje: [docs/APP.md](docs/APP.md).
- Regras para quem mexe no código (pessoas e agentes): [AGENTS.md](AGENTS.md).
- Plano original e registro de cada fase: [docs/historico/](docs/historico/).

## Começar

Use Node.js 24 e npm. Na raiz do projeto:

```sh
npm ci
npm run dev
```

Abra http://127.0.0.1:5173. Antes, copie `.env.example` para `.env.local` e preencha a URL e a chave pública (`sb_publishable_...`) do projeto Supabase de desenvolvimento. O passo a passo do Supabase está em [docs/SUPABASE_NUVEM.md](docs/SUPABASE_NUVEM.md).

## Verificar

```sh
npm run check
npm run e2e:install
npm run e2e:user
npm run e2e
npm run db:test
```

`check` roda lint, formatação, Vitest e build. `e2e:user` cria as contas fictícias dos testes de navegador no desenvolvimento (senha em `.env.local`). Playwright confere WebKit em 390×844 e Chromium em 1280×800, nos dois temas, e o projeto `pwa` roda no build de produção (porta 4173). `db:test` roda os testes de banco com dois usuários fictícios e desfaz tudo com rollback.

Outros comandos estão em [AGENTS.md](AGENTS.md).

## Arquivos privados

Backups ficam em `scripts/data/`, fora do Git (o padrão `aerarium-backup-*.json` também é ignorado). O servidor Vite bloqueia esses caminhos e arquivos `.env`. Nunca coloque dados pessoais em `public/`, pois o conteúdo vai para o build.
