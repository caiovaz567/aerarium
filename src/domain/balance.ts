import { installmentSchedule } from './installments'
import { invoiceTotals } from './invoices'
import { cents, nonNegative, sumMoney } from './money'
import { month, type Month } from './months'
import type { FinancialData } from './types'

export function monthBalance(target: Month, data: FinancialData) {
  month(target)
  const incomes = sumMoney(
    data.incomes
      .filter((item) => item.month === target)
      .map((item) =>
        item.kind === 'carryover'
          ? cents(item.amount)
          : nonNegative(item.amount),
      ),
  )
  const bills = data.bills
    .filter((item) => item.month === target)
    .map((item) => ({ amount: nonNegative(item.amount), paid: item.paid }))
  const invoices = data.invoices
    .filter((item) => item.month === target)
    .map((item) => ({
      amount: invoiceTotals(item, data).total,
      paid: item.paid,
    }))
  const installments = data.plans
    .filter((item) => item.cardId === null)
    .flatMap((plan) => installmentSchedule(plan, data.payments))
    .filter((item) => item.month === target)
  const outgoings = [...bills, ...invoices, ...installments]
  const outflows = sumMoney(outgoings.map((item) => item.amount))
  return {
    incomes,
    outflows,
    available: sumMoney([incomes, cents(-outflows)]),
    unpaid: sumMoney(
      outgoings.filter((item) => !item.paid).map((item) => item.amount),
    ),
    committedRatio: incomes > 0 ? outflows / incomes : null,
  }
}
