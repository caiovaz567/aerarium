# Aerarium

App pessoal de finanças, celular primeiro. Vite + React + TypeScript + Supabase, deploy na Vercel, instalável no iPhone como PWA.

O plano completo, com regras de negócio, banco, telas e fases, está aqui:

@docs/PLANO_AERARIUM.md

A versão anterior do app (referência de telas e comportamento) está em `docs/referencia/aerarium-v1.html`.

## Regras rápidas

- Uma fase do plano por vez. No fim: lint, testes, commit, resumo, e esperar minha confirmação.
- Regras de negócio em `src/domain`, sempre com teste. Dinheiro em centavos inteiros.
- Mudança de banco sempre em migration nova. RLS em toda tabela.
- Nunca usar a `service_role` no front. Nunca commitar `.env*` (exceto `.env.example`) nem `scripts/data/`.
- Conferir toda tela em 390×844 antes de dizer que está pronta.
- Interface em português do Brasil, tom casual. Nos textos da interface, sem travessão ou hífen como pontuação.
- Na dúvida sobre regra de negócio, perguntar em vez de inventar.

## Comandos

- `npm run dev`: servidor em http://127.0.0.1:5173.
- `npm test`: Vitest, uma execução. `npm run test:watch`: modo contínuo.
- `npm run e2e`: Playwright, iPhone (WebKit) e computador (Chromium), nos dois temas.
- `npm run e2e:install`: instalar os navegadores de teste.
- `npm run lint`: ESLint. `npm run format:check`: Prettier.
- `npm run build`: verificar TypeScript e gerar o build.
- `npm run check`: lint, formatação, testes unitários e build.
- `npm run supabase:login`: autenticar o CLI na conta Supabase.
- `npm run supabase:projects`: listar os projetos acessíveis.
- `npm run supabase:check`: validar acesso ao projeto em `.env.local` usando a chave pública.
- `npm run supabase -- link --project-ref REF`: vincular o projeto de desenvolvimento.
- `npm run supabase -- db push --dry-run`: revisar migrations pendentes antes de aplicar com `db push`.
- `supabase:start`, `supabase:stop` e `supabase:status` são opcionais, exclusivos da stack local com Docker.

Desenvolvimento usa Supabase na nuvem, conforme `docs/SUPABASE_NUVEM.md`. Não executar reset remoto nem seed/testes em produção. No front, usar `VITE_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_...`); nunca `sb_secret_...`, `service_role`, senha do banco ou token pessoal.

Estado e pendências da fundação: `docs/FASE_0.md`.
