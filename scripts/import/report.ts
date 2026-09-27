import { monthBalance } from '../../src/domain/balance'
import { installmentSchedule } from '../../src/domain/installments'
import { fixedCardAmounts, invoiceTotals } from '../../src/domain/invoices'
import {
  cents,
  formatMoney,
  sumMoney,
  type Cents,
} from '../../src/domain/money'
import {
  monthLabel,
  monthOf,
  type ISODate,
  type Month,
} from '../../src/domain/months'
import { toFinancialData, type ImportData } from './mapBackup'
import { v1CardParts, v1MonthTotals, v1PlanMonths, type V1Backup } from './v1'

export interface Totals {
  readonly incomes: Cents
  readonly outflows: Cents
  readonly available: Cents
  readonly unpaid: Cents
}
export interface MonthComparison {
  readonly month: Month
  readonly v1: Totals
  readonly v2: Totals
}
export interface Difference {
  readonly month: Month
  readonly text: string
  /** True only when the fixed schedule explains it. */
  readonly explained: boolean
}
export interface Comparison {
  readonly months: readonly MonthComparison[]
  readonly differences: readonly Difference[]
}

const signed = (value: Cents) => `${value > 0 ? '+' : ''}${formatMoney(value)}`
const minus = (a: Cents, b: Cents) => sumMoney([a, cents(-b)])

export function compareWithV1(
  backup: V1Backup,
  data: ImportData,
  today: ISODate,
): Comparison {
  const todayMonth = monthOf(today)
  const financial = toFinancialData(data)
  const v1Plans = new Map(
    data.plans.map((plan) => [plan.id, backup.parcelamentos[plan.v1Id]!]),
  )
  const months: MonthComparison[] = []
  const differences: Difference[] = []
  const planNames = (ids: readonly string[]) =>
    ids
      .map(
        (planId) => data.plans.find((plan) => plan.id === planId)!.description,
      )
      .join(', ')

  for (const { ref } of data.months) {
    const v1 = v1MonthTotals(backup.months[ref]!)
    const balance = monthBalance(ref, financial)
    const v2: Totals = {
      incomes: balance.incomes,
      outflows: balance.outflows,
      available: balance.available,
      unpaid: balance.unpaid,
    }
    months.push({ month: ref, v1, v2 })
    const add = (text: string, explained: boolean) =>
      differences.push({
        month: ref,
        text: `${monthLabel(ref)} · ${text}`,
        explained,
      })
    let outflowGap = minus(v2.outflows, v1.outflows)
    let unpaidGap = minus(v2.unpaid, v1.unpaid)
    const account = (
      v1Amount: Cents,
      v1Paid: boolean,
      v2Amount: Cents,
      v2Paid: boolean,
    ) => {
      outflowGap = minus(outflowGap, minus(v2Amount, v1Amount))
      unpaidGap = minus(
        unpaidGap,
        minus(v2Paid ? cents(0) : v2Amount, v1Paid ? cents(0) : v1Amount),
      )
      return v1Amount !== v2Amount || v1Paid !== v2Paid
    }

    for (const trace of data.outflows.filter((item) => item.month === ref)) {
      const { target } = trace
      if (target.type === 'bill') {
        const bill = data.bills.find((item) => item.id === target.id)!
        if (account(trace.v1Amount, trace.v1Paid, bill.amount, bill.paid))
          add(
            `Conta "${trace.label}": v1 ${formatMoney(trace.v1Amount)}, v2 ${formatMoney(bill.amount)}.`,
            false,
          )
      } else if (target.type === 'invoice') {
        const invoice = data.invoices.find((item) => item.id === target.id)!
        const v2Total = invoiceTotals(invoice, financial).total
        if (!account(trace.v1Amount, trace.v1Paid, v2Total, invoice.paid))
          continue
        const v1Parts = v1CardParts(
          backup,
          data.cards.find((card) => card.id === invoice.cardId)!.v1Id,
          ref,
          todayMonth,
        )
        const v2Fixed = fixedCardAmounts(invoice.cardId, ref, financial)
        const v1Composed = sumMoney([
          invoice.v1Other,
          v1Parts.installments,
          v1Parts.subscriptions,
        ])
        const scheduleShift = minus(
          v2Fixed.installmentsAmount,
          v1Parts.installments,
        )
        const v2Plans = financial.plans
          .filter((plan) => plan.cardId === invoice.cardId)
          .filter((plan) =>
            installmentSchedule(plan).some((item) => item.month === ref),
          )
          .map((plan) => plan.id)
        const v1PlanIds = new Set(
          v1Parts.planIds.map(
            (v1Id) => data.plans.find((plan) => plan.v1Id === v1Id)?.id,
          ),
        )
        const entered = v2Plans.filter((planId) => !v1PlanIds.has(planId))
        const left = [...v1PlanIds].filter(
          (planId): planId is string => !!planId && !v2Plans.includes(planId),
        )
        const explained =
          trace.v1Amount === v1Composed &&
          scheduleShift !== 0 &&
          minus(v2Total, trace.v1Amount) === scheduleShift
        const reasons = [
          entered.length ? `entram ${planNames(entered)}` : '',
          left.length ? `saem ${planNames(left)}` : '',
        ].filter(Boolean)
        add(
          `Fatura ${trace.label}: v1 ${formatMoney(trace.v1Amount)}, v2 ${formatMoney(v2Total)} (${signed(minus(v2Total, trace.v1Amount))}). ` +
            (explained
              ? `Cronograma fixo: ${reasons.join('; ')}.`
              : trace.v1Amount !== v1Composed
                ? `A v1 guardava ${formatMoney(trace.v1Amount)}, mas as partes somavam ${formatMoney(v1Composed)}. Conferir.`
                : 'Não explicada. Conferir.'),
          explained,
        )
      } else {
        const plan = target.planId
          ? financial.plans.find((item) => item.id === target.planId)
          : undefined
        const item = plan
          ? installmentSchedule(plan, financial.payments).find(
              (entry) => entry.month === ref,
            )
          : undefined
        const v2Amount = item?.amount ?? cents(0)
        if (
          !account(trace.v1Amount, trace.v1Paid, v2Amount, item?.paid ?? false)
        )
          continue
        add(
          `Parcela "${trace.label}": v1 ${formatMoney(trace.v1Amount)}, v2 ${formatMoney(v2Amount)}. ` +
            (plan && !item
              ? 'Cronograma fixo: essa parcela não cai neste mês.'
              : 'Conferir.'),
          !!plan && !item,
        )
      }
    }

    // Standalone installments v2 puts in the month that v1 did not have as a row.
    const traced = new Set(
      data.outflows.flatMap((item) =>
        item.month === ref && item.target.type === 'loose' && item.target.planId
          ? [item.target.planId]
          : [],
      ),
    )
    for (const plan of financial.plans.filter(
      (item) => item.cardId === null && !traced.has(item.id),
    )) {
      const item = installmentSchedule(plan, financial.payments).find(
        (entry) => entry.month === ref,
      )
      if (!item) continue
      account(cents(0), true, item.amount, item.paid)
      const inV1 = v1PlanMonths(v1Plans.get(plan.id)!, todayMonth).has(ref)
      add(
        `Parcela "${plan.description}" ${item.number}/${item.totalInstallments}: só existe na v2 (${formatMoney(item.amount)}). ` +
          (inV1
            ? 'A v1 não tinha a linha no mês. Conferir.'
            : 'Cronograma fixo.'),
        !inV1,
      )
    }

    if (v1.incomes !== v2.incomes)
      add(
        `Entradas: v1 ${formatMoney(v1.incomes)}, v2 ${formatMoney(v2.incomes)}. Conferir.`,
        false,
      )
    if (outflowGap !== 0)
      add(
        `Saídas: ${signed(outflowGap)} sem item correspondente. Conferir.`,
        false,
      )
    if (unpaidGap !== 0)
      add(
        `Falta pagar: ${signed(unpaidGap)} sem item correspondente. Conferir.`,
        false,
      )
  }
  return { months, differences }
}

