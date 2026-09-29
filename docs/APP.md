# Aerarium: como o app funciona hoje

Resumo do estado atual. Atualizar sempre que o app mudar.

## O que é

App pessoal de finanças, celular primeiro, instalável no iPhone (PWA). Responde: quanto entrou, saiu e sobra no mês; quanto vem em cada fatura e do que ela é feita; quais cobranças fixas existem; para onde foi o dinheiro.

- Produção: https://aerarium-delta.vercel.app (push em `main` publica pela Vercel).
- Contas: e-mail e senha ou Google, e dá para conectar o Google a uma conta de e-mail (Ajustes). Cada pessoa vê só os próprios dados (RLS).
- Hoje só o dono usa. Dados reais vieram do backup da primeira versão (v1), com `npm run import:backup`.

## Stack e pastas

Vite + React 19 + TypeScript estrito, React Router, TanStack Query (um cache `['finance', userId]`), Supabase (Postgres, Auth PKCE, Edge Functions), date-fns, Vitest + Testing Library, Playwright, `vite-plugin-pwa`, `write-excel-file`.

- `src/domain`: regras de negócio puras, sem React nem Supabase, com 100% de cobertura (`npm run test:coverage`).
- `src/data`: cliente Supabase, carga (`finance.ts`), escritas (`financeOps.ts`, `editOps.ts`, `categoryOps.ts`), conta (`account.ts`).
- `src/features`: telas (`meses`, `cartoes`, `cartao`, `lancar`, `assinaturas`, `editar`, `config`, `exportar`, `login`, `privacidade`).
- `src/ui`: componentes genéricos. `src/styles`: CSS por área, tokens em `tokens.css`.
- `supabase/migrations`: SQL versionado. `supabase/functions/delete-account`: Edge Function de apagar conta. `supabase/tests/phase1.sql`: testes de banco.
- `tests/e2e`: Playwright. `scripts`: import da v1, contas de teste, ícones, utilitários de banco.

## Regras de negócio (em `src/domain`)

- **Dinheiro** em centavos inteiros (`Cents`). No banco é `numeric(12,2)`, lido como texto.
- **Fatura** = parcelas do cartão no mês + assinaturas ativas do cartão + gastos lançados + "outros gastos" (o resto não detalhado). "Sei o total" calcula o "outros" e recusa total menor que o fixo. Fatura paga congela o total (`closed_total`) e paga as parcelas do cartão daquele mês; desmarcar desfaz.
- **Parcelas**: cronograma fixo a partir do mês da primeira; a última parcela absorve o arredondamento (`final_adjustment`). Quitado quando todas estão pagas.
- **Saldo do mês**: entradas − (contas + faturas + parcelas fora de cartão). "Falta pagar" = o que não está marcado como pago.
- **Mês novo** copia entradas, contas (não pagas, com a categoria, contadores "2/12" avançam) e uma fatura estimada por cartão; oferece levar a sobra do mês anterior.
- **Dia de fechamento** do cartão manda gasto depois do fechamento para a fatura seguinte (sugestão no Lançar). O mês da fatura é o mês em que ela vence: se o vencimento é antes do fechamento (fecha 28, vence 5), a fatura que fecha num mês é paga no seguinte (`src/domain/cardDates.ts`).
- **Categorias** (só saídas): lista por pessoa, criada na primeira abertura com 9 padrão (nome, cor, ícone de uma lista fixa); sugestão ao lançar pelo que a pessoa já escolheu para a mesma descrição, depois por palavras-chave. Gastos, contas, parcelamentos e assinaturas podem ter categoria.
- **Saídas do mês em pedaços** (`monthOutflowItems`): somam exatamente as saídas; a parte sem detalhe de cada fatura fica em "Outros gastos das faturas".
- **Por data**: gastos e contas com hora exata (`occurred_at`, fuso de São Paulo) agrupados por dia; o resto em "Fixos do mês". Comparação por categoria com o mês anterior quando muda R$ 20 ou mais.

