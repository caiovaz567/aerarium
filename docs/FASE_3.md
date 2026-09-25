# Fase 3: importação do backup

**Status: concluída no projeto Supabase de desenvolvimento.** O backup da v1 foi importado para a conta real do usuário, e o relatório não apontou nenhuma diferença.

## Entrega

- `scripts/import-backup.ts`: comando (`npm run import:backup`).
- `scripts/import/v1.ts`: formato do backup e regras da v1 usadas na conferência (`cleanDesc`, `norm`, `parcMonths`, observação da fatura, totais do mês).
- `scripts/import/mapBackup.ts`: mapeamento da seção 6.3 do plano, com ids estáveis.
- `scripts/import/report.ts`: relatório mês a mês, v1 ao lado da v2, e diferenças uma por linha.
- `scripts/import/sql.ts`: transação única de gravação.
- `scripts/import/import.test.ts`: 16 testes com dados fictícios. O backup real nunca entra em teste nem no Git.

## Como usar

```sh
npm run import:backup -- --simular
npm run import:backup -- --email EMAIL --projeto REF
npm run import:backup -- --email EMAIL --projeto REF --gravar
```

- `--simular`: só local, sem banco. Mostra o relatório v1 × v2.
- Sem `--gravar`: ensaio no banco, desfeito com `rollback`.
- Com `--gravar`: ensaia primeiro; só grava se o banco bater com `src/domain`, e confere de novo depois.
- `--projeto` precisa ser igual ao projeto vinculado (`supabase/.temp/project-ref`), senão nada acontece.
- `--arquivo` troca o backup (padrão `scripts/data/aerarium-backup-2026-09-24.json`). `--hoje` troca a data de referência (padrão: a data no nome do arquivo).

A conta de destino precisa existir em Authentication → Users.

## Decisões

- **Sem `service_role`.** O plano previa a chave `service_role` em `.env.local`. O script usa o login do Supabase CLI, como os testes da Fase 1, e grava como o próprio usuário (`role authenticated` + claims do JWT). RLS e todos os triggers valem durante o import. Nenhuma chave secreta é lida.
- **Idempotente por ids estáveis.** Cada id é derivado do usuário e do id da v1. Rodar de novo atualiza os mesmos itens, sem duplicar. Itens criados depois no app não são tocados. Se a conta já tiver meses criados fora do import, nada é gravado.
- **"Hoje" da v1 = data do backup.** A v1 contava as parcelas a partir do mês atual. Para o resultado não mudar conforme o dia em que o script roda, vale a data do nome do arquivo.
- **Observação da fatura** segue o `fcNote` da v1: `obs` quando existe (mesmo vazia), senão a descrição original quando ela diz algo além do nome padrão.
- **Observação do parcelamento** segue o `obsOf` da v1: `obs`, senão `paraQuem`.
- **Faturas pagas** entram abertas, com a composição, e depois são marcadas pagas, para o banco congelar o total (seção 4.9). Pagamentos "via mês" viram os pagamentos automáticos da fatura; a data da fatura paga é a do último desses pagamentos.
- **Contas pagas** ficam com a data de pagamento igual à data do backup, porque a v1 não guardava essa data.
- **Arquivo temporário.** O SQL com os dados reais é escrito em `.artifacts/db/` (fora do Git) e apagado logo depois, mesmo em caso de erro.
- **Login.** Por decisão do usuário, a Fase 4 terá login com e-mail e senha além do Google. A conta de destino foi criada pelo usuário no painel, com e-mail e senha.

## Resultado

Backup com 3 meses (setembro a novembro de 2026), 7 cartões, 16 parcelamentos, nenhuma assinatura e nenhum pagamento de parcela registrado.

- Simulação local, ensaio no banco e gravação: entradas, saídas, disponível e falta pagar iguais na v1, na v2 e no banco, nos 3 meses.
- Nenhuma diferença e nenhum aviso. Como o backup não tinha pagamentos de parcela, o cronograma fixo coincide com o da v1.
- Segunda gravação: mesmas contagens (7 cartões, 3 meses, 6 entradas, 21 contas, 21 faturas, 16 parcelamentos). Nada duplicou.

Valores não são registrados aqui porque são dados reais.

## Verificação

- `npm run check`: lint, formatação, 152 testes Vitest e build.
- Cobertura de `scripts/import`: 94% das linhas.
- `npm run db:test`: 102 verificações passaram depois do import.
- `npm run db:domain`: 3 verificações passaram.
- `.artifacts/db/` vazio depois das execuções.

## Pontos para depois

- Numeração: parcelamentos sem pagamento registrado começam em 1 no mês do backup. Uma compra que já estava na parcela 2 de 12 na vida real, mas com `faltam = 11`, aparece como 1/11. Os valores e os meses estão certos; só o número exibido começa do 1.
- Quando existir o projeto de produção, rodar o import de novo lá, na conta do usuário.

## Próxima fase

A Fase 4 faz o login (Google e e-mail com senha) e o esqueleto do app. Aguardar confirmação antes de iniciá-la, conforme `CLAUDE.md`.