const pad = (value: string, size: number) => value.padStart(size)

export function formatComparison(
  comparison: Comparison,
  data: ImportData,
  database?: readonly (Totals & { month: Month })[],
): string {
  const lines: string[] = []
  const labels: [keyof Totals, string][] = [
    ['incomes', 'Entradas'],
    ['outflows', 'Saídas'],
    ['available', 'Disponível'],
    ['unpaid', 'Falta pagar'],
  ]
  for (const row of comparison.months) {
    const stored = database?.find((item) => item.month === row.month)
    lines.push('', monthLabel(row.month))
    lines.push(
      `  ${''.padEnd(12)}${pad('v1', 14)}${pad('v2', 14)}${stored ? pad('banco', 14) : ''}`,
    )
    for (const [key, label] of labels) {
      const same =
        row.v1[key] === row.v2[key] && (!stored || stored[key] === row.v2[key])
      lines.push(
        `  ${label.padEnd(12)}${pad(formatMoney(row.v1[key]), 14)}${pad(formatMoney(row.v2[key]), 14)}` +
          `${stored ? pad(formatMoney(stored[key]), 14) : ''}  ${same ? 'ok' : 'DIFERENTE'}`,
      )
    }
  }
  lines.push('', 'Diferenças')
  if (!comparison.differences.length)
    lines.push('  Nenhuma. A v2 bate com a v1 em todos os meses.')
  for (const item of comparison.differences)
    lines.push(
      `  ${item.explained ? '[cronograma fixo]' : '[CONFERIR]'} ${item.text}`,
    )
  if (data.autoPaid.length) {
    lines.push('', 'Parcelas pagas pela fatura (não mudam os totais)')
    for (const text of data.autoPaid) lines.push(`  ${text}`)
  }
  lines.push('', 'Avisos')
  if (!data.warnings.length) lines.push('  Nenhum.')
  for (const text of data.warnings) lines.push(`  ${text}`)
  lines.push(
    '',
    `Importados: ${data.cards.length} cartões, ${data.months.length} meses, ${data.incomes.length} entradas, ` +
      `${data.bills.length} contas, ${data.invoices.length} faturas, ${data.expenses.length} gastos lançados, ` +
      `${data.plans.length} parcelamentos, ${data.payments.length} pagamentos manuais, ${data.subscriptions.length} assinaturas.`,
  )
  return lines.join('\n')
}
