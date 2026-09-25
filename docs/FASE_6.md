# Fase 6: Cartões e tela do cartão

**Status: concluída no projeto de desenvolvimento.** Aba Cartões (seção 8.3) e tela de cada cartão com o gráfico (seção 8.4).

## Entrega

- **Aba Cartões** (`src/features/cartoes/CardsPage.tsx`), em `/cartoes?mes=AAAA-MM`:
  - Barra de meses igual à de Meses (componente `MonthNav`, compartilhado), com lista de meses, criar e excluir mês.
  - Resumo "Faturas de Setembro": total, barra empilhada (parcelas, assinaturas, outros), os três valores e "Parcelas em aberto no total".
  - Um bloco por cartão: miniatura e nome (levam à tela do cartão), situação ("Fatura paga", "Fatura em aberto", "Sem fatura em outubro"), valor, barra com legenda, aviso quando a fatura está abaixo de parcelas + assinaturas, parcelas do mês com círculo de pagar e a linha de assinaturas (leva à aba Assinaturas).
  - "Fora dos cartões" para parcelas sem cartão.
  - Arquivados (recolhível, lembra se estava aberto neste aparelho): "Quitado em 24/09/2026 · 10 pagamentos · NuBank", com lixeira e Desfazer.
- **Tela do cartão** (`src/features/cartao/CardPage.tsx`), em `/cartoes/:id`:
  - Barra fixa com voltar e o nome (quebra linha, sem "…"). Esc volta no computador.
  - Cartão grande (até 280px) com nome e símbolo de aproximação; no computador fica ao lado dos números.
  - Parcelas em aberto, Última parcela, Assinaturas por mês.
  - Topo do gráfico: mês e situação, valor grande e a comparação com o mês anterior numa linha de altura fixa (▲ vermelho, ▼ verde, "igual a"). Botões ‹ ›, setas do teclado e "média N meses".
  - "O que tem em outubro": parcelas, assinaturas, gastos lançados e outros gastos não detalhados.
  - Parcelas do cartão com círculo de pagar (no mês escolhido no gráfico) e assinaturas.
- **Gráfico** (`CardChart.tsx`, `chartGeometry.ts`): série de `src/domain/chartSeries.ts`; curva monotônica (não passa dos pontos); linha cheia até a última fatura real e tracejada na previsão; meses vazios no chão; faixa com meia tela de margem de cada lado e o mês escolhido sempre no centro; tocar desliza até o mês; arrastar e soltar encaixa no mais próximo 120 ms depois; espaço por mês `max(76, rótulo, min(170, largura/4,2))`; altura `clamp(170, largura × 0,5, 280)`; redesenha quando a largura muda mantendo o mês no centro; a linha se desenha uma vez ao abrir (sem animação com movimento reduzido); bordas esmaecendo.
- **Operações**: excluir e restaurar parcelamento com seus pagamentos. Pagar parcela de cartão pela aba registra pagamento manual; se ela foi paga pela fatura, o app explica que é preciso desmarcar a fatura.
- **Domínio**: `dateBR` ("24/09/2026").

## Decisões

- O mês da aba Cartões fica no endereço (`?mes=`); sem ele, abre o mês de hoje (ou o mais próximo antes).
- "Editar" cartão, "+ Parcela neste cartão" e "+ Novo cartão" dependem dos modais de edição e do lançamento: ficam para as Fases 7 e 8. Não mostrei botões que ainda não fazem nada.
- Arquivados entrou nesta fase porque faz parte do layout da seção 8.3; a edição do parcelamento arquivado vem na Fase 8.
- Fatura estimada aparece no gráfico como previsão (linha tracejada), conforme a decisão da seção 4.9.
- As setas ▲▼ da comparação são SVG, seguindo o item 4 da seção 7.4.
- Textos de informação (parcela, composição) quebram entre pedaços, nunca no meio de um.

## Testes

- `npm run check`: 233 testes Vitest. Novos: geometria do gráfico (curva sem passar dos pontos, medidas, centro), contas das telas de cartão com os dados fictícios e as duas telas renderizadas (com a data fixada em 15/09/2026).
- `npm run e2e`: 86 verificações. Novas, em iPhone e computador, claro e escuro:
  - gráfico abre com o mês atual no centro;
  - tocar num mês desliza até ele ficar no centro;
  - arrastar e soltar encaixa no mês mais perto do centro;
  - trocar de mês não muda posição nem altura do topo, do bloco do gráfico nem da faixa;
  - girar o celular (390×844 para 844×390) redesenha e mantém o mês no centro;
  - teclado ← → e Esc no computador;
  - aba Cartões sem rolagem lateral e com nome longo sem "…".
- Capturas conferidas em 390×844 e 1280×800, incluindo o gráfico depois da animação.

Achados pelos testes e corrigidos: ao girar o celular, o encaixe usava as medidas de antes do giro e pulava para outro mês; o texto da parcela quebrava no meio de "R$ 1.080,00 no total".

## Próxima fase

A Fase 7 faz o Lançar (botão +, seção 8.5), incluindo o dia de fechamento. Aguardar confirmação antes de iniciá-la, conforme `CLAUDE.md`.
