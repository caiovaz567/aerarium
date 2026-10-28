# Aerarium: regras para agentes

App pessoal de finanças, celular primeiro. Vite + React + TypeScript + Supabase, deploy na Vercel, instalável no iPhone como PWA.

Como o app funciona hoje (telas, regras de negócio, banco, produção, pendências): `docs/APP.md`. Leia antes de mudar algo e mantenha atualizado quando o app mudar.

O que fazer a seguir, em ordem: `docs/PLANO.md`. Marque o que terminar e siga o próximo item.

## Como trabalhar

- Uma mudança por vez. No fim: `npm run check`, testes de navegador quando a tela muda, commit, resumo curto, e esperar a confirmação do usuário.
- Na dúvida sobre regra de negócio ou sobre como uma tela deve ficar, perguntar em vez de inventar. Mudanças de visual: o usuário testa localmente antes de publicar.
- Trabalho não aprovado fica fora de `main` (push em `main` publica em produção).

## Commits

- Mensagens de commit **sempre em inglês** (a partir de 27/09/2026; os commits antigos ficam em português).
- Formato curto: `feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`, `test: ...`, com corpo explicando o porquê quando precisar.
- Nunca adicionar `Co-Authored-By` nem qualquer atribuição a IA em commits ou PRs.

## Código

- Regras de negócio em `src/domain`, sempre com teste (cobertura de 100% mantida). Dinheiro em centavos inteiros.
- Mudança de banco sempre em migration nova, nunca editar migration aplicada. RLS em toda tabela, FK composta com `user_id`.
- Comentários e nomes no código em inglês; textos da interface em português do Brasil, tom casual, sem travessão ou hífen como pontuação.
- Conferir toda tela em 390×844 (e 1280×800) antes de dizer que está pronta. Regras de interface em `docs/APP.md`.

## Segurança

- Nunca usar `service_role` ou `sb_secret_...` no front. No front, só `VITE_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_...`).
- Nunca commitar `.env*` (exceto `.env.example`) nem `scripts/data/`. Nunca pedir senhas ou chaves ao usuário; segredos vão direto do usuário para os secrets do Supabase.
- Dados financeiros reais e o e-mail do usuário não entram em documentos do Git.
- Apagar dados ou contas só com confirmação do usuário.

## Ambientes

- Desenvolvimento: Supabase `idvbrfbudoxvubxpqdzs`, guia em `docs/SUPABASE_NUVEM.md`. O CLI fica sempre vinculado a ele. Testes e seed só aqui.
- Produção: app https://aerarium-delta.vercel.app, banco `aerarium-prod` (`kpzupvajcjhjoarxjcvq`). Agentes não mexem na produção: o usuário vincula, roda o comando (ex.: `db push`) e volta o vínculo para o desenvolvimento. Migration nova vai para produção antes do push que depende dela.
- Nunca executar reset remoto nem seed/testes em produção.

## Comandos

- `npm run dev`: servidor em http://127.0.0.1:5173.
- `npm run check`: lint, formatação, Vitest e build. `npm test`, `npm run test:watch`, `npm run test:coverage` (cobertura de `src/domain`).
- `npm run e2e`: Playwright no iPhone (WebKit) e computador (Chromium), dois temas, mais o projeto `pwa` no build de produção. `npm run e2e:install` instala os navegadores. `npm run e2e:user` cria as contas fictícias de teste (senha em `.env.local`).
- `npm run db:test`: testes SQL com rollback no desenvolvimento. `npm run db:domain`: compara `src/domain` com as views. `npm run db:seed`, `npm run db:preflight`: só desenvolvimento.
- `npm run dev:copiar-prod`: copia os dados do dono da produção (só leitura, com o login dele) pra conta dele no desenvolvimento, trocando o que havia lá; senha digitada no terminal só na primeira vez (depois usa o acesso guardado em `scripts/data/`, `scripts/login.mjs`); cópia salva em `scripts/data/` (fora do Git). `node scripts/ver-banco-prod.mjs`: pergunta à função `bank` da produção, como o dono, se a conta é a dona do banco (só leitura). Sem compartilhamento e com o e-mail diário desligado.
- `npm run db:dev`: aplica migrations novas e publica as funções no desenvolvimento, e roda `db:test`. `npm run db:prod` (só o dono): liga na produção, mostra o que muda, pergunta, aplica, pergunta se publica as funções e volta pro desenvolvimento. `npm run supabase:check`: confere o acesso com a chave pública.
- `npm run supabase -- functions deploy NOME --project-ref REF --use-api`: publicar Edge Function.
- `npm run import:backup -- --simular`: relatório do import da v1 (opções no topo de `scripts/import-backup.ts`).
- `npm run icons`: redesenha os ícones do PWA.
