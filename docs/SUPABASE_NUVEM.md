# Supabase na nuvem

O Aerarium usa Supabase hospedado (São Paulo), sem Docker ou WSL. O app roda em http://127.0.0.1:5173 no computador; banco, Auth e Edge Functions ficam na nuvem.

| Ambiente        | Projeto         | Ref                    | Uso                                                                            |
| --------------- | --------------- | ---------------------- | ------------------------------------------------------------------------------ |
| Desenvolvimento | `Aerarium`      | `idvbrfbudoxvubxpqdzs` | Código novo, testes, seed, contas fictícias. O CLI fica nele.                  |
| Produção        | `aerarium-prod` | `kpzupvajcjhjoarxjcvq` | App publicado. Só o usuário mexe, e o CLI volta para o desenvolvimento depois. |

## Configurar em outro computador

1. Autenticar o CLI e conferir os projetos:

   ```sh
   npm run supabase:login
   npm run supabase:projects
   ```

   Siga o login no navegador. Não coloque token pessoal no código, no `.env.example` nem no chat.

2. Vincular o desenvolvimento (se pedir a senha do banco, digite só no prompt):

   ```sh
   npm run supabase -- link --project-ref idvbrfbudoxvubxpqdzs
   ```

   O vínculo fica em `supabase/.temp/`, fora do Git.

3. Criar `.env.local` a partir de `.env.example` com a Project URL e a chave `sb_publishable_...` (painel: **Connect** ou **Settings → API Keys**), e conferir:

   ```sh
   npm run supabase:check
   ```

   O comando só lê as configurações públicas do Auth, recusa chaves administrativas e não imprime a chave.

## Mudanças no banco

Toda mudança é uma migration nova em `supabase/migrations/`. No desenvolvimento:

```sh
npm run supabase -- db push --dry-run
npm run supabase -- db push
npm run db:test
```

Na produção, o usuário aplica antes do push que depende da migration:

```sh
npm run supabase -- link --project-ref kpzupvajcjhjoarxjcvq
npm run supabase -- db push
npm run supabase -- link --project-ref idvbrfbudoxvubxpqdzs
```

## Regras

- Chaves `sb_secret_...`, `service_role`, senha do banco e token pessoal nunca usam prefixo `VITE_` nem entram no Git. Segredos de Edge Functions vão com `supabase secrets set`, digitados pelo usuário.
- `npm run db:test` e `npm run db:seed` conferem o destino em `supabase/development.json` e recusam outro projeto. `npm run db:preflight` só serve para banco vazio.
- Nunca usar `db reset --linked` nem rodar seed ou testes na produção.

## Fontes oficiais

- [Chaves públicas e secretas](https://supabase.com/docs/guides/getting-started/api-keys)
- [Migrations versionadas](https://supabase.com/docs/guides/local-development/database-migrations)
