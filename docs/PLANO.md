# Aerarium: plano de melhorias

Roteiro para os próximos passos. Seguir de cima para baixo, **um item por vez**: implementar, `npm run check`, testes de navegador, commit em inglês no branch de trabalho, o dono testa localmente e só então vai para `main`. Ao terminar um item, marcar `[x]`, anotar a data e atualizar `docs/APP.md`. Mudou a prioridade? Mudar aqui primeiro.

Referência de visual: o app **Finzey** (azul, cartões brancos, logos de bancos e marcas). Inspiração, não cópia: manter a identidade do Aerarium (tokens em `src/styles/tokens.css`, fonte Bricolage + Figtree, regras de interface do `docs/APP.md`).

## A virada de fluxo

Com o Open Finance, o uso principal deixa de ser **lançar** e passa a ser **revisar**. As compras dos cartões chegam sozinhas (com atraso de até 1 dia); o dono só confere a categoria e, se quiser, escreve uma descrição. O **+** fica para Pix, dinheiro e cartões fora do Open Finance. Tudo abaixo segue essa ideia.

## Pendências em aberto (antes de continuar)

- [x] Dono roda no desenvolvimento: `npm run supabase -- db push` (migration `20260928000100_expense_note.sql`) e `npm run db:test`. Depois: `npm run e2e`. (29/09/2026)
- [ ] Dono testa o nome do banco + descrição (commit `6c892ad`, branch `novidades`).
- [ ] Migration `expense_note` na produção **antes** de publicar (o dono roda: vincular prod, `db push --dry-run`, `db push`, voltar para dev).
- [ ] Primeira importação real em Ajustes → Bancos conectados (com prévia).

## Fase 13: cara de app de banco

### 13.1 Logos dos bancos

- [x] Feito em 29/09/2026 (branch `novidades`): logos, cor pelo banco, vencimento, dias preenchidos pelo Open Finance. Falta o dono testar e publicar.

- Cartão ganha `bank` (ex.: `nubank`, `itau`), adivinhado pelo nome do cartão e trocável no modal do cartão. Vale para cartões fora do Open Finance.
- Logos da lista de conectores da Pluggy (`imageUrl`), guardados como arquivos estáticos do app (PNG, para funcionar também no e-mail; o Gmail não mostra SVG). Sem logo: o desenho de cartão de hoje.
- Visual: quadradinho arredondado estilo ícone de app. Aparece em Cartões, tela do cartão, "Onde" do Lançar, filtros de Saídas e resumo da fatura.
- Linha de apoio do cartão: "Final 5580 · vence 9 out" (final vem de `bank_accounts.number`).
- Aceite: 390×844 e 1280×800, dois temas, axe, logo nunca distorcido.

### 13.2 Tela do cartão estilo "Fatura do cartão"

- [x] Feito em 29/09/2026 (branch `novidades`). O limite só foi testado com dados de teste: conferir com os bancos reais depois da primeira importação.

- Topo azul: logo, nome, final; **vencimento** ("11 out · faltam 9 dias"), **total**, etiqueta "A pagar" ou "Paga".
- **Limite disponível** com anel de uso: `creditLimit` e `availableCreditLimit` da Pluggy (a função `bank` passa a devolver). Só em cartão do Open Finance; sem dado, o bloco some.
- **Próxima fatura** e **melhor dia pra comprar** (dia seguinte ao fechamento). Regra em `src/domain/closing.ts`, com teste.
- **Resumo da fatura**: compras, parcelamentos, assinaturas, outros, total. O gráfico por mês continua embaixo.

### 13.3 Logos das assinaturas

- Logo pela marca (Netflix, Spotify, ChatGPT, iCloud...) de uma biblioteca aberta de ícones de marcas (ex.: Simple Icons, pelo jsDelivr), escolhida pelo nome; sem marca, fica o ícone da categoria.
- Assinaturas ganham o resumo do Finzey: total mensal, quantas ativas, projeção de 12 meses.

### 13.3 O pai usa os mesmos cartões (só para o dono)

