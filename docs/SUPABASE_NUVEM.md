# Supabase na nuvem

Fluxo aprovado para desenvolver o Aerarium sem Docker ou WSL. O app continua rodando em http://127.0.0.1:5173 no computador; banco, Auth e Storage ficam no Supabase hospedado.

**Nesta máquina, a configuração já foi concluída:** CLI autenticado, projeto vinculado e `.env.local` preenchido. `npm run supabase:check` e a consulta ao histórico de migrations passaram. As instruções abaixo servem para reproduzir a configuração em outro ambiente.

## Primeiro acesso

Você já tem conta Supabase. No terminal do VS Code, na pasta do Aerarium:

```sh
npm run supabase:login
```

Siga a autenticação no navegador e informe o código temporário no terminal que iniciou o login. Não coloque token pessoal no código, no `.env.example` ou no chat. Depois, `npm run supabase:projects` deve listar os projetos acessíveis, mesmo que a lista esteja vazia.

## Projeto de desenvolvimento já criado

O usuário criou o projeto **Aerarium**, ref `idvbrfbudoxvubxpqdzs`, na região São Paulo. Use esse projeto para desenvolvimento, sem criar outro agora. `aerarium-dev` era apenas o nome sugerido inicialmente.

Painel: https://supabase.com/dashboard/project/idvbrfbudoxvubxpqdzs. Guarde a senha do banco no seu gerenciador de senhas. Para novos recursos, observe o plano e os limites da organização antes de criar.

Use dados fictícios durante desenvolvimento e testes. `aerarium-prod` será um projeto separado, criado quando formos preparar produção. O backup real fica reservado para a Fase 3, em conta de teste designada e com a conferência prevista no plano.

O identificador do projeto aparece na URL do painel: `https://supabase.com/dashboard/project/IDENTIFICADOR`. Vincule o repositório:

```sh
npm run supabase -- link --project-ref idvbrfbudoxvubxpqdzs
```

Se o CLI pedir a senha do banco, digite no prompt, sem colocar a senha no comando ou no chat. A vinculação fica em `supabase/.temp/`, que está fora do Git.

## Configuração pública

No projeto, abra **Connect** para localizar a Project URL e a Publishable key. As chaves também ficam em **Settings → API Keys**. Para projetos novos, use a chave `sb_publishable_...`.

Crie `.env.local` a partir de `.env.example`, sem sobrescrever configurações existentes:

```dotenv
VITE_SUPABASE_URL=https://idvbrfbudoxvubxpqdzs.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUA_CHAVE_PUBLICA
```

Execute:

```sh
npm run supabase:check
```

Esse comando faz uma leitura das configurações públicas do Auth. Não cria tabelas, usuários ou registros, não imprime a chave e não valida RLS nem o login com Google. Recusa chaves administrativas e destinos diferentes da URL padrão do Supabase hospedado. Os testes automatizados desse utilitário usam respostas fictícias; só a execução com o projeto real comprova a conexão.

Chaves `sb_secret_...`, a antiga `service_role`, senha do banco e token pessoal do CLI nunca devem usar prefixo `VITE_`. A chave pública não substitui as políticas RLS, implementadas e testadas na Fase 1.

## Banco e próximas fases

As migrations da Fase 1 já estão aplicadas, com seed e testes registrados em [FASE_1.md](FASE_1.md). Para mudanças futuras, depois de conferir que o destino é o projeto de desenvolvimento:

```sh
npm run supabase -- migration list
npm run supabase -- db push --dry-run
npm run supabase -- db push
```

Seed e testes usam o ambiente de desenvolvimento e seus próprios usuários/dados. Não usar `db reset --linked`, não rodar testes destrutivos em produção e não confundir a checagem de conectividade com o teste de isolamento entre usuários.

`npm run db:test` executa os testes SQL com rollback. `npm run db:seed` carrega os dados fictícios persistentes. Os dois verificam o destino em `supabase/development.json`. O ensaio `npm run db:preflight` só serve para banco vazio e não deve ser executado no projeto atual já instalado.

O Google OAuth entra na Fase 4. Para concluir a configuração da Fase 0, bastam o CLI autenticado, projeto de desenvolvimento vinculado e a checagem com chave pública aprovada.

## Fontes oficiais

- [Chaves públicas e secretas](https://supabase.com/docs/guides/getting-started/api-keys)
- [Migrations versionadas](https://supabase.com/docs/guides/local-development/database-migrations)
