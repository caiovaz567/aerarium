# Fase 11: categorias

**Status: concluída no desenvolvimento.** Fase fora do plano original, pedida pelo usuário em 26/09/2026. Para ir ao ar, o usuário aplica a migration na produção antes do push (passos no fim).

## Decisões do usuário

- Categoria só nas saídas: gastos lançados no cartão, contas (Pix, boleto, dinheiro), parcelamentos e assinaturas. Entradas não têm.
- Lista pronta e editável: Alimentação, Transporte, Moradia, Saúde, Lazer, Compras, Educação, Assinaturas e Outros. Dá pra renomear, trocar a cor, apagar e criar.
- Onde ver: bloco "Para onde foi o dinheiro" dentro de Meses; tocar numa categoria mostra o que tem nela.
- Opcional ao lançar, com sugestão pelo nome e pelo que a pessoa já escolheu antes.
- O que já existia (import da v1) recebe a sugestão pelo nome uma vez.

## Entrega

- **Banco** (`supabase/migrations/20260926000100_categories.sql`): tabela `categories` (nome único por pessoa, cor `#RRGGBB`, ordem), RLS igual às outras, e `category_id` opcional em `invoice_expenses`, `bills`, `installment_plans` e `subscriptions`, com FK composta pelo dono. Apagar uma categoria deixa os itens sem categoria (`on delete set null`). Apagar a conta leva as categorias junto.
- **Domínio** (`src/domain/categories.ts`, 100% de cobertura):
  - lista padrão, paleta e a próxima cor livre;
  - sugestão: primeiro o que a pessoa escolheu antes pra mesma descrição, depois palavras-chave (palavra inteira, a mais longa vence: "mercado livre" é Compras, "mercado" é Alimentação);
  - `monthOutflowItems`: as saídas do mês em pedaços com categoria, somando exatamente as saídas do resumo. A parte de cada fatura sem detalhe ("outros gastos", ou a diferença de um total congelado) fica em "Outros gastos das faturas";
  - `groupByCategory`: categorias da maior pra menor, depois "Sem categoria" e "Outros gastos das faturas".
- **Primeira vez**: sem nenhuma categoria, o app cria a lista padrão e aplica a sugestão pelo nome nos itens sem categoria (nunca por cima de uma escolha já feita). Se a pessoa apagar todas, a lista padrão volta na próxima abertura.
- **Telas**:
  - Meses: bloco "Para onde foi o dinheiro" com barra e percentual; tocar abre os itens; tocar num item abre a edição dele (conta, gasto, parcelamento, assinatura ou a fatura).
  - Lançar: escolha de categoria em Gasto e Parcelado, já marcada pela sugestão enquanto a pessoa digita; a escolha manual fica.
  - Edição de conta, parcelamento e assinatura ganharam a categoria. Assinatura nova começa em "Assinaturas".
  - Novo: editar um gasto lançado (descrição, valor, categoria), tocando nele no resumo da fatura ou no bloco.
  - Ajustes: "Editar categorias" (renomear, trocar cor, apagar com Desfazer, adicionar).
- "Baixar meus dados" inclui a tabela de categorias. Mês novo copia a categoria das contas.

## Testes

- `npm run db:test`: 107 verificações (novas: RLS nas 10 tabelas, nome único, cor válida, apagar categoria deixa o item sem categoria, B não usa categoria de A, B pode ter o mesmo nome, apagar a conta leva as categorias).
- `npm run check`: 331 testes Vitest; `npm run test:coverage`: 100% em `src/domain`. Novos: palavras-chave, sugestão com histórico, soma das partes igual às saídas nos 4 meses do seed, fatura congelada, bloco em Meses, editar pela categoria, Lançar com sugestão e escolha manual, editar gasto lançado, primeira vez, gerenciar categorias.
- `npm run e2e`: 167 verificações. Novas: bloco aberto e edição sem rolagem lateral, Lançar com sugestão, tela de categorias, acessibilidade (axe) nessas telas, e no fluxo gravando: lançar "Farmácia" como Saúde, renomear pra "Remédios" e conferir depois de recarregar.
- Capturas conferidas em 390×844 nos dois temas.

## Para ir ao ar (usuário)

A versão nova do app lê a tabela de categorias; por isso a migration entra na produção **antes** do push. Um comando por vez:

```sh
npm run supabase -- link --project-ref kpzupvajcjhjoarxjcvq
npm run supabase -- db push
npm run supabase -- link --project-ref idvbrfbudoxvubxpqdzs
```

Depois disso, o push publica o app. Na primeira abertura, o app cria a lista e categoriza o que reconhecer.
