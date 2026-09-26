# Aerarium: plano de migração pra app de verdade

Este documento é o guia completo pra recriar o Aerarium como um app web próprio, com login, banco de dados e instalação no iPhone. Ele foi escrito pra ser lido tanto por mim (Caio) quanto pelo Claude Code, que vai fazer a maior parte da implementação dentro do VS Code.

A versão atual do app roda como artifact no claude.ai, num único arquivo HTML. Ela está em `docs/referencia/aerarium-v1.html` e é a **fonte da verdade sobre telas, textos e comportamento**. Sempre que este plano e o HTML discordarem sobre como uma tela se comporta, vale o HTML, a não ser que o plano diga explicitamente que aquilo mudou de propósito (seção "Decisões que mudam em relação à v1").

---

## 1. O que é o Aerarium

App pessoal de finanças, pensado primeiro pro celular. Responde três perguntas:

1. **Quanto entrou, quanto saiu e quanto sobra este mês?** (aba Meses)
2. **Quanto vai vir em cada fatura de cartão, e do que ela é feita?** (aba Cartões e tela de cada cartão)
3. **Quais cobranças fixas eu tenho?** (aba Assinaturas)

O nome vem do latim: o *aerarium* era o tesouro público da Roma Antiga, guardado no Templo de Saturno. Por isso a marca é um templo pequeno (frontão, três colunas e base) ao lado da palavra Aerarium, escrita inteira numa cor só.

### Quem usa

* Hoje: só eu.
* Depois da migração: qualquer pessoa, entrando com e-mail e senha ou com a conta Google, cada uma vendo apenas os próprios dados. Decisão do usuário na Fase 3.
* Uso principal: iPhone, instalado na tela inicial como PWA. O computador é secundário, mas precisa funcionar bem.

---

## 2. Stack escolhida

| Camada | Escolha | Por quê |
|---|---|---|
| Build | Vite | Rápido, simples, bom suporte a PWA |
| UI | React + TypeScript | Tipagem pra dinheiro e datas, componentes reaproveitáveis |
| Rotas | React Router | Telas com URL própria (`/meses/2026-09`, `/cartoes/:id`) |
| Dados no front | TanStack Query | Cache, recarregamento e atualização otimista |
| Banco e login | Supabase (Postgres + Auth + Storage) | Dados relacionais, RLS por usuário, SQL pra relatórios, sem ficar preso |
| Datas | date-fns com locale pt-BR | Aritmética de meses sem dor |
| Excel | `write-excel-file`, importado só quando usado (troca da Fase 8: o SheetJS do npm está desatualizado, ver `docs/FASE_8.md`) | Mesma exportação da v1 |
| Gráfico | Componente SVG próprio | O comportamento é muito específico (seção 8.4), biblioteca atrapalharia |
| Testes | Vitest (domínio) + Playwright (telas no tamanho do iPhone) | |
| PWA | `vite-plugin-pwa` | Manifesto, ícones e service worker |
| Deploy | Vercel ligada ao GitHub | Cada push vira deploy |

Região do Supabase: **São Paulo (sa-east-1)**.

**Decisão de ambiente aprovada durante a Fase 0:** desenvolver com Supabase hospedado, sem exigir Docker ou WSL no computador. O projeto criado pelo usuário se chama `Aerarium` (nome sugerido inicialmente: `aerarium-dev`) e será usado para desenvolvimento e testes, com dados fictícios; produção será um projeto separado, `aerarium-prod`. A importação real só começa na Fase 3, em ambiente de teste designado. Migrations continuam versionadas em `supabase/migrations/`. O guia operacional está em `docs/SUPABASE_NUVEM.md`.

Novos projetos usam a chave pública `sb_publishable_...`, na variável `VITE_SUPABASE_PUBLISHABLE_KEY`, em substituição a `VITE_SUPABASE_ANON_KEY`. Chaves `sb_secret_...`, `service_role`, senha do banco e token pessoal do CLI nunca entram em variáveis `VITE_*` nem no Git.

---

## 3. Estrutura de pastas

```
aerarium/
  CLAUDE.md                      instruções curtas pro Claude Code (importa este plano)
  docs/
    PLANO_AERARIUM.md            este arquivo
    referencia/aerarium-v1.html  app atual, referência de comportamento
  supabase/
    migrations/                  SQL versionado (tabelas, views, RLS, storage)
    seed.sql                     dados de exemplo pra desenvolvimento (fictícios)
  scripts/
    import-backup.ts             importa o backup JSON da v1
    data/                        backup real (NUNCA vai pro Git)
  src/
    app/                         rotas, providers, layout
    domain/                      regras de negócio puras, sem React e sem Supabase
    data/                        cliente Supabase, queries e mutations
    features/
      meses/
      cartoes/
      cartao/                    tela de um cartão, com gráfico
      lancar/                    lançamento rápido (botão +)
      assinaturas/
      arquivados/
      exportar/
      login/
    ui/                          componentes genéricos (Modal, MoneyInput, CardArt, MonthBar, Toast...)
    styles/tokens.css            cores, fontes e espaçamentos
  tests/e2e/                     Playwright
```

**`.gitignore` obrigatório:** `scripts/data/`, `.env`, `.env.local`. O backup tem dados financeiros reais e não pode ir pro GitHub em hipótese nenhuma.

---

## 4. Modelo de domínio

### 4.1 Conceitos

* **Mês**: a unidade de planejamento (ex.: setembro de 2026). Tem entradas e saídas.
* **Entrada**: dinheiro que entra no mês (salário, freela, reembolso). Uma entrada especial é a **sobra do mês anterior**.
* **Conta** (saída comum): tudo que sai do mês e não é fatura de cartão (luz, seguro, investimento, pix). Pode estar paga ou em aberto.
* **Cartão**: nome, cor, foto opcional, dia de fechamento opcional.
* **Fatura**: a cobrança de um cartão num mês. Ela **não é um número digitado**: é montada por partes (seção 4.2).
* **Gasto lançado**: gasto avulso feito no cartão, com descrição, valor e data (ex.: Uber R$ 12). Entra na fatura do mês escolhido.
* **Parcelamento**: compra parcelada, no cartão ou fora dele. Tem valor da parcela, total de parcelas e mês da primeira.
* **Pagamento de parcela**: registro de que a parcela de um mês foi paga, com a data.
* **Assinatura**: cobrança fixa mensal, com dia, valor e cartão opcional.