- **Outra pessoa usa os cartões** (Fase 13.3, só o dono do Open Finance vê a opção, em Ajustes → Bancos conectados; `user_settings.other_person`, ex.: "Pai"): gastos e parcelamentos marcados `for_other` e o "outros" de toda fatura são dela. A fatura continua com o total do banco; o saldo, as Saídas e o total dos cartões em Meses contam só a parte do dono (`invoiceTotals().mine`, `v_invoice_totals.mine`). Na importação: a primeira vez, o que o dono não tinha lançado à mão é da outra pessoa; depois, a última escolha pela mesma loja decide, e loja nova segue a maioria do cartão. "De quem" aparece na edição do gasto e do parcelamento. Compras e parcelamentos novos do banco esperam em "Chegou do banco" (abre sozinha ao abrir o app, e um aviso em Meses reabre) até o dono marcar Meu ou da outra pessoa (`reviewed_at`). Com a outra pessoa ligada, o cabeçalho tem o seletor **Eu | Pai** (lembrado por aparelho): na visão do Pai, Meses mostra os gastos dele (`viewAs: 'other'` em `monthOutflowItems`), por cartão, por data e por categoria.

## Banco (Supabase)

Tabelas, todas com `user_id` e RLS "cada um só o seu": `cards`, `months`, `incomes`, `bills`, `invoices`, `invoice_expenses`, `installment_plans`, `installment_payments`, `subscriptions`, `categories`. FKs compostas `(id, user_id)` impedem apontar para dado de outra pessoa. Views `v_installment_schedule`, `v_invoice_totals`, `v_month_summary` (security invoker). Triggers guardam identidade, datas de pagamento, cronograma, congelamento e o dia do gasto a partir da hora. Apagar a conta apaga tudo em cascata.

- Desenvolvimento: projeto `Aerarium`, ref `idvbrfbudoxvubxpqdzs` (dados fictícios dos testes e uma cópia antiga dos dados do dono). O CLI fica sempre vinculado a ele.
- Produção: projeto `aerarium-prod`, ref `kpzupvajcjhjoarxjcvq`. Só o usuário mexe: vincula, roda `db push` e volta o vínculo para o desenvolvimento.
- Migration nova entra primeiro no desenvolvimento; na produção, antes do push que depende dela.

## Telas

- **Meses**: barra de meses (lista, anterior, próximo ou criar), resumo azul (disponível, comprometido, entradas, saídas, falta pagar), entradas, e Saídas em três visões que o app lembra por aparelho: **Por data** (dias, hora, "Fixos do mês", fileira de cartões para filtrar), **Por tipo** (cartões, parcelas, contas, com círculo de pago e lixeira) e **Por categoria** (rosca, lista com % e comparação com o mês anterior). Resumo da fatura com o que entra sozinho, gastos lançados (tocar edita) e outros gastos.
- **Ajustes → Bancos conectados** (só o dono): ver a seção Open Finance.
- **Logos dos bancos** (`src/domain/banks.ts`, imagens em `public/banks`, desenhadas por `npm run banks` a partir dos ícones públicos da Pluggy): o cartão mostra o logo do banco escolhido no modal do cartão, ou o palpite pelo nome; a cor do cartão vem do banco; "Sem logo" volta ao desenho do cartão e só então aparecem as cores. O cartão grande leva o logo no canto. Embaixo do nome: final (do banco) e dia de vencimento. O Open Finance preenche fechamento e vencimento que estiverem vazios.
- **Cartões**: resumo das faturas do mês, um bloco por cartão, parcelas fora dos cartões e arquivados. **Tela do cartão** (estilo app de banco): topo azul com logo, final, vencimento ("faltam X dias"), total e situação da fatura do mês; limite disponível com anel (Open Finance, `bank_accounts.credit_limit`); próxima fatura e melhor dia pra comprar (dia seguinte ao fechamento); resumo da fatura; gráfico da fatura por mês (faixa com o mês selecionado sempre no centro, linha tracejada na previsão, arrastar encaixa) e o que tem no mês.
- **Lançar** (+): Gasto, Parcelado, Entrada; valor (digitado da esquerda pra direita, os pontos de milhar aparecem sozinhos e a vírgula começa os centavos: "1250" vira "1.250", em todo campo de valor), descrição, onde, categoria (com sugestão), quando (data e hora), já paguei, mês.
- **Assinaturas**; modais de edição de cartão, parcelamento, assinatura, conta, entrada e gasto.
- **Ajustes**: conta, formas de entrar, categorias (ícone, cor, nome), baixar meus dados (JSON), privacidade, sair, apagar conta (Edge Function, digitar APAGAR).
- Excel no cabeçalho. Aviso "Nova versão disponível" quando há deploy.

