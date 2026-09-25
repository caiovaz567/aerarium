# Fase 2: domínio em TypeScript

**Status: concluída.** Regras de negócio puras em `src/domain`, sem React e sem Supabase, com cobertura total e paridade com as views da Fase 1.

## Entrega

- `money.ts`: centavos inteiros, leitura do que foi digitado (`12`, `12,5`, `1.147,29`, `1147.29`), formato completo e curto, conversão para o `numeric(12,2)` do banco.
- `months.ts`: meses `YYYY-MM`, soma e subtração atravessando anos, rótulos ("Setembro 2026", "set", "jan/27"), data de hoje em `America/Sao_Paulo`.
- `installments.ts`: cronograma fixo, número da parcela, faltam, quitado e ajuste de centavos na última parcela (seção 4.9 do plano).
- `invoices.ts`: partes e total da fatura, "Sei o total" com recusa abaixo do fixo, congelamento ao pagar e reabertura preservando pagamentos manuais.
- `balance.ts`: entradas, saídas, disponível, comprometido (razão, `null` sem entradas) e falta pagar.
- `newMonth.ts`: rascunho do mês novo, com cópia de entradas, contas e faturas estimadas, sobra recalculada e avanço de "2/12" para "3/12" (só o primeiro contador, como a v1; "12/12" fica igual).
- `closing.ts`: mês da fatura pelo dia de fechamento. O mês escolhido pelo usuário vence a sugestão.
- `chartSeries.ts`: série do gráfico do cartão, com seis meses vazios de cada lado, previsão, média das últimas reais e comparação com o mês anterior.
- `types.ts` e `__fixtures__/seed.ts`: tipos compartilhados e o mesmo seed fictício da Fase 1, em TypeScript.

Nenhuma tela mudou. Nenhuma migration nova.

## Comandos

```sh
npm test
npm run test:coverage
npm run db:domain
```

`test:coverage` mede só `src/domain` e falha abaixo de 95% de linhas e 90% de ramos. `db:domain` consulta as views do projeto de desenvolvimento com o usuário do seed, em transação somente leitura com `rollback`, e compara com o TypeScript. Exige o login do CLI e o seed carregado (`npm run db:seed`). Confere o projeto vinculado contra `supabase/development.json`. Fica fora do `npm test` para os testes unitários continuarem sem rede.

## Verificação

- `npm run check`: lint, formatação, 136 testes Vitest, TypeScript e build.
- `npm run test:coverage`: 100% de linhas, instruções, funções e ramos em `src/domain`.
- `npm run db:domain`: 3 verificações passaram. As 17 parcelas, as 12 faturas (partes, total atual e congelado) e os 4 resumos de mês coincidem com as views.
- Casos obrigatórios da seção 11 cobertos: 10x de setembro a junho, fatura com todas as partes, "Sei o total" recusado, congelamento, "2/12" para "3/12" sem passar de "12/12", fechamento no dia 5 com gasto no dia 6, seis meses vazios no gráfico com média ignorando vazios e previsões, e 0,1 + 0,2 = 0,30.

Na primeira execução de `db:domain`, as partes zeradas das faturas vinham do banco como `"0"` em vez de `"0.00"`. Os valores eram iguais; a consulta de teste passou a formatar essas colunas com duas casas.

## Próxima fase

A Fase 3 importa o backup da v1 (`scripts/import-backup.ts`, seção 6 do plano), usando estas funções para o relatório de conferência. Aguardar confirmação antes de iniciá-la, conforme `CLAUDE.md`.