### 4.2 Como a fatura é calculada (regra central)

```
total da fatura (cartão C, mês M) =
    soma das parcelas de C que caem em M
  + soma das assinaturas ativas de C
  + soma dos gastos lançados na fatura
  + outros gastos (parte não detalhada, digitada pelo usuário)
```

* O usuário **só digita "outros gastos"**. O resto o app sabe sozinho.
* Atalho **"Sei o total da fatura"**: o usuário digita o total real, e o app calcula `outros = total − (parcelas + assinaturas + gastos lançados)`. Se der negativo, o app **recusa** e explica: "O total não pode ser menor que parcelas + assinaturas (R$ X)".
* **Fatura estimada**: quando o mês é criado, a fatura nasce com `outros = 0` e marcada como estimada. Ela deixa de ser estimada quando o usuário edita os outros gastos ou informa o total.
* **Fatura paga fica congelada**: ao marcar como paga, o total do momento é gravado em `closed_total`. Dali pra frente, a tela mostra esse valor, mesmo que alguém mexa depois num parcelamento. Desmarcar o pago limpa o congelamento.

### 4.3 Parcelas: em quais meses caem

**Decisão da v2 (muda em relação à v1):** o cronograma é **fixo**. Um parcelamento com `total_installments = 10` e `first_month = 2026-09` cai de setembro de 2026 a junho de 2027, parcela 1/10 até 10/10, independente de estar pago ou não. É assim que a fatura de cartão funciona de verdade.

* "Faltam N" = total menos parcelas pagas.
* Quitado = todas as parcelas do cronograma pagas. Quitados vão pra **Arquivados**.
* Numeração exibida: "3/10" (parcela do mês / total).

Na v1 o cronograma "andava" quando uma parcela não era paga. Isso confundia, e a v2 não faz mais assim.

### 4.4 Pagamento de parcela

* Parcela de **cartão**: é marcada como paga automaticamente quando a **fatura daquele cartão naquele mês é marcada como paga** (origem `invoice`). Desmarcar a fatura desfaz esses pagamentos.
* Parcela **fora do cartão**: aparece como linha própria nas saídas do mês, no grupo "Parcelas". O círculo de check registra o pagamento com a data de hoje (origem `manual`).
* Também dá pra registrar um pagamento manual pela tela do parcelamento, escolhendo data e mês.

### 4.5 Saldo do mês

```
entradas = soma das entradas do mês
saídas   = soma das contas + soma dos totais das faturas + soma das parcelas fora de cartão do mês
disponível = entradas − saídas
comprometido (%) = saídas / entradas
falta pagar = soma do que ainda não está pago
```

### 4.6 Sobra do mês anterior

* Ao criar um mês novo, o app oferece levar o disponível do mês anterior como a entrada "Sobrou do mês passado".
* Se o mês anterior mudar depois, a tela do mês mostra uma dica: "Setembro fechou com R$ X. [Usar esse valor]".

### 4.7 Criar mês novo

Copia do mês anterior:

* **Entradas**, com o mesmo valor (exceto a sobra, que é recalculada).
* **Contas**, com o mesmo valor e como não pagas. Contadores tipo "2/12" no texto avançam pra "3/12".
* **Faturas**: uma por cartão, estimada, com `outros = 0` e a observação copiada (com o mesmo avanço de contador).
* Parcelas e assinaturas **não são copiadas**: elas aparecem sozinhas porque são calculadas.

### 4.8 Dia de fechamento (novo na v2, opcional)

Se o cartão tiver `closing_day`, um gasto lançado **depois** do fechamento cai automaticamente na fatura do mês seguinte. O modal de lançamento já mostra o mês certo selecionado, e o usuário pode trocar.

### 4.9 Decisões que mudam em relação à v1 e esclarecimentos da Fase 1

Escolhas consolidadas com a autonomia delegada pelo usuário. Estas regras prevalecem sobre ambiguidades do HTML e do modelo inicial abaixo:

* **Centavos na última parcela:** `final_adjustment`, zero por padrão, ajusta somente a última parcela. Exemplo: R$ 100 em três parcelas de R$ 33,33 termina em R$ 33,34. O ajuste deve ser menor, em módulo, que um centavo por parcela, e não pode zerar ou negativar a última. O cálculo em centavos no TypeScript entra na Fase 2.
* **Assinaturas sem histórico de versões:** a configuração atual de valor, cartão e atividade vale para todas as faturas abertas, inclusive de meses anteriores. Faturas pagas preservam seu total. Assinatura sem cartão é informativa e não cria automaticamente uma conta ou saída.
* **Congelamento somente do total:** `total` usa `closed_total` quando a fatura está paga. `calculated_total` e as partes mostram o cálculo atual e podem divergir do total pago. A futura tela deve explicar essa diferença. Não há fotografia histórica de cada componente nesta versão.
* **Reabertura preserva pagamento manual:** cada pagamento automático referencia a fatura que o criou (`invoice_id`). Reabrir remove somente esses pagamentos. Um pagamento manual anterior da mesma parcela não é substituído ao pagar a fatura e permanece ao reabri-la.
* **Histórico coerente:** o banco recusa pagamento fora do cronograma e edição que deixe pagamentos existentes fora dele. Para mover um plano com pagamentos automáticos para outro cartão, é necessário reabrir suas faturas antes. Identificador e dono são imutáveis, assim como a referência de um mês e o cartão/mês de uma fatura.
* **Déficit anterior:** somente a entrada `carryover` pode ser negativa; existe no máximo uma por mês. Entradas totais menores ou iguais a zero geram `committed_ratio = null`, para a interface apresentar o percentual como indisponível.
* **Exclusão de cartão:** conforme as FKs do plano, remove suas faturas, gastos e pagamentos automáticos; preserva planos e assinaturas sem cartão e os pagamentos manuais. Isso pode alterar os resumos de meses anteriores. A futura confirmação e restauração precisam considerar todos esses registros, não apenas o cartão.
* **Datas padrão:** datas de gasto e pagamento usam `America/Sao_Paulo`. O mês explicitamente escolhido pelo usuário prevalece sobre a sugestão de fechamento; o banco não realoca o gasto sozinho.
* **Estimativa e importação:** alterar `other_amount` remove a estimativa; confirmar o mesmo valor exige enviar `estimated = false`. Para importar fatura paga, inserir primeiro a composição e depois marcar paga, pois o banco calcula o congelamento. Valores históricos que divirjam da composição devem ser conciliados e relatados na Fase 3, sem sobrescrever silenciosamente `closed_total`.
* **Texto do atalho:** a recusa de "Sei o total" deve mencionar também os gastos lançados: "O total não pode ser menor que parcelas + assinaturas + gastos lançados (R$ X)".