## Open Finance (Meu Pluggy)

Só para a conta do dono. Compras dos cartões chegam do banco pelo Meu Pluggy (grátis para uso pessoal, até 5 bancos, os dados atualizam uma vez por dia).

- **Edge Function `bank`** (`supabase/functions/bank`): proxy só de leitura. Confere o token de quem chama e só responde se for `PLUGGY_OWNER_USER_ID`; devolve contas de cartão, compras (`GET /v2/transactions`, paginação por cursor) e faturas dos itens em `PLUGGY_ITEM_IDS`. Secrets: `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`, `PLUGGY_ITEM_IDS`, `PLUGGY_OWNER_USER_ID`. No desenvolvimento, o item é o Sandbox Open Finance e o dono é a conta de teste `aerarium.e2e.banco@example.test`.
- **Regras** (`src/domain/bank.ts`): compra nova entra na fatura do mês (a fatura do banco, a aberta ou pelo dia de fechamento) com categoria sugerida; o nome é o do banco, exato, e a pessoa só escreve uma descrição se quiser (`invoice_expenses.note`); a mesma compra lançada à mão (mesmo cartão e valor, até 3 dias) é ligada, não duplicada, e pega o nome do banco (o que foi digitado vira a descrição); parcelada vira parcelamento (ou se liga a um feito à mão) e as parcelas seguintes só são reconhecidas; cobrança de assinatura cadastrada é reconhecida (avisa se o valor mudou); pagamentos e estornos são ignorados; fatura paga não recebe nada; mês que não existe espera ser criado. Fatura fechada no banco define o total ("outros" = o resto); fatura aberta que recebe compras tem o "outros" digitado zerado uma vez.
- **Tabelas**: `bank_accounts` (cartão do banco → cartão do app, com palpite pelo nome) e `bank_records` (tudo que já foi tratado, para nunca repetir). `invoice_expenses.external_id` e `installment_plans.external_key` ligam ao banco.
- **Telas**: Ajustes → Bancos conectados (cartão de cada conta e "Atualizar agora"). A primeira importação mostra uma prévia; depois, o app busca sozinho ao abrir se a última busca tem mais de 6 horas. Compras do banco dos últimos 3 dias mostram "novo".

## Regras de interface (critério de aceite)

Celular primeiro (conferir em 390×844). Nada pula de lugar ao trocar de mês ou filtrar. Nada importante cortado com "…". Ícones em SVG. Modais no centro. Barras fixas ao rolar. Lixeira com Desfazer. Sem rolagem lateral da página. Textos em pt-BR, tom casual, sem travessão ou hífen como pontuação. Acessibilidade AA (axe nos testes), foco visível, `prefers-reduced-motion`.

## Pendências e próximos passos

- **Open Finance** está na produção desde 28/09/2026 (migration, função `bank` e secrets com os 5 itens do Meu Pluggy). Falta a primeira importação pelo dono. Conectar bancos novos à aplicação da Pluggy só dá até o fim do teste de 15 dias do painel (aberto em 27/09/2026).
- SMTP próprio no Supabase (esqueci a senha para qualquer e-mail), marca na tela de consentimento do Google, e-mail de contato na política de privacidade: só se outras pessoas forem usar.
- Próximos passos em ordem: `docs/PLANO.md`.
