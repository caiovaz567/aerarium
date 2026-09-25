# Fase 8: Assinaturas, arquivados, edições, fotos e Excel

**Status: concluída no projeto de desenvolvimento.** Seções 8.6, 8.7, 8.8, 5.5 e o hover do item 12 da seção 7.4.

## Entrega

- **Aba Assinaturas** (`src/features/assinaturas`): total por mês e por ano, "Próxima cobrança", lista por dia com cartão e observação, lixeira com Desfazer e "Adicionar assinatura".
- **Modais de edição** (`src/features/editar`), abertos de qualquer tela por um editor central (`EditorProvider`, `useEditor`):
  - **Cartão:** prévia grande que muda enquanto edita, "Colocar foto" / "Trocar foto" / "Tirar foto" com a dica de não mostrar o número, nome, bolinhas de cor (a primeira é a cor do banco), dia de fechamento opcional, Excluir com Desfazer. Novo cartão entra no fim da lista.
  - **Parcelamento:** o que é, cobrado em, observação, valor da parcela, total de parcelas, mês da primeira, histórico de pagamentos com Remover e "Registrar pagamento" com data e mês (seção 4.4). Excluir com Desfazer.
  - **Assinatura:** nome, dia, valor, cartão ou nenhum, observação. Excluir com Desfazer.
  - Entrada e conta já existiam desde a Fase 5.
- **Onde cada edição abre:** "Editar" no bloco do cartão e na tela do cartão; "Parcela neste cartão", "Parcela fora de cartão" e "Novo cartão" na aba Cartões; toque nas linhas de parcela (Cartões, tela do cartão, Meses, Arquivados) e de assinatura (tela do cartão); no resumo da fatura, tocar numa parcela ou assinatura abre o item.
- **Fotos** (`src/data/photos.ts`): reduzidas no navegador (lado maior 900px, JPEG 0,85), enviadas ao bucket privado em `{user_id}/{card_id}.jpg` e mostradas por URL assinada de 1 hora. A foto substitui o desenho do cartão em todas as miniaturas.
- **Excel** (`src/features/exportar`): botão "Excel" no cabeçalho. Uma aba por mês (entradas, saídas, totais), mais Parcelamentos, Cartões e Assinaturas; valores com formato de moeda; arquivo `Aerarium_AAAA-MM-DD.xlsx`. A biblioteca só carrega quando o botão é tocado.
- **Hover (só com mouse):** a miniatura do cartão levanta e inclina com um brilho passando; o cartão grande inclina em 3D seguindo o mouse.
- **Domínio:** `planEdit.ts` com as regras de edição do parcelamento (cronograma precisa incluir os meses pagos; não trocar de cartão com parcela paga pela fatura; ajuste de centavos só fica se valor e total não mudaram).

## Decisões

- **Excel com `write-excel-file`, não SheetJS.** O plano citava SheetJS. A versão dela no registro do npm está parada na 0.18.5, com falhas de segurança conhecidas; a atual só é distribuída pelo site da SheetJS, e a configuração do npm deste computador bloqueia pacotes de fora do registro (proteção que não foi desligada). `write-excel-file` só gera planilhas, é mantida e está no registro. O arquivo gerado segue o layout da v1.
- **Excluir cartão** segue a seção 4.9: leva as faturas, gastos e pagamentos automáticos; parcelamentos e assinaturas ficam sem cartão. O Desfazer devolve o cartão, religa parcelamentos e assinaturas e recria as faturas (as pagas voltam pagas, e o banco recria os pagamentos automáticos). A foto no Storage fica guardada para o Desfazer; a limpeza completa das fotos vem com "Apagar minha conta" (Fase 10).
- **Foto de cartão já salvo** é gravada na hora, como na v1. Foto de cartão novo só vale se ele for salvo; cancelar apaga o arquivo enviado.
- **Pagamento que veio da fatura** não é removido pelo parcelamento: o app explica que é preciso desmarcar a fatura nos Meses (seção 4.9).
- **Dia de fechamento** agora pode ser editado, então a sugestão do "Entra em" do Lançar passa a funcionar na prática.
- Os botões "+" usam ícone SVG, não o caractere "+" (item 4 da seção 7.4).

## Testes

- `npm run check`: 270 testes Vitest. Novos: regras de edição do parcelamento, aba Assinaturas (totais, próxima cobrança, adicionar, excluir e desfazer), editar e criar cartão, excluir cartão e desfazer na ordem certa, histórico e registro de pagamento, "Parcela neste cartão", abrir o parcelamento pelo resumo da fatura, e o conteúdo das abas do Excel.
- `npm run test:coverage`: 100% em `src/domain`.
- `npm run e2e`: 99 verificações. Novas:
  - Em iPhone e computador: aba Assinaturas e os modais sem rolagem lateral; download do Excel com o nome certo (no computador).
  - No fluxo, gravando no banco: dia de fechamento e cor do cartão; **envio de uma foto de verdade** (reduzida para 900px), conferida depois de recarregar, e removida; nova assinatura; parcelamento renomeado. O preparador da conta de teste também apaga as fotos dela.
- Capturas conferidas em 390×844. Ajustes feitos depois de olhar: o valor grande das assinaturas estava cinza; o campo "Referente a" cortava o nome do mês no celular.

## Próxima fase

A Fase 9 faz o PWA e o deploy na Vercel (seções 10.2 e 10.3). Aguardar confirmação antes de iniciá-la, conforme `CLAUDE.md`.
