# Fase 10: acabamento

**Status: concluída.** No ar na produção, com a Edge Function `delete-account` publicada pelo usuário em 25/09/2026. Seção 9, Fase 10, e seção 5.6.

## Entrega

- **Ajustes** (`src/features/config`):
  - "Baixar meus dados": JSON com a conta (id, e-mail, data de criação, formas de entrar) e todas as 9 tabelas como estão no banco, lidas com RLS e paginadas de 1000 em 1000. Arquivo `Aerarium_dados_AAAA-MM-DD.json` (data de São Paulo). Código em `src/data/account.ts`.
  - "Apagar minha conta e meus dados": modal que só libera "Apagar tudo" depois de digitar APAGAR (maiúscula ou não, porque o iPhone capitaliza). Ao apagar: limpa o cache, esquece a sessão no aparelho, vai pro login com o aviso "Sua conta e seus dados foram apagados.". Se falhar, explica e continua no modal.
  - Link para a política de privacidade. "Sair" já existia.
- **Edge Function `delete-account`** (`supabase/functions/delete-account/index.ts`): pega o usuário do token de sessão (nunca do corpo do pedido), exige `{"confirm":"APAGAR"}` e apaga com `auth.admin.deleteUser`. O banco apaga o resto por cascata (testado em `supabase/tests/phase1.sql`). A chave de administrador só existe no servidor do Supabase. `verify_jwt = false` em `supabase/config.toml` porque a função confere o token ela mesma, o que funciona com as chaves JWT antigas e novas.
- **Política de privacidade** em `/privacidade`, aberta sem login, com link no login e em Ajustes: o que guarda, o que não guarda, onde fica (Supabase em São Paulo, Vercel), quem vê e como levar ou apagar.
- **Sem internet e erros:**
  - Cabeçalho mostra "Sem internet" (amarelo) quando o aparelho está offline.
  - Consultas e gravações não ficam mais "pausadas" esperando a internet voltar (`networkMode: 'always'`): carregar falha com "Não consegui carregar seus dados" e "Tentar de novo"; gravar volta a tela como estava e avisa "Não consegui salvar".
  - Carregamento sem resposta do servidor: a mensagem aparece em uns 3 segundos. Antes eram 15, porque o Supabase repetia cada pedido 3 vezes por conta própria e o app repetia de novo; agora só o app repete (duas vezes).
  - Tela que quebra mostra "Algo deu errado" com "Recarregar" (`src/app/ErrorBoundary.tsx`), nunca página em branco.
- **Acessibilidade** (7.4 item 14):
  - Verificação automática WCAG 2.1 AA com axe em todas as telas, modais e login, nos dois temas, no celular e no computador (`tests/e2e/a11y.spec.ts`).
  - Contraste corrigido: `--neg` e `--warn` do tema claro um pouco mais escuros (ver seção 7.1 do plano); o texto "vs set" da comparação do gráfico deixou de ser cinza sobre a pílula colorida.
  - A faixa do gráfico agora recebe foco pelo teclado.
  - Teste só com teclado: "Ir para o conteúdo", abrir o Lançar, foco preso no modal, Esc fecha e devolve o foco.
  - Foco visível e `prefers-reduced-motion` já existiam e foram conferidos.
- Ícones dentro de botões agora têm tamanho fixo (o de "Baixar meus dados" sumia).

## Testes

- `npm run check`: 287 testes Vitest. Novos: conteúdo e nome do arquivo de dados, botão de baixar e erro, APAGAR (maiúscula ou não), modal de apagar (libera, cancela, apaga, erro), privacidade sem login, "Sem internet" no cabeçalho, tela de erro.
- `npm run e2e`: 154 verificações, rodadas três vezes. Novas: Ajustes e modal sem rolagem lateral, download real do JSON, privacidade sem login, sem internet (aviso e gravação desfeita), servidor fora do ar, acessibilidade (33) e o fluxo completo de apagar conta.
- **Apagar conta de verdade, no desenvolvimento:** `npm run e2e:user` cria também a conta descartável `aerarium.e2e.apagar@example.test`; o teste `delete-flow.spec.ts` recria essa conta, entra, apaga pelo app e confere que ela não entra mais. Também conferido à mão: sem login a função recusa (401), sem APAGAR recusa (400), e depois de apagar não sobra nenhum cartão nem a conta.
- Capturas conferidas em 390×844: Ajustes, modal de apagar e privacidade, nos dois temas.

## Publicar a função na produção (usuário, já feito)

O app novo chega sozinho com o push. A Edge Function precisa de um comando, uma vez:

```sh
npm run supabase -- functions deploy delete-account --project-ref kpzupvajcjhjoarxjcvq --use-api
```

Enquanto ela não estiver publicada, "Apagar minha conta" na produção só mostra o erro e não apaga nada.

## Pendências (fora do plano ou opcionais)

- SMTP próprio no Supabase de produção, para "Esqueci a senha" e cadastro por e-mail funcionarem para qualquer pessoa.
- Tela de consentimento do Google com a marca do app e publicação do app do Google (hoje em modo de teste).
- A política de privacidade não tem um e-mail de contato. Se o app for aberto a outras pessoas, vale incluir um.
