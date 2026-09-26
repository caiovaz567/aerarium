# Aerarium

Finanças pessoais, mês a mês. Vite + React + TypeScript, com banco Supabase. O escopo completo está em [docs/PLANO_AERARIUM.md](docs/PLANO_AERARIUM.md).

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
npm run e2e:user
npm run e2e
```

`e2e:user` cria as contas fictícias dos testes de navegador (a principal e uma descartável, que o teste de apagar conta apaga) no projeto de desenvolvimento e guarda a senha em `.env.local`. Login e esqueleto do app: [docs/FASE_4.md](docs/FASE_4.md).

`check` roda lint, formatação, Vitest e build com verificação de tipos. Playwright confere WebKit em 390×844 e Chromium em 1280×800, nos temas claro e escuro. Capturas ficam em `test-results/`, e o relatório em `playwright-report/`.

Outros comandos: `npm run test:watch`, `npm run test:coverage` (cobertura de `src/domain`), `npm run format`, `npm run typecheck` e `npm run preview`.

O projeto de teste `pwa` do Playwright roda no build de produção (porta 4173), onde existe o service worker. `npm run icons` redesenha os ícones do app em `public/icons/`. PWA e deploy: [docs/FASE_9.md](docs/FASE_9.md). Acabamento, apagar conta e acessibilidade: [docs/FASE_10.md](docs/FASE_10.md).

## Supabase na nuvem

O desenvolvimento usa um projeto Supabase hospedado, separado da produção. Docker e WSL não são necessários. O passo a passo está em [docs/SUPABASE_NUVEM.md](docs/SUPABASE_NUVEM.md).

```sh
npm run supabase:login
npm run supabase:projects
```

O projeto de desenvolvimento foi criado com o nome `Aerarium`. Depois de vincular esse projeto, copie `.env.example` para `.env.local` (sem sobrescrever um arquivo existente) e preencha a URL e a chave pública `sb_publishable_...` do projeto. Confira com `npm run supabase:check`. O comando testa o endpoint público de configurações de autenticação, sem escrever dados nem imprimir chaves. A Fase 0 ainda não conecta a interface ao banco.

O banco da Fase 1 tem migrations, RLS, views, bucket privado de fotos e seed fictício. Para verificar o projeto de desenvolvimento já vinculado:

```sh
npm run db:test
```

`npm run db:domain` compara as regras de `src/domain` com as views, em leitura com rollback ([docs/FASE_2.md](docs/FASE_2.md)).

`npm run import:backup` importa o backup da v1 para uma conta, com relatório de conferência. Use `-- --simular` para ver o relatório sem banco. Detalhes em [docs/FASE_3.md](docs/FASE_3.md).

Os testes de banco usam dois usuários fictícios e revertem todas as alterações com rollback. Exigem o login administrativo do CLI, sem chave secreta no frontend. `npm run db:seed` carrega o seed de desenvolvimento sem duplicar registros. Ambos conferem o projeto vinculado contra `supabase/development.json`. Totais esperados e reprodução em banco vazio estão em [docs/FASE_1.md](docs/FASE_1.md).

Não execute reset remoto. Os comandos `supabase:start`, `supabase:stop` e `supabase:status` ficam disponíveis apenas como alternativa local com Docker.

## Arquivos privados

Backups devem ficar em `scripts/data/`, fora do Git. O backup já existente na raiz também está ignorado pelo padrão `aerarium-backup-*.json`. O servidor Vite bloqueia esses caminhos e arquivos `.env`. Nunca coloque dados pessoais em `public/`, pois seu conteúdo é distribuído no build.

A referência original está preservada em `docs/referencia/aerarium-v1.html`. Entregas: [Fase 0](docs/FASE_0.md) e [Fase 1](docs/FASE_1.md). A interface ainda não tem login nem consome as tabelas.
