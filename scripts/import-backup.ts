// Imports the v1 backup (seção 6 do plano). See docs/FASE_3.md.
//
//   npm run import:backup -- --simular
//   npm run import:backup -- --email EMAIL --projeto REF            (ensaio, desfaz tudo)
//   npm run import:backup -- --email EMAIL --projeto REF --gravar   (grava)
//
// Writes through the Supabase CLI login as the destination user, so RLS applies.
// No service_role or secret key is read.
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { invoiceTotals } from '../src/domain/invoices'
import { fromDecimal, toDecimal } from '../src/domain/money'
import { isoDate, month } from '../src/domain/months'
import { mapBackup, toFinancialData, type ImportData } from './import/mapBackup'
import {
  compareWithV1,
  formatComparison,
  type Comparison,
  type Totals,
} from './import/report'
import { importSql, lookupUserSql } from './import/sql'
import { parseBackup } from './import/v1'

const { values: args } = parseArgs({
  options: {
    arquivo: {
      type: 'string',
      default: 'scripts/data/aerarium-backup-2026-09-24.json',
    },
    hoje: { type: 'string' },
    simular: { type: 'boolean', default: false },
    email: { type: 'string' },
    projeto: { type: 'string' },
    gravar: { type: 'boolean', default: false },
  },
})

function runSql(sql: string): Record<string, unknown>[] {
  mkdirSync('.artifacts/db', { recursive: true })
  const file = resolve('.artifacts/db', `${randomUUID()}.sql`)
  try {
    writeFileSync(file, sql, { flag: 'wx' })
    const result = spawnSync(
      process.execPath,
      [
        resolve('node_modules/supabase/dist/supabase.js'),
        'db',
        'query',
        '--linked',
        '--file',
        file,
      ],
      { encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024 },
    )
    if (result.error)
      throw new Error('Não consegui executar o Supabase CLI.', {
        cause: result.error,
      })
    let output: {
      rows?: Record<string, unknown>[]
      error?: { message?: string }
      _tag?: string
    }
    try {
      output = JSON.parse(result.stdout)
    } catch {
      throw new Error(
        `O CLI não devolveu JSON: ${result.stderr || result.stdout}`,
      )
    }
    if (result.status !== 0 || output.error || output._tag === 'Error')
      throw new Error(output.error?.message || result.stderr || 'Falha no SQL.')
    return output.rows ?? []
  } finally {
    // The file holds real financial data; never leave it behind.
    try {
      unlinkSync(file)
    } catch {
      /* already gone */
    }
  }
}

interface Snapshot {
  months: {
    month: string
    incomes: string
    outflows: string
    available: string
    unpaid: string
  }[]
  invoices: { id: string; total: string }[]
  payments: { manual: number; invoice: number }
}

function runImport(data: ImportData, userId: string, commit: boolean) {
  const rows = runSql(importSql(data, userId, commit))
  const snapshot = rows.find((row) => row.snapshot)?.snapshot as
    Snapshot | undefined
  if (!snapshot) throw new Error('O banco não devolveu a conferência.')
  const database = snapshot.months.map((row) => ({
    month: month(row.month),
    incomes: fromDecimal(row.incomes),
    outflows: fromDecimal(row.outflows),
    available: fromDecimal(row.available),
    unpaid: fromDecimal(row.unpaid),
  }))
  return { snapshot, database }
}

