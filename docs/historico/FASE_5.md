# Fase 5: Meses

**Status: concluída no projeto de desenvolvimento.** A aba Meses mostra e altera os dados reais da conta, pela seção 8.2 do plano.

## Entrega

- **Dados** (`src/data/finance.ts`): carrega tudo da conta de uma vez (nove tabelas, RLS garante que é só da pessoa). Dinheiro vem como texto (`numeric::text`) e vira centavos, sem ponto flutuante. Os números da tela saem de `src/domain`, que já bate com as views do banco (`npm run db:domain`).
- **Gravação** (`src/data/financeOps.ts`, `src/data/useFinance.ts`): cada mudança tem a gravação e o efeito na tela. A tela muda no mesmo toque; se o banco recusar, volta atrás e avisa "Não consegui salvar". As mudanças saem uma de cada vez, então o Desfazer sempre chega depois do que desfaz. Depois de gravar, os dados são recarregados.
- **Tela** (`src/features/meses`):
  - Barra de meses fixa ao rolar: ‹ e › só entre meses que existem; + no último mês; tocar no nome abre a lista de meses.
  - Resumo azul: disponível, "No vermelho", barra de comprometido (vermelha acima de 100%), Entradas, Saídas e Falta pagar. Altura fixa: trocar de mês não mexe em nada acima.
  - Entradas com lixeira e edição; dica "Agosto fechou com R$ X. Usar esse valor".
  - Saídas em Cartões, Parcelas e Contas e outros, com subtotais e "X de Y pagas". Cartões com miniatura, observação (só quando diz algo além do nome), composição com valores redondos e a etiqueta ESTIMADA.
  - Resumo da fatura: o que entra sozinho, gastos lançados (com × e Desfazer), outros gastos, "Sei o total da fatura" (recusa total menor que o fixo), total ao vivo, observação, "Já paguei" e "Ver cartão".
  - Criar mês (seção 4.7) copiando entradas, contas e faturas estimadas, e levando a sobra. Excluir mês pela lista de meses, com Desfazer.
  - Toda exclusão tem Desfazer, que regrava o mesmo registro (mesmo id).
- **Regra nova no domínio**: `src/domain/cardColor.ts`, cor automática do cartão pela tabela da seção 7.3, com teste. `dayMonth` ("23/09") em `months.ts`.

## Decisões

- **Excluir mês** existia na v1 e foi mantido, com confirmação por segundo toque e Desfazer (regrava mês, entradas, contas, faturas e gastos; fatura paga volta paga).
- **Lixeira na fatura**: exclui a fatura do mês (e seus gastos e pagamentos automáticos), com Desfazer, como a v1 fazia com a linha.
- **Parcela fora do cartão**: o círculo registra o pagamento com a data de hoje; Desfazer remove. A linha ainda não abre a edição do parcelamento: isso é da Fase 8. Pelo mesmo motivo, parcelas e assinaturas no resumo da fatura ainda não abrem nada.
- **"Ver cartão"** leva a `/cartoes/:id`, que ganha conteúdo na Fase 6.
- **Adicionar** entrada, conta ou gasto é pelo botão +, na Fase 7. Por isso os blocos vazios dizem "Toca no + pra lançar".
- **"/meses"** abre o mês de hoje; se não existir, o mais próximo antes dele; sem meses, oferece criar o mês atual.
- **Comprometido sem entradas**: mostra "Nada entrou neste mês ainda" (seção 4.9).
- **Fatura paga com partes diferentes do total pago**: o resumo explica "Foi paga com R$ X. As partes hoje somam R$ Y." (seção 4.9).

## Testes

- `npm run check`: 214 testes Vitest. Os da tela Meses usam dados fictícios com contas feitas à mão (`src/test/financeFixture.ts`) e um Supabase de mentira que registra o que seria gravado.
- `npm run test:coverage`: 100% em `src/domain`.
- `npm run e2e`: 62 verificações. A conta fictícia de teste é apagada e recarregada com os mesmos dados a cada rodada (`tests/e2e/fixture.ts`, só no projeto de desenvolvimento e só nessa conta).
  - Em iPhone e computador, claro e escuro: números de setembro vindos do banco, nome de cartão longo quebrando sem "…", itens da composição inteiros, trocar de mês sem mexer na barra e no resumo, modais sem rolagem lateral.
  - Projeto `fluxo` (sozinho, depois dos outros): marca pago, exclui e desfaz, usa "Sei o total", leva a sobra, cria outubro, exclui e desfaz; confere tudo depois de recarregar a página. No fim devolve os dados fictícios.
- Capturas conferidas em 390×844 e 1280×800.

Achado pelos testes e corrigido: numa versão nova do Chrome, `window.scrollTo` devolve uma promessa, e um efeito escrito sem chaves quebrava a tela.

## Pontos para depois

- O build avisa que o pacote principal passou de 500 kB (Supabase, React e TanStack). Dividir o código na Fase 9.
- Editar parcelamento, assinatura e cartão: Fase 8.

## Próxima fase

A Fase 6 faz a aba Cartões e a tela de cada cartão, com o gráfico (seções 8.3 e 8.4): ver [FASE_6.md](FASE_6.md).
