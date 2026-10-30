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
      // What the other person sends back only settles their part.
      .filter((item) => item.kind !== 'from_other')
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
      // Only the owner's part is theirs.
      amount: invoiceTotals(item, data).mine,
      paid: item.paid,
    }))
  const installments = data.plans
    .filter((item) => item.cardId === null && !item.forOther)
    .flatMap((plan) => installmentSchedule(plan, data.payments))
    .filter((item) => item.month === target)
  const outgoings = [...bills, ...invoices, ...installments]
  const outflows = sumMoney(outgoings.map((item) => item.amount))
  // The other person's part of the month, and what of it they have not sent
  // back yet (a reminder; it is not in the owner's numbers).
  const otherOwed = sumMoney([
    ...data.invoices
      .filter((item) => item.month === target)
      .map((item) => invoiceTotals(item, data).otherShare),
    ...data.plans
      .filter((plan) => plan.cardId === null && plan.forOther)
      .flatMap((plan) => installmentSchedule(plan, data.payments))
      .filter((item) => item.month === target)
      .map((item) => item.amount),
  ])
  const otherPaid = sumMoney(
    data.incomes
      .filter((item) => item.month === target && item.kind === 'from_other')
      .map((item) => nonNegative(item.amount)),
  )
  return {
    otherOwed,
    otherDue: cents(Math.max(0, otherOwed - otherPaid)),
    incomes,
    outflows,
    available: sumMoney([incomes, cents(-outflows)]),
    unpaid: sumMoney(
      outgoings.filter((item) => !item.paid).map((item) => item.amount),
    ),
    committedRatio: incomes > 0 ? outflows / incomes : null,
  }
}