/** The database must agree with src/domain exactly; otherwise nothing is committed. */
function checkDatabase(
  data: ImportData,
  comparison: Comparison,
  snapshot: Snapshot,
  database: (Totals & { month: string })[],
): string[] {
  const problems: string[] = []
  const financial = toFinancialData(data)
  for (const row of comparison.months) {
    const stored = database.find((item) => item.month === row.month)
    if (!stored) problems.push(`${row.month}: mês não voltou do banco.`)
    else
      for (const key of ['incomes', 'outflows', 'available', 'unpaid'] as const)
        if (stored[key] !== row.v2[key])
          problems.push(
            `${row.month} ${key}: banco ${toDecimal(stored[key])}, domínio ${toDecimal(row.v2[key])}.`,
          )
  }
  for (const invoice of data.invoices) {
    const stored = snapshot.invoices.find((item) => item.id === invoice.id)
    const expected = toDecimal(invoiceTotals(invoice, financial).total)
    if (stored?.total !== expected)
      problems.push(
        `Fatura ${invoice.month}: banco ${stored?.total ?? 'ausente'}, domínio ${expected}.`,
      )
  }
  if (Number(snapshot.payments.manual) !== data.payments.length)
    problems.push(
      `Pagamentos manuais: banco ${snapshot.payments.manual}, esperado ${data.payments.length}.`,
    )
  if (Number(snapshot.payments.invoice) !== data.invoicePayments.length)
    problems.push(
      `Pagamentos pela fatura: banco ${snapshot.payments.invoice}, esperado ${data.invoicePayments.length}.`,
    )
  return problems
}

function main() {
  const file = args.arquivo!
  const todayText =
    args.hoje ?? basename(file).match(/(\d{4}-\d{2}-\d{2})/)?.[1]
  if (!todayText)
    throw new Error(
      'Informe --hoje AAAA-MM-DD (a data em que o backup foi feito).',
    )
  const today = isoDate(todayText)
  const backup = parseBackup(JSON.parse(readFileSync(file, 'utf8')))

  if (args.simular) {
    const data = mapBackup(backup, {
      userId: '00000000-0000-4000-8000-000000000000',
      today,
    })
    console.log(`Simulação local (sem banco). Hoje considerado: ${today}.`)
    console.log(formatComparison(compareWithV1(backup, data, today), data))
    return
  }

  if (!args.email || !args.projeto)
    throw new Error(
      'Use --simular, ou informe --email da conta de destino e --projeto com o ref do projeto vinculado.',
    )
  const linked = readFileSync('supabase/.temp/project-ref', 'utf8').trim()
  if (args.projeto !== linked)
    throw new Error(
      `O projeto vinculado é ${linked}, não ${args.projeto}. Nada foi feito.`,
    )

  const lookup = runSql(lookupUserSql(args.email)).find((row) => row.lookup)
    ?.lookup as { users: { id: string }[] } | undefined
  const users = lookup?.users ?? []
  if (users.length !== 1)
    throw new Error(
      users.length
        ? `Mais de uma conta com ${args.email}. Nada foi feito.`
        : `Não achei a conta ${args.email} no projeto ${linked}. Crie em Authentication → Users e rode de novo.`,
    )
  const userId = users[0]!.id

  const data = mapBackup(backup, { userId, today })
  const comparison = compareWithV1(backup, data, today)
  // Always rehearse first; commit only what the rehearsal proved right.
  const rehearsal = runImport(data, userId, false)
  const problems = checkDatabase(
    data,
    comparison,
    rehearsal.snapshot,
    rehearsal.database,
  )
  if (problems.length)
    throw new Error(
      `O banco não bateu com o domínio. Nada foi gravado.\n  ${problems.join('\n  ')}`,
    )
  let database = rehearsal.database
  if (args.gravar) {
    const written = runImport(data, userId, true)
    const after = checkDatabase(
      data,
      comparison,
      written.snapshot,
      written.database,
    )
    if (after.length)
      throw new Error(
        `Gravado, mas a conferência final falhou:\n  ${after.join('\n  ')}`,
      )
    database = written.database
  }

  console.log(
    `Projeto ${linked}, conta ${args.email}. Hoje considerado: ${today}.`,
  )
  console.log(formatComparison(comparison, data, database))
  console.log(
    args.gravar
      ? '\nGravado. Rodar de novo não duplica: os mesmos itens são atualizados.'
      : '\nEnsaio: tudo foi desfeito no fim. Para gravar, rode de novo com --gravar.',
  )
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