---

## 5. Banco de dados (Supabase)

### 5.1 Princípios

* Toda tabela tem `user_id` e **RLS ligado**. Regra única: cada usuário só lê e escreve as próprias linhas.
* Chaves estrangeiras compostas `(id, user_id)` impedem uma linha de apontar pra dado de outra pessoa.
* Meses são guardados como `date` no primeiro dia do mês (`2026-09-01`), o que facilita `generate_series`.
* Dinheiro é `numeric(12,2)` no banco e **centavos inteiros** no TypeScript. Nunca `float`.
* Totais são **calculados** (views e funções), não gravados. A única exceção é `invoices.closed_total`.

### 5.2 Tabelas

O SQL abaixo descreve o modelo inicial (a coluna `photo_path` de `cards` foi removida depois da Fase 8). A definição executável completa está nas migrations de `supabase/migrations/`, incluindo `final_adjustment`, `installment_payments.invoice_id`, constraints e triggers das decisões da seção 4.9. Não executar este bloco isoladamente para criar o banco.

```sql
create table cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (length(name) between 1 and 60),
  color text check (color ~ '^#[0-9A-Fa-f]{6}$'),
  photo_path text,
  closing_day smallint check (closing_day between 1 and 31),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table months (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  ref date not null check (extract(day from ref) = 1),
  created_at timestamptz not null default now(),
  unique (user_id, ref),
  unique (id, user_id)
);

create table incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  month_id uuid not null,
  description text not null,
  amount numeric(12,2) not null check (amount >= 0),
  kind text not null default 'normal' check (kind in ('normal','carryover')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  foreign key (month_id, user_id) references months (id, user_id) on delete cascade
);

create table bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  month_id uuid not null,
  description text not null,
  amount numeric(12,2) not null check (amount >= 0),
  paid boolean not null default false,
  paid_on date,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  foreign key (month_id, user_id) references months (id, user_id) on delete cascade
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  card_id uuid not null,
  month_id uuid not null,
  other_amount numeric(12,2) not null default 0 check (other_amount >= 0),
  estimated boolean not null default true,
  note text,
  paid boolean not null default false,
  paid_on date,
  closed_total numeric(12,2),
  unique (card_id, month_id),
  unique (id, user_id),
  foreign key (card_id, user_id) references cards (id, user_id) on delete cascade,
  foreign key (month_id, user_id) references months (id, user_id) on delete cascade
);

create table invoice_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  invoice_id uuid not null,
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  spent_on date not null default current_date,
  created_at timestamptz not null default now(),
  foreign key (invoice_id, user_id) references invoices (id, user_id) on delete cascade
);

create table installment_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  card_id uuid,
  description text not null,
  installment_amount numeric(12,2) not null check (installment_amount > 0),
  total_installments smallint not null check (total_installments between 1 and 120),
  first_month date not null check (extract(day from first_month) = 1),
  note text,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (card_id, user_id) references cards (id, user_id) on delete set null (card_id)
);

create table installment_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  plan_id uuid not null,
  month date not null check (extract(day from month) = 1),
  paid_on date not null default current_date,
  source text not null default 'manual' check (source in ('manual','invoice')),
  unique (plan_id, month),
  foreign key (plan_id, user_id) references installment_plans (id, user_id) on delete cascade
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  card_id uuid,
  name text not null,
  amount numeric(12,2) not null check (amount > 0),
  charge_day smallint not null check (charge_day between 1 and 31),
  note text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (card_id, user_id) references cards (id, user_id) on delete set null (card_id)
);
```

### 5.3 RLS (repetir pra cada tabela)

```sql
alter table cards enable row level security;
create policy "dono lê e escreve" on cards
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

Criar a mesma policy em: `cards`, `months`, `incomes`, `bills`, `invoices`, `invoice_expenses`, `installment_plans`, `installment_payments`, `subscriptions`.

**Teste obrigatório de RLS** (na fase 1): criar dois usuários de teste e confirmar que o usuário B não lê, não altera e não referencia nenhuma linha do usuário A.

### 5.4 Views de cálculo

* `v_installment_schedule`: uma linha por parcela de cada plano (`plan_id`, `month`, `number`, `paid`, `paid_on`), usando `generate_series(first_month, first_month + (total − 1) meses, '1 month')`.
* `v_invoice_totals`: por fatura, as partes (`installments_amount`, `subscriptions_amount`, `expenses_amount`, `other_amount`) e o `total` (ou `closed_total` quando paga).
* `v_month_summary`: por mês, `incomes`, `outflows`, `available`, `unpaid`.

Todas as views com `security_invoker = true`, pra respeitar o RLS de quem consulta.

A mesma lógica deve existir em `src/domain` (TypeScript, com testes). O banco é a verdade na hora de consultar, mas o domínio em TypeScript permite atualização otimista na tela sem esperar o servidor. Os testes do domínio e das views têm que concordar nos mesmos casos (seção 11).

### 5.5 Fotos dos cartões (Storage)

**Removido a pedido do usuário depois da Fase 8:** o app não tem mais foto de cartão. A migration `20260925000100_remove_card_photos.sql` apagou o bucket `card-photos` (estava vazio), suas policies e a coluna `cards.photo_path`. O texto abaixo fica só como histórico.

* Bucket privado `card-photos`.
* Caminho: `{user_id}/{card_id}.jpg`.
* Policy em `storage.objects`: só permite ler e escrever quando `(storage.foldername(name))[1] = auth.uid()::text`.
* A imagem é reduzida no navegador antes do upload (lado maior com 900px, JPEG qualidade 0.85). A exibição usa URL assinada.

### 5.6 Exclusão de conta (LGPD)

* Uma Edge Function `delete-account` apaga o usuário em `auth.users` (o `on delete cascade` apaga o resto). Sem fotos de cartão, não há arquivos no Storage pra apagar.
* Botão em Configurações: "Apagar minha conta e meus dados", com confirmação digitando APAGAR.
* Botão "Baixar meus dados" (JSON com tudo).

---

## 6. Importação do backup da v1

Arquivo: `scripts/data/aerarium-backup-2026-09-24.json` (fora do Git). Formato: `{ months, parcelamentos, assinaturas, cartoes }`, cada um um objeto `id → documento`.

O script `scripts/import-backup.ts` roda **localmente**. **Mudança da Fase 3:** em vez da chave `service_role`, usa o login do Supabase CLI e grava como o próprio usuário, com RLS valendo (detalhes em `docs/FASE_3.md`). Nenhuma chave secreta é lida. Recebe o e-mail da conta de destino, busca o `user_id` e grava tudo em nome dela. Precisa ser **idempotente**: rodar duas vezes não duplica nada (usar uma tabela ou arquivo de mapeamento de ids antigos pra novos, ou apagar os dados do usuário antes com confirmação).

### 6.1 Como a v1 guardava os dados

```ts
// cartoes/{id}
{ nome, ordem, saida, saidaNome, cor?, foto? }
// saida = chave normalizada da descrição da fatura nos meses, ex.: "fatura nubank"

