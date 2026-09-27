# Fase 1: banco

> Depois da Fase 8, a foto de cartão foi removida: a migration `20260925000100_remove_card_photos.sql` apagou o bucket `card-photos`, suas policies e a coluna `cards.photo_path`, e os testes de Storage saíram de `phase1.sql`. O texto abaixo retrata a Fase 1.

**Status: concluída no projeto Supabase de desenvolvimento.** Banco instalado com dados fictícios, isolamento entre usuários e cálculos verificados. A continuação está em [FASE_2.md](FASE_2.md).

## Entrega

Quatro migrations versionadas em `supabase/migrations/`:

- `20260924000100_tables.sql`: nove tabelas, dinheiro `numeric(12,2)`, constraints e FKs compostas por identificador e usuário.
- `20260924000200_calculations_and_rls.sql`: RLS nas nove tabelas, índices, três views com `security_invoker` e triggers para congelamento de fatura e pagamentos de parcelas. As funções internas usam os privilégios de quem chamou, sem ignorar RLS.
- `20260924000300_card_photos.sql`: bucket privado JPEG e políticas de leitura, inserção, alteração e exclusão na pasta do próprio usuário.
- `20260924000400_restrict_platform_trigger.sql`: restringe execução da função opcional `rls_auto_enable`, já existente no projeto hospedado, preservando seu event trigger. Ambientes sem essa função também aceitam a migration.

Views: `v_installment_schedule`, `v_invoice_totals` e `v_month_summary`. As decisões sobre centavos finais, assinaturas, faturas pagas, déficit, exclusões e datas estão na seção 4.9 do [plano](PLANO_AERARIUM.md). `committed_ratio` é uma razão, não um percentual multiplicado por 100.

Não houve alteração de telas. Login Google, conexão da interface ao banco, importação real e upload de fotos pertencem às próximas fases.

## Seed e contas conferidas à mão

O seed contém três cartões, quatro meses (agosto a novembro de 2026), três parcelamentos, uma assinatura e uma fatura paga. O usuário fictício é `aerarium.seed@example.test`, UUID `10000000-0000-4000-8000-000000000001`. Não possui senha nem identidade de login. Esses dados podem ser vistos no Table Editor do projeto de desenvolvimento; não são ligados à futura conta Google do usuário.

Valores em reais:

| Mês    | Entradas | Saídas | Disponível | Falta pagar |
| ------ | -------: | -----: | ---------: | ----------: |
| Ago/26 | 2.100,00 | 825,00 |   1.275,00 |      575,00 |
| Set/26 | 2.100,00 | 858,33 |   1.241,67 |      778,33 |
| Out/26 | 2.100,00 | 858,33 |   1.241,67 |      745,00 |
| Nov/26 | 2.100,00 | 858,34 |   1.241,66 |      778,34 |

Entradas: salário de R$ 2.000 + freela de R$ 100. Contas: aluguel de R$ 500 + internet paga de R$ 80. Faturas: R$ 170 + R$ 70 + R$ 5. A primeira soma parcela de R$ 100, assinatura de R$ 20, dois gastos de R$ 12 e R$ 8 e outros de R$ 30. Em agosto essa fatura está paga. De setembro a novembro existe uma parcela fora de cartão: R$ 33,33, R$ 33,33 e R$ 33,34, com outubro pago. O ajuste final fecha exatamente R$ 100.

## Comandos

Com o CLI autenticado e o projeto vinculado:

```sh
npm run db:test
```

Esse comando carrega as fixtures, executa os testes em `supabase/tests/phase1.sql` e termina com `ROLLBACK`. Usa as roles reais `authenticated` e `anon` e claims de dois usuários para testar RLS, não consultas administrativas que ignorariam as políticas. O segundo usuário e os metadados fictícios de fotos existem somente dentro da transação.

Para carregar o seed persistente:

```sh
npm run db:seed
```

Os IDs são fixos e uma segunda execução não duplica linhas. Não editar a conta reservada do seed manualmente: os testes dependem dos valores documentados. O seed não restaura automaticamente fixtures alteradas.

Os dois comandos conferem o projeto vinculado contra `supabase/development.json`, atualmente `idvbrfbudoxvubxpqdzs`, e usam o login do CLI. Não exigem Docker nem uma chave administrativa em `.env.local`. Não executam reset remoto.

Para reproduzir em **outro banco de desenvolvimento vazio e descartável**, vincule esse destino e ajuste explicitamente `supabase/development.json`. Então:

```sh
npm run db:preflight
npm run supabase -- db push --dry-run
npm run supabase -- db push
npm run db:seed
npm run db:test
```

`db:preflight` ensaia todas as migrations, o seed e os testes com rollback. Recusa banco que já tenha `public.cards`. No projeto atual, que já está instalado, use `db:test`. Não apontar esses comandos para produção. Execute comandos administrativos do Supabase em sequência: chamadas simultâneas podem disputar a credencial temporária de conexão do CLI.

## Verificação

- Ensaio inicial em banco vazio: 101 verificações passaram com rollback, antes de aplicar as três primeiras migrations.
- `db push`: quatro migrations aplicadas sem erro; a quarta restringiu os privilégios da função preexistente identificada pelo Security Advisor.
- `db:seed` executado duas vezes, mantendo quatro meses e os mesmos totais esperados.
- `db:test`: 102 verificações passaram no banco instalado. Cobrem totais, cronograma fixo, ajuste de centavos, congelamento/reabertura, pagamentos manuais, validações, RLS das nove tabelas e três views, referências entre usuários e exclusões em cascata.
- `db lint --linked --schema public,private --fail-on warning`: sem erros ou avisos de schema.
- `npm run check`: lint, formatação, 13 testes Vitest, TypeScript e build.

O teste de Storage verifica políticas e acesso aos **metadados** dentro de uma transação, sem upload de objeto real. O Supabase hospedado bloqueia exclusão direta por SQL; exclusão, upload e URL assinada via API serão testados no fluxo de fotos da Fase 8. O teste de exclusão de conta verifica cascatas nas tabelas, não remoção de arquivos físicos.

O Security Advisor ainda aponta proteção contra senhas vazadas desativada. A autenticação Google será configurada na Fase 4; essa opção de proteção de senhas está [disponível no plano Pro ou superior](https://supabase.com/docs/guides/auth/password-security). Nenhum plano pago foi contratado. A configuração dos provedores deve ser revisada na Fase 4.

## Próxima fase

A Fase 2 implementa funções puras em TypeScript em `src/domain`: dinheiro em centavos, meses, parcelas, faturas, saldo, criação de mês, fechamento e série do gráfico. Seus testes devem reproduzir os totais deste seed. Aguardar confirmação antes de iniciá-la, conforme `CLAUDE.md`.
