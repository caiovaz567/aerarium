# Fase 7: Lançar

**Status: concluída no projeto de desenvolvimento.** O botão + abre o lançamento rápido da seção 8.5.

## Entrega

- **Modal Lançar** (`src/features/lancar/LaunchModal.tsx`):
  - Tipos Gasto, Parcelado e Entrada.
  - Valor em fonte grande; o cursor já começa nele, então o teclado numérico abre no iPhone (`initialFocus` no `Modal`).
  - Parcelado: "Valor total da compra", "Em quantas vezes" (2 a 120), "Primeira parcela em" e a prévia "10x de R$ 120,00, começando este mês"; quando não divide certo, a prévia mostra a última parcela ("3x de R$ 33,33 (a última de R$ 33,34)").
  - Descrição com exemplo por tipo (Uber, Notebook, Freela). Vazia vira "Gasto", "Compra parcelada" ou "Entrada".
  - Onde: grade de duas colunas com todos os cartões (miniatura e nome inteiro) e "Pix, boleto ou dinheiro". Lembra a última escolha neste aparelho.
  - Já paguei: só com Pix, boleto ou dinheiro; vem marcado.
  - Entra em: o mês.
- **Regras** (`src/features/lancar/launch.ts`, com teste):
  - Mês padrão: o que está aberto na aba Meses; senão o mês atual. Quando é o mês atual e o cartão tem dia de fechamento, um gasto depois do fechamento já vem no mês seguinte (`invoiceMonthForExpense`, seção 4.8). A escolha manual no campo vence a sugestão.
  - Gasto no cartão: vira gasto lançado na fatura daquele mês; se o cartão não tem fatura no mês, cria (estimada).
  - Gasto sem cartão: vira conta, paga (com a data de hoje) ou a pagar.
  - Parcelado: vira parcelamento a partir do mês escolhido, com `splitInstallments` (a última parcela absorve o arredondamento).
  - Entrada: vira entrada do mês.
  - Aviso com Desfazer: "R$ 12,00 na fatura Nubank Teste", "R$ 12,00 lançado em Setembro, já como pago", "10x de R$ 120,00 no Nubank", "Entrada de R$ 500,00 em Setembro". Se a fatura já estava paga, o aviso diz.
- Sem nenhum mês criado, o + avisa "Crie um mês primeiro, na aba Meses." (como a v1).

## Decisões

- **Mês ainda não criado:** a lista "Entra em" mostra os meses existentes e o próximo, marcado "(novo)". Lançar nele cria o mês do jeito padrão de "Criar mês" (copiando o anterior e levando a sobra) já com o lançamento dentro; o Desfazer remove o mês inteiro. Isso acontece, por exemplo, quando o fechamento do cartão manda o gasto para outubro e outubro ainda não existe.
- **Parcelado: o usuário escolhe o mês da primeira parcela** ("Primeira parcela em"), por decisão dele depois da primeira versão desta fase. A sugestão é a mesma do "Entra em", incluindo o dia de fechamento; a prévia diz "começando em outubro" quando não é este mês. Escolher o mês seguinte não cria mês: o parcelamento não depende da tabela de meses.
- O + abre na hora, mesmo antes de os dados terminarem de carregar; o formulário aparece quando chegam.

## Testes

- `npm run check`: 250 testes Vitest. Novos: mês sugerido (incluindo fechamento dia 5 com gasto no dia 6 indo para o mês seguinte), prévia do parcelado, o que cada tipo grava e desfaz, criação do mês novo com o lançamento, e o modal (foco no valor, validação, lembrar o cartão, Pix com "Já paguei").
- `npm run e2e`: 87 verificações. Nova, no iPhone: lançar um Uber de R$ 12 no cartão **em menos de 5 segundos** (do toque no + até o aviso), conferir na composição da fatura, desfazer pelo aviso, conferir depois de recarregar; e um segundo lançamento que continua lá depois de recarregar.
- Captura do modal conferida em 390×844.

Achados pelos testes e corrigidos: tocar no + enquanto os dados carregavam não fazia nada; e, no gráfico do cartão, o encaixe automático podia disparar no começo do deslizamento e puxar de volta para o mês anterior.

## Próxima fase

A Fase 8 faz Assinaturas, Arquivados, edições (cartão, parcelamento, entrada e conta), fotos dos cartões e o Excel (seções 8.6, 8.7, 8.8, 5.5 e o hover do item 12 da seção 7.4): ver [FASE_8.md](FASE_8.md).
