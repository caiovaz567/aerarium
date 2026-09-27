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
- **Dia de fechamento** do cartão manda gasto depois do fechamento para a fatura seguinte (sugestão no Lançar).
- **Categorias** (só saídas): lista por pessoa, criada na primeira abertura com 9 padrão (nome, cor, ícone de uma lista fixa); sugestão ao lançar pelo que a pessoa já escolheu para a mesma descrição, depois por palavras-chave. Gastos, contas, parcelamentos e assinaturas podem ter categoria.
- **Saídas do mês em pedaços** (`monthOutflowItems`): somam exatamente as saídas; a parte sem detalhe de cada fatura fica em "Outros gastos das faturas".
- **Por data**: gastos e contas com hora exata (`occurred_at`, fuso de São Paulo) agrupados por dia; o resto em "Fixos do mês". Comparação por categoria com o mês anterior quando muda R$ 20 ou mais.

## Banco (Supabase)

Tabelas, todas com `user_id` e RLS "cada um só o seu": `cards`, `months`, `incomes`, `bills`, `invoices`, `invoice_expenses`, `installment_plans`, `installment_payments`, `subscriptions`, `categories`. FKs compostas `(id, user_id)` impedem apontar para dado de outra pessoa. Views `v_installment_schedule`, `v_invoice_totals`, `v_month_summary` (security invoker). Triggers guardam identidade, datas de pagamento, cronograma, congelamento e o dia do gasto a partir da hora. Apagar a conta apaga tudo em cascata.

- Desenvolvimento: projeto `Aerarium`, ref `idvbrfbudoxvubxpqdzs` (dados fictícios dos testes e uma cópia antiga dos dados do dono). O CLI fica sempre vinculado a ele.
- Produção: projeto `aerarium-prod`, ref `kpzupvajcjhjoarxjcvq`. Só o usuário mexe: vincula, roda `db push` e volta o vínculo para o desenvolvimento.
- Migration nova entra primeiro no desenvolvimento; na produção, antes do push que depende dela.

## Telas

- **Meses**: barra de meses (lista, anterior, próximo ou criar), resumo azul (disponível, comprometido, entradas, saídas, falta pagar), entradas, e Saídas em três visões que o app lembra por aparelho: **Por data** (dias, hora, "Fixos do mês", fileira de cartões para filtrar), **Por tipo** (cartões, parcelas, contas, com círculo de pago e lixeira) e **Por categoria** (rosca, lista com % e comparação com o mês anterior). Resumo da fatura com o que entra sozinho, gastos lançados (tocar edita) e outros gastos.
- **Cartões**: resumo das faturas do mês, um bloco por cartão, parcelas fora dos cartões e arquivados. **Tela do cartão**: cartão grande, números, gráfico da fatura por mês (faixa com o mês selecionado sempre no centro, linha tracejada na previsão, arrastar encaixa) e o que tem no mês.
- **Lançar** (+): Gasto, Parcelado, Entrada; valor, descrição, onde, categoria (com sugestão), quando (data e hora), já paguei, mês.
- **Assinaturas**; modais de edição de cartão, parcelamento, assinatura, conta, entrada e gasto.
- **Ajustes**: conta, formas de entrar, categorias (ícone, cor, nome), baixar meus dados (JSON), privacidade, sair, apagar conta (Edge Function, digitar APAGAR).
- Excel no cabeçalho. Aviso "Nova versão disponível" quando há deploy.

## Regras de interface (critério de aceite)

Celular primeiro (conferir em 390×844). Nada pula de lugar ao trocar de mês ou filtrar. Nada importante cortado com "…". Ícones em SVG. Modais no centro. Barras fixas ao rolar. Lixeira com Desfazer. Sem rolagem lateral da página. Textos em pt-BR, tom casual, sem travessão ou hífen como pontuação. Acessibilidade AA (axe nos testes), foco visível, `prefers-reduced-motion`.

## Pendências e próximos passos

- **Open Finance (em andamento, ramo `novidades`)**: compras dos cartões pelo Meu Pluggy (grátis, uso pessoal, só na conta do dono, até 5 bancos, atualiza 1x por dia). Decisões: entram direto com categoria sugerida e sem duplicar o que foi lançado à mão; total da fatura vem do banco ("outros" vira a diferença); parceladas viram parcelamento e casam com as existentes; cobranças de assinaturas cadastradas não duplicam. Chaves só como secrets do Supabase.
- SMTP próprio no Supabase (esqueci a senha para qualquer e-mail), marca na tela de consentimento do Google, e-mail de contato na política de privacidade: só se outras pessoas forem usar.
- Ideias levantadas: projeção dos próximos meses, metas, orçamento por categoria, lembrete de vencimento, busca, lançar sem internet.