// months/{YYYY-MM}
{
  entradas: [{ id, desc, valor }],
  saidas: [{
    id, desc, valor, pago?,
    // quando é fatura de cartão:
    outros?, est?, obs?, gastos?: [{ id, desc, valor, data }],
    // quando é linha automática de parcela fora de cartão:
    parc?
  }]
}

// parcelamentos/{id}
{ item, valor, faltam, obs?, ordem, cartao?, saida?, saidaNome?,
  pagamentos?: [{ data: "YYYY-MM-DD", mes: "YYYY-MM", via?: "mes" }] }

// assinaturas/{id}
{ nome, dia, valor, cartaoId?, cartao?, obs? }
```

### 6.2 Função de normalização (igual à v1)

```ts
const cleanDesc = (d: string) =>
  d.replace(/\([^)]*\)/g, ' ').replace(/\b\d{1,2}\/\d{1,2}\b/g, ' ').replace(/\s+/g, ' ').trim()
const norm = (d: string) =>
  cleanDesc(d).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
```

Uma saída do mês é a **fatura do cartão C** quando `norm(saida.desc) === C.saida`.

### 6.3 Mapeamento

| v1 | v2 |
|---|---|
| `cartoes/*` | `cards` (`name = nome`, `color = cor`, `sort_order = ordem`; foto não é migrada, o usuário coloca de novo) |
| `months/{YYYY-MM}` | `months` (`ref = YYYY-MM-01`) |
| entrada com descrição contendo "sobr" | `incomes` com `kind = 'carryover'` |
| demais entradas | `incomes` |
| saída que é fatura de cartão | `invoices`: `paid = pago`, `estimated = est`, `note = obs` (ou a descrição original quando ela traz algo além do nome padrão da fatura), `gastos` viram `invoice_expenses`, e `other_amount = max(0, outros − soma(gastos))`. Se `outros` não existir, calcular `valor − parcelas do mês − assinaturas do cartão` |
| saída com `parc` | **ignorar** (é derivada do parcelamento) |
| demais saídas | `bills` (`paid = pago`) |
| `parcelamentos/*` | `installment_plans`: `description = item`, `installment_amount = valor`, `total_installments = faltam + pagamentos.length`, `first_month` = menor `mes` entre os pagamentos, ou o mês atual se não houver pagamento. `card_id` pelo `cartao` |
| `pagamentos[]` | `installment_payments` (`source = 'invoice'` quando `via === 'mes'`, senão `'manual'`) |
| `assinaturas/*` | `subscriptions` (`card_id` pelo `cartaoId`) |

### 6.4 Conferência depois de importar

O script imprime, pra cada mês: entradas, saídas e disponível **calculados na v2**, lado a lado com os mesmos números **calculados a partir do backup** com as regras da v1. Diferenças aceitáveis só onde a seção 4.3 (cronograma fixo) muda o resultado, e o script deve listar essas diferenças explicitamente, uma por linha, pra eu conferir.

---

## 7. Design

### 7.1 Tokens (copiar da v1 pra `src/styles/tokens.css`)

Tema claro:

```css
--bg:#F1F2F6; --surface:#FFFFFF; --surface-2:#E7E9F1; --ink:#161A26; --muted:#62697E; --line:#E0E3EC;
--accent:#3140C2; --accent-ink:#FFFFFF; --accent-soft:#E3E6FA;
--hero:#2B39B3; --hero-ink:#FFFFFF; --hero-muted:rgba(255,255,255,.74); --hero-track:rgba(255,255,255,.22);
--pos:#18794A; --pos-soft:#DCF1E4; --neg:#B23526; --neg-soft:#F8E1DD; --warn:#8F5C00; --warn-soft:#FBEFD6;
```

Na Fase 10, `--neg` (era `#BE3A2B`) e `--warn` (era `#9A6300`) do tema claro escureceram um pouco para passar no contraste AA sobre os fundos suaves (etiqueta ESTIMADA, botão de excluir, comparação do gráfico).

Tema escuro (automático por `prefers-color-scheme`, e forçável com `data-theme`):

```css
--bg:#0D0F15; --surface:#161922; --surface-2:#1F2330; --ink:#E9EBF3; --muted:#959CB2; --line:#272B39;
--accent:#8F9AFF; --accent-ink:#0D0F15; --accent-soft:#22274A;
--hero:#27339A; --hero-track:rgba(255,255,255,.18);
--pos:#52CC8E; --pos-soft:#14291E; --neg:#FF8272; --neg-soft:#37191A; --warn:#F0B44C; --warn-soft:#2E2412;
```

Fontes (Google Fonts): **Bricolage Grotesque** 600 e 800 pra títulos e números grandes; **Figtree** 400 a 700 pro resto. Números sempre com `font-variant-numeric: tabular-nums`.

### 7.2 Dinheiro e datas

* Formato: `R$ 1.147,29` (`Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`).
* Versão curta, sem centavos, em linhas de composição e rótulos do gráfico: `R$ 1.147`.
* Campo de valor aceita `12`, `12,5`, `1.147,29` e `1147.29`. Teclado numérico no celular (`inputmode="decimal"`).
* Meses: "Setembro 2026" em títulos, "set" em rótulos curtos, "jan/27" quando for janeiro.

### 7.3 Cor e miniatura dos cartões

Cada cartão tem uma miniatura (proporção de cartão real, 1,586) com degradê da cor, um chip dourado e, na versão grande, o nome e o símbolo de aproximação. (Foto de cartão foi removida depois da Fase 8, a pedido do usuário.) **Nunca desenhar logotipo de banco nem bandeira**, só a cor.

Cor automática pelo nome (a primeira bolinha de cor no Editar é sempre essa):

| Nome contém | Cor |
|---|---|
| nubank, nu | #820AD1 |
| itau | #EC7000 |
| santander | #CC0000 |
| mercado pago | #009EE3 |
| picpay | #11C76F |
| smiles | #F26722 |
| revolut | #191C1F |
| inter | #FF7A00 |
| c6 | #2B2B2B |
| bradesco | #CC092F |
| caixa | #005CA9 |
| banco do brasil, bb, ourocard | #F5C400 (texto escuro) |
| xp | #111111 |
| btg | #0B2D5B |
| neon | #00A5D8 |
| pan | #00AEEF |
| will | #FFD500 |
| next | #00C96B |

Sem correspondência: uma cor da paleta `#3140C2 #820AD1 #CC0000 #EC7000 #F5C400 #11C76F #009EE3 #191C1F #6B7280 #D6336C`, escolhida por hash do nome. Texto sobre a cor: escuro quando a luminância passar de 0,62, senão branco.

### 7.4 Regras de interface que vieram de correções (não quebrar)

Cada item abaixo veio de algo que eu reclamei na v1. Valem como critério de aceite em todas as fases.

1. **Celular primeiro.** Toda tela é validada em 390×844 (iPhone) antes de qualquer ajuste de computador.
2. **Nada pula de lugar.** Trocar de mês, selecionar um ponto do gráfico ou mostrar e esconder uma etiqueta não pode mudar a altura dos blocos de cima. Espaço de elementos opcionais fica reservado.
3. **Informação importante não é cortada com "…" no celular.** Nome de cartão e composição da fatura quebram linha. A quebra acontece **entre itens** ("3 parcelas R$ 876 · outros R$ 271"), nunca no meio de um item.
4. **Ícones são SVG**, nunca caracteres como ‹ › +, que não centralizam direito.
5. **Modais no centro da tela**, com fundo escurecido e desfocado e animação curta de "pop". Em tela baixa (teclado aberto no iPhone), o modal sobe pro topo. Modal nunca tem rolagem lateral.
6. **Barras fixas ao rolar:** a barra de meses (Meses e Cartões) e a barra de voltar da tela do cartão grudam logo abaixo do cabeçalho, com uma sombra leve quando grudadas. Nesse momento a sombra do cabeçalho some, pra não duplicar.
7. **Botão de lançar** sempre visível. **Mudança da Fase 4, pedida pelo usuário:** no celular, a barra de baixo tem cinco espaços iguais (Meses, Cartões, **+** no meio e levantado, Assinaturas, Ajustes), e a engrenagem sai do cabeçalho. No computador vira o botão "+ Lançar" ao lado das abas, e Ajustes fica no cabeçalho.
8. **Lixeira visível** nas linhas, sem precisar abrir o item. Toda exclusão mostra um aviso com **Desfazer**.
9. **Sem legenda e sem texto óbvio** quando o visual já explica (ex.: linha tracejada = previsão).
10. **Sem repetição:** a observação da fatura só aparece quando diz algo além do nome padrão.
11. **Marca:** templo + "Aerarium" numa cor só. Nunca pintar metade da palavra.
12. **Hover só em aparelho com mouse** (`@media (hover:hover) and (pointer:fine)`): miniatura do cartão levanta e inclina, com brilho passando; cartão grande inclina em 3D seguindo o mouse.
13. **Textos em português, tom casual e direto.** Nos textos da interface, evitar travessão e hífen como pontuação: usar vírgula, dois pontos ou parênteses.
14. **Acessibilidade básica:** foco visível, `aria-label` em botões só com ícone, contraste AA, `prefers-reduced-motion` desliga animações.

---

## 8. Telas

### 8.1 Estrutura geral

* **Cabeçalho** fixo: marca à esquerda; à direita o estado de sincronização ("Salvo", "Salvando…", "Não salvou") e o botão Excel.
* **Abas** embaixo no celular: Meses, Cartões, o botão +, Assinaturas e Ajustes (item 7 da seção 7.4). No computador (a partir de 760px), um seletor em pílula logo abaixo do cabeçalho, com Ajustes no cabeçalho.
* **Rotas:** `/meses/:ym`, `/cartoes`, `/cartoes/:id`, `/assinaturas`, `/config`, `/login`.
* Área segura do iPhone respeitada (`viewport-fit=cover` + `env(safe-area-inset-*)`).
* Conteúdo com largura máxima de 720px no computador, centralizado.

### 8.2 Meses

1. **Barra de meses** (fixa ao rolar): ‹, nome do mês com o ano (tocar abre a lista de meses), › ou **+** quando for o último mês (cria o próximo, seção 4.7).
2. **Resumo** (bloco azul): "Disponível em Setembro", etiqueta "No vermelho" quando negativo, valor grande, barra de comprometido (vermelha acima de 100%), legenda "X% do que entrou já está comprometido", e três números: Entradas, Saídas, Falta pagar.
3. **Entradas:** descrição, valor e lixeira. Tocar abre a edição. Dica de sobra quando o mês anterior mudou (seção 4.6).
4. **Saídas**, com cabeçalho "X de Y pagas" e o total, em três grupos com subtotal:
   * **Cartões**: círculo de pago, miniatura, nome do cartão e valor na primeira linha. Embaixo, uma linha que ocupa a largura toda: observação (um pouco mais clara), depois a composição com valores redondos. Etiqueta ESTIMADA quando for o caso. Tocar abre o **resumo da fatura**.
   * **Parcelas**: parcelas fora de cartão que caem no mês. "3/10 · faltam 7". Círculo registra o pagamento.
   * **Contas e outros**: descrição, valor, círculo e lixeira.
5. Bloco vazio mostra "Nenhuma saída ainda. Toca no + pra lançar."

**Resumo da fatura** (modal):

* Topo: miniatura, nome do cartão, "Fatura de Setembro 2026" e a etiqueta estimada, se for o caso.
* **Já entram sozinhas:** parcelas do mês (com "paga em 23/09" ou "parcela 3/10") e assinaturas. Tocar abre o item.
* **Gastos lançados:** descrição, data, valor e um × pra remover.
* **O resto da fatura:** campo "Outros gastos" e o link "Sei o total da fatura", que mostra o campo de total (seção 4.2).
* **Total da fatura** em destaque, atualizando enquanto digita. Fica vermelho se o total digitado for impossível.
* Observação, "Já paguei" e o botão "Ver cartão".

### 8.3 Cartões

* **Barra de meses** igual à de Meses.
* **Resumo:** "Faturas de Setembro" com o total, uma barra empilhada (parcelas, assinaturas, outros) e os três valores. Rodapé: "Parcelas em aberto no total: R$ X".
* **Um bloco por cartão:**
  * Cabeçalho com miniatura e nome (tocar abre a tela do cartão), situação ("Fatura paga", "Fatura em aberto", "Sem fatura em outubro"), valor e botão Editar.
  * Barra empilhada com legenda curta. Aviso quando a fatura está abaixo de parcelas + assinaturas.
  * Parcelas do mês com círculo de pagar.
  * Linha de assinaturas, que leva pra aba Assinaturas.
  * "+ Parcela neste cartão".
* Bloco **Fora dos cartões** pras parcelas sem cartão.
* **+ Novo cartão.**
* **Arquivados** (recolhível, lembra se estava aberto): parcelamentos quitados com a miniatura do cartão (ou um contorno tracejado quando fora de cartão), "Quitado em 24/09/2026 · 10 pagamentos · NuBank", valor e lixeira.

### 8.4 Tela do cartão (`/cartoes/:id`)

* **Barra fixa:** voltar (SVG), nome do cartão e Editar. Esc volta no computador.
* **Cartão grande** (até 280px de largura). No computador, fica ao lado dos números.
* **Três números:** Parcelas em aberto (R$), Última parcela (mês), Assinaturas (R$/mês).
* **Bloco do gráfico:**
  * Topo: "Outubro 2026 · em aberto", valor grande e, numa linha de **altura fixa**, a comparação com o mês anterior: "▼ R$ 270,42 (23,6%) vs set" em verde quando baixou, ▲ em vermelho quando subiu, "igual a set" em cinza. Sem comparação, a linha fica vazia mas continua ocupando o espaço. Botões ‹ › à direita.
  * "média 6 meses R$ X" (ou "média N meses" enquanto houver menos), só com meses de fatura real. Aparece só com pelo menos 2 meses.
  * O gráfico (abaixo).
* **"O que tem em outubro":** parcelas, assinaturas, gastos lançados e "outros gastos não detalhados".
* **Parcelas** do cartão, com círculo de pagar e "+ Parcela neste cartão".
* **Assinaturas** do cartão, quando houver.

**O gráfico, em detalhe:**

* Linha suave (spline monotônica, sem ultrapassar os pontos) com o total da fatura por mês, e área em degradê embaixo.
* **Linha cheia** nos meses com fatura real e **tracejada** nos meses de previsão (futuro sem fatura lançada, onde o valor é parcelas + assinaturas).
* **Meses vazios no chão:** sempre existem pelo menos 6 meses antes e 6 depois do mês atual. Sem dado, o ponto fica no zero, apagado, com "R$ 0". Esses meses não entram na média nem na comparação.
* **Faixa centralizada:** o mês selecionado fica **sempre no centro**, com o passado à esquerda e o futuro à direita. Ao abrir, o selecionado é o mês atual, marcado com um pontinho embaixo do nome.
  * Tocar num mês faz a faixa deslizar suave até ele ficar no centro.
  * Arrastar e soltar faz a faixa encaixar no mês mais próximo do centro (por volta de 120ms depois do fim da rolagem), e esse mês vira o selecionado.
  * Setas ← → do teclado e botões ‹ › andam um mês.
  * Espaço por mês: `max(76px, largura do rótulo de valor, min(170px, largura / 4,2))`. Margem de meia tela de cada lado, pra primeira e última posição poderem ficar no centro.
* **Rótulos embaixo de cada mês:** abreviação ("set", "jan/27") e o valor redondo ("R$ 1.147"). O selecionado fica em destaque.
* **Sem legenda, sem eixo com números**, só duas linhas de grade bem fracas.
* Altura da área do gráfico proporcional à largura: `clamp(170px, largura × 0,5, 280px)`.
* Redesenha quando a largura muda (ResizeObserver), mantendo o selecionado no centro.
* Ao abrir, a linha se desenha da esquerda pra direita, uma vez. Sem animação se `prefers-reduced-motion`.
* A faixa ocupa a largura toda do bloco, com as bordas esmaecendo.

### 8.5 Lançar (modal do botão +)

* Três tipos no topo: **Gasto**, **Parcelado**, **Entrada**.
* **Valor** em fonte grande, com teclado numérico aberto automaticamente.
* **Parcelado:** "Valor total da compra" e "Em quantas vezes", com a prévia "10x de R$ 120,00, começando este mês". A última parcela absorve o arredondamento, pra soma bater com o total. **Decisão do usuário depois da Fase 7:** o campo "Primeira parcela em" deixa escolher o mês da primeira parcela; a sugestão segue a mesma regra do "Entra em" (incluindo o dia de fechamento) e a prévia diz quando começa ("começando em outubro").
* **Descrição**, com exemplo que muda conforme o tipo (Uber, Notebook, Freela).
* **Onde** (Gasto e Parcelado): grade de duas colunas com todos os cartões (miniatura e nome inteiro) e a opção **Pix, boleto ou dinheiro** (ícone de carteira). Lembra a última escolha.
* **Já paguei:** só aparece com Pix, boleto ou dinheiro. Vem marcado, e desmarcar serve pra contas a pagar.
* **Entra em:** o mês. Padrão: o mês que está aberto na aba Meses, senão o mês atual, respeitando o dia de fechamento do cartão (seção 4.8).
* Resultado:
  * Gasto no cartão: vira um gasto lançado na fatura daquele mês (cria a fatura se não existir).
  * Gasto fora do cartão: vira uma conta, paga ou não.
  * Parcelado: vira um parcelamento a partir do mês escolhido em "Primeira parcela em".
  * Entrada: vira uma entrada.
* Aviso com **Desfazer**: "R$ 12,00 na fatura Santander Unique".

### 8.6 Assinaturas

* Lista com dia da cobrança, nome, cartão, observação e valor. Total mensal no topo.
* Edição: nome, dia, valor, cartão (lista de cartões ou "Nenhum"), observação. Lixeira com Desfazer.

### 8.7 Modais de edição

* **Cartão:** cartão grande de prévia no topo (atualiza enquanto edita), nome, bolinhas de cor (a primeira é a cor do banco), dia de fechamento (opcional), Excluir com Desfazer.
* **Parcelamento:** descrição, cobrado em (cartão ou nenhum), observação, valor da parcela, total de parcelas, mês da primeira, e o histórico de pagamentos com opção de remover um pagamento.
* **Entrada e conta:** descrição, valor, "Já paguei" (contas).

### 8.8 Exportar Excel

Uma planilha por mês (entradas, saídas, totais), mais "Parcelamentos", "Cartões" e "Assinaturas". Nome do arquivo: `Aerarium_AAAA-MM-DD.xlsx`. Valores com formato de moeda.

### 8.9 Login

Tela simples: marca, uma frase ("Suas finanças, mês a mês"), o botão "Entrar com Google" e a opção de entrar ou criar conta com e-mail e senha (com "Esqueci a senha"). Depois do login, vai direto pro mês atual. Em Configurações: sair, baixar meus dados, apagar minha conta.

---

## 9. Fases de implementação

Regra de ouro: **uma fase por vez**. No fim de cada fase o Claude Code para, mostra o que fez, roda os testes e espera eu conferir antes de seguir. Cada fase termina com um commit.

### Fase 0: fundação

* Projeto Vite + React + TypeScript (modo estrito), ESLint, Prettier, Vitest, Playwright.
* `src/styles/tokens.css` com os tokens da seção 7.1 e as fontes.
* Supabase CLI inicializado (`supabase/`), autenticado e vinculado ao projeto de desenvolvimento na nuvem, na região São Paulo. Docker e WSL são opcionais.
* `.env.example` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. `.gitignore` com `scripts/data/`, `.env*` (menos o `.env.example`).
* README curto com os comandos.

**Pronto quando:** `npm run dev` abre uma página com o cabeçalho do Aerarium (templo + nome), nos dois temas, `npm test` passa, e `npm run supabase:check` confirma acesso ao projeto de desenvolvimento com a chave pública. A checagem de conexão não substitui os testes de banco da Fase 1.

### Fase 1: banco

* Migrations com as tabelas (5.2), RLS (5.3), views (5.4) e o bucket de fotos (5.5).
* `seed.sql` com dados fictícios: 3 cartões, 4 meses, parcelas no meio do cronograma, uma assinatura, uma fatura paga.
* Teste de RLS com dois usuários.

**Pronto quando:** todas as migrations são aplicadas sem erro em um projeto de desenvolvimento vazio com `supabase db push`, o seed fictício é carregado nesse ambiente, o teste de RLS com dois usuários passa e as views devolvem os totais esperados pro seed (conferidos à mão e documentados no próprio teste). Testes isolam e removem apenas seus próprios dados. Não usar `db reset --linked` nem executar seed/testes em produção. A reprodução completa em banco vazio deve usar um ambiente descartável de testes, sem apagar o ambiente com dados reais.

### Fase 2: domínio em TypeScript

Em `src/domain`, funções puras com testes:

* `money.ts`: centavos, formatação completa e curta, leitura do que foi digitado.
* `months.ts`: somar e subtrair meses, rótulos, "jan/27".
* `installments.ts`: cronograma fixo, número da parcela, faltam, quitado.
* `invoices.ts`: partes e total da fatura, "sei o total", congelamento quando paga.
* `balance.ts`: disponível, comprometido, falta pagar.
* `newMonth.ts`: cópia do mês anterior com avanço de "2/12" pra "3/12".
* `closing.ts`: em qual fatura cai um gasto, pelo dia de fechamento.
* `chartSeries.ts`: a série do gráfico do cartão, com meses vazios antes e depois, previsão, média e comparação.

**Pronto quando:** cobertura alta nesses arquivos, e os mesmos casos do seed batem com as views da fase 1.

### Fase 3: importação do backup

* `scripts/import-backup.ts` conforme a seção 6, idempotente, com o relatório de conferência.

**Pronto quando:** importo meu backup numa conta de teste e o relatório só aponta diferenças explicadas pelo cronograma fixo.

### Fase 4: login e esqueleto

* Supabase Auth com Google e com e-mail e senha. Tela de login (8.9). Rotas protegidas.
* Layout: cabeçalho com estado de sincronização, abas (8.1), botão flutuante de lançar, toasts com Desfazer, componente de modal central (7.4 item 5), barra fixa ao rolar (7.4 item 6).
* TanStack Query configurado, com atualização otimista.

**Pronto quando:** entro com o Google e com e-mail e senha no celular e no computador, navego entre abas vazias, e o Playwright valida o layout em 390×844 e 1280×800.

### Fase 5: Meses

Tudo da seção 8.2, incluindo o resumo da fatura e a criação de mês novo (4.7).

**Pronto quando:** com meus dados importados, setembro e outubro mostram os mesmos números da v1 (ou as diferenças listadas na fase 3).

### Fase 6: Cartões e tela do cartão

Seções 8.3 e 8.4, com o gráfico completo.

**Pronto quando:** o gráfico centraliza o mês atual ao abrir, desliza ao tocar, encaixa ao arrastar, não muda a altura de nada ao trocar de mês, e se redesenha ao girar o celular.

### Fase 7: Lançar

Seção 8.5, incluindo o dia de fechamento.

**Pronto quando:** consigo lançar um Uber de R$ 12 no Santander em menos de 5 segundos no iPhone, e desfazer pelo aviso.

### Fase 8: Assinaturas, arquivados, edições, fotos e Excel

Seções 8.6, 8.7, 8.8, 5.5 e o hover da 7.4 item 12. (As fotos da 5.5 foram feitas e depois removidas a pedido do usuário.)

### Fase 9: PWA e deploy

Seções 10.2 e 10.3.

**Pronto quando:** instalo pelo Safari → Compartilhar → Adicionar à Tela de Início, o app abre em tela cheia com o ícone do templo, e um push no GitHub atualiza o app no celular.

### Fase 10: acabamento

Entrega e decisões em `docs/FASE_10.md`.

* Configurações: sair, baixar meus dados (JSON), apagar conta (5.6).
* Política de privacidade curta (quais dados, onde ficam, como apagar).
* Estados de erro e sem internet: mensagem clara, nada de tela em branco.
* Revisão de acessibilidade (7.4 item 14).

---

## 10. Infra

### 10.1 Supabase

1. Usar o projeto `Aerarium`, já criado na região São Paulo, para desenvolvimento. Criar `aerarium-prod` separadamente quando chegar a etapa de produção.
2. Autenticar o CLI (`supabase login`), vincular o projeto de desenvolvimento (`supabase link --project-ref ...`) e aplicar migrations versionadas (`supabase db push`). Conferir o destino e executar `supabase db push --dry-run` antes de aplicar. Esses passos não exigem a stack local.
3. **Authentication → Providers → Google:** criar um OAuth Client no Google Cloud Console (tipo "Web application") com o redirect `https://<projeto>.supabase.co/auth/v1/callback`, e colar o Client ID e o Secret no Supabase.
4. **Authentication → URL Configuration:** Site URL com o domínio da Vercel, e `http://localhost:5173` nos redirects permitidos.
5. Backups: conferir o que o plano do Supabase oferece, e manter a exportação manual (botão "Baixar meus dados") como segurança extra.

### 10.2 Vercel

1. Importar o repositório do GitHub.
2. Variáveis de ambiente: `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`, apontando para o ambiente correto (preview em desenvolvimento, produção em `aerarium-prod`). A chave pública pode ficar no front porque quem protege os dados é o RLS. `service_role` e `sb_secret_...` **nunca** vão para o front nem para as variáveis da Vercel deste app.
3. `vercel.json` com rewrite de todas as rotas pra `index.html` (app de página única).
4. Domínio: o `.vercel.app` serve. Domínio próprio é opcional.

### 10.3 PWA

* `vite-plugin-pwa` com o manifesto: `name` "Aerarium", `short_name` "Aerarium", `display` "standalone", `theme_color` e `background_color` `#0D0F15`, `start_url` "/", `lang` "pt-BR".
* Ícones: 192, 512 e maskable 512, mais o `apple-touch-icon` de 180×180 (templo claro sobre fundo `#3140C2`, cantos retos, porque o iOS arredonda sozinho).
* Metas pro iPhone: `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style` = `black-translucent`, `viewport-fit=cover`.
* Service worker guarda só a casca do app (HTML, JS, CSS, fontes, ícones). **Dados financeiros não vão pro cache do service worker.**
* Quando houver versão nova: aviso discreto "Nova versão disponível. [Atualizar]".

---

## 11. Testes

* **Domínio (Vitest):** todos os arquivos de `src/domain`. Casos obrigatórios:
  * Parcela 10x começando em setembro: aparece de setembro a junho, numerada certo.
  * Fatura com parcela, assinatura, gasto lançado e outros: total certo. "Sei o total" menor que o fixo é recusado.
  * Fatura paga: congela, e mudar a parcela depois não altera o total mostrado.
  * Mês novo: "iPhone 2/12" vira "3/12", e "12/12" não vira "13/12".
  * Dia de fechamento 5: gasto no dia 6 vai pra fatura do mês seguinte.
  * Gráfico: 6 meses vazios antes e depois, média ignorando meses vazios e previsões.
  * Dinheiro: 0,1 + 0,2 somado em centavos dá exatamente 0,30.
* **Banco:** RLS com dois usuários, e views conferidas contra o seed.
* **Telas (Playwright), em 390×844 e 1280×800:**
  * Nenhuma rolagem lateral em nenhuma tela ou modal.
  * Trocar de mês no gráfico não muda a posição do topo do gráfico.
  * Nome de cartão longo e composição longa quebram sem "…".
  * Fluxo completo: login de teste, lançar gasto, conferir na fatura, desfazer.

---

## 12. Como trabalhar (instruções pro Claude Code)

* Ler este plano inteiro antes de começar qualquer fase.
* Trabalhar **uma fase por vez**. No fim de cada fase: rodar lint e testes, resumir o que foi feito, listar dúvidas, fazer commit e **esperar minha confirmação** antes da próxima.
* Na dúvida sobre comportamento de tela, abrir `docs/referencia/aerarium-v1.html`. Na dúvida sobre regra de negócio, perguntar em vez de inventar.
* Não adicionar funcionalidades que não estão no plano sem perguntar.
* Toda regra de negócio nova vai pra `src/domain`, com teste.
* Toda mudança de banco é uma migration nova. Nunca editar migration já aplicada.
* Nunca colocar a `service_role` no front, nunca commitar `.env` ou `scripts/data/`.
* Textos da interface em português do Brasil, seguindo a seção 7.4 item 13.
* Antes de dizer que uma tela está pronta, conferir em 390×844.

---

## 13. Prompts prontos

**Primeira conversa (depois de colocar os arquivos na pasta):**

> Leia o `CLAUDE.md` e o `docs/PLANO_AERARIUM.md` inteiros. Antes de escrever qualquer código, me devolva: um resumo do que você entendeu do app, as dúvidas ou pontos que achou ambíguos no plano, e o que pretende fazer na Fase 0. Espere eu responder antes de começar.

**Pra cada fase:**

> Pode começar a Fase N do plano. Siga os critérios de "pronto quando" da fase, rode os testes no final, faça o commit e me mostre um resumo com o que eu devo conferir.

**Quando algo ficar diferente da v1:**

> Na v1 (`docs/referencia/aerarium-v1.html`), a tela X faz Y. Aqui está fazendo Z. Confira como a v1 faz e alinhe, a não ser que o plano diga que isso mudou de propósito.

**Importar meus dados (Fase 3):**

> O backup está em `scripts/data/aerarium-backup-2026-09-24.json`. Rode o import pra conta do e-mail X no projeto de teste designado para a Fase 3 e me mostre o relatório de conferência mês a mês.

---

## 14. Checklist final

* [ ] Login com Google e com e-mail e senha funcionando no iPhone e no computador
* [ ] Meus dados importados e conferidos mês a mês
* [ ] Nenhum usuário vê dado de outro (teste de RLS passando)
* [ ] App instalado na tela inicial do iPhone, abrindo em tela cheia
* [ ] Lançar um gasto em menos de 5 segundos
* [ ] Nenhuma tela ou modal com rolagem lateral em 390px
* [ ] Nada muda de altura ao trocar de mês
* [ ] Exportar Excel e baixar meus dados funcionando
* [ ] Apagar conta funcionando
* [ ] Política de privacidade publicada
* [ ] `service_role` fora do front e do Git, `scripts/data/` fora do Git