- [x] Base (29/09/2026, branch `novidades`): "de quem" em gastos e parcelamentos, "outros" é do pai, saldo só com a parte do dono, importação separando sozinha, prévia por cartão, compra antiga sem fatura do banco vai pra fatura certa.
- [x] Tela "Chegou do banco" (29/09/2026): abre sozinha uma vez por sessão quando há compra ou parcelamento do banco sem conferir (`reviewed_at`), por dia, Meu ou Pai; aviso em Meses reabre. A primeira importação já entra conferida.
- [x] Seletor de perfil Eu | Pai no topo (29/09/2026, só aparece com outra pessoa ligada): a visão do Pai em Meses mostra os gastos dele, por cartão, por data e por categoria. Cartões e o e-mail ainda mostram só a visão de sempre.
- [x] Compartilhar com a conta do pai no Aerarium (29/09/2026): ele vê, só leitura, uma cópia do que é dele, que o app do dono mantém em dia; Pix único pra pagar. E-mail e chave Pix só no banco de dados.

## Fase 14: revisar em vez de lançar

### 14.1 "Chegou do banco" (fila de revisão)

- Em Meses, um aviso: "6 compras novas pra revisar". Abre uma lista só das compras que chegaram e ainda não foram vistas.
- Cada linha: nome do banco, cartão, data e hora, valor, categoria sugerida em chips de troca rápida, campo de descrição. Botão "Tudo certo" marca todas como vistas.
- Guardar `reviewed_at` em `invoice_expenses` (migration nova). Substitui a etiqueta "novo" de 3 dias.
- Trocar a categoria de uma compra do banco ensina a sugestão para o mesmo estabelecimento (hoje a sugestão já usa o histórico; conferir que o nome exato do banco entra nela).

### 14.2 Lançar mais esperto

- [x] Feito em 24/10/2026, mais simples que o planejado (escolha do dono): os cartões ligados ao banco saíram do Lançar, em vez de só mostrar uma dica.

- No "Onde", cartões fora do Open Finance e "Pix, boleto ou dinheiro" primeiro. Ao escolher um cartão conectado: dica "As compras do Nubank chegam sozinhas no dia seguinte. Lança só se quiser ver agora."
- Mantém a ligação automática (mesmo cartão e valor, até 3 dias) para não duplicar.

### 14.3 E-mail diário às 18h (feito em 29/09/2026, sem importar no servidor: a função só lê o banco e avisa; o app importa ao abrir)

- Prévia aprovada: um bloco por cartão (logo, nome, total), compra com nome exato do banco, descrição em azul, categoria, dia e hora; parcela mostra o valor da parcela e "Parcela 1 de 3 · total".
- Envio pelo Resend (grátis; sem domínio só manda para o e-mail da conta, que é o do dono). Secret `RESEND_API_KEY`; nunca pedir a chave ao dono.
- Agendado no Supabase (pg_cron chamando uma Edge Function). A função busca no Meu Pluggy, **importa** com as mesmas regras de `src/domain/bank.ts` (para as categorias baterem com o app) e manda o resumo só se chegou algo novo.
- Ajustes → Bancos conectados: chave "Resumo por e-mail às 18h" (liga e desliga, guardado no banco).
- Antes de ligar: mandar um e-mail de teste com compras inventadas para o dono ver no Hotmail.

## Fase 15: menos trabalho manual

### 15.1 Conta corrente pelo Open Finance

- Importar também Pix e débitos da conta (não só cartão) como contas pagas do mês, e entradas (salário) como entradas.
- Ignorar o pagamento da fatura do cartão (já contado na fatura) e transferências entre contas próprias.
- Grande: planejar à parte antes de começar (regras em `src/domain`, prévia na primeira vez, igual ao cartão).

### 15.2 Assinatura detectada

- Mesma loja e valor parecido em 2 ou 3 meses seguidos: sugerir "Parece assinatura: cadastrar?".

### 15.3 Lembretes de vencimento

- E-mail (e depois notificação) 2 dias antes do vencimento de fatura e conta não paga.

## Fase 16: planejar o mês

- **Orçamento por categoria**: limite por mês; barra de progresso em "Por categoria" e aviso ao passar de 80%.
- **Projeção**: quanto sobra no fim do mês contando o que já está marcado para vencer; próximos 3 meses com parcelas e assinaturas.
- **Busca**: procurar compra por nome, valor ou descrição em todos os meses.

## Pequenos acertos (encaixar entre as fases)

- Olhinho para esconder os valores do resumo azul (lembrado por aparelho).
- Botão do Excel sai do cabeçalho e vai para Ajustes → Seus dados.
- Escolher tema claro, escuro ou do sistema em Ajustes.
- Fila offline: lançar sem internet e enviar quando voltar.

## Fora do plano (decidido não fazer)

- Gráfico de linha do saldo por dia (o app é por mês).
- Subcategorias (complicam sem ajudar no dia a dia).
- WhatsApp (pago e burocrático).
