import { chargedIn } from './cardDates'
import { installmentSchedule } from './installments'
import { cents, formatMoney, nonNegative, sumMoney, type Cents } from './money'
import { isoDate, month, type ISODate, type Month } from './months'
import type { InstallmentPayment, Invoice, InvoiceContext } from './types'

export function fixedCardAmounts(
  cardId: string,
  target: Month,
  context: InvoiceContext,
) {
  month(target)
  return {
    installmentsAmount: sumMoney(
      context.plans
        .filter((plan) => plan.cardId === cardId)
        .flatMap((plan) => installmentSchedule(plan, context.payments))
        .filter((item) => item.month === target)
        .map((item) => item.amount),
    ),
    subscriptionsAmount: sumMoney(
      context.subscriptions
        .filter((item) => item.cardId === cardId && chargedIn(item, target))
        .map((item) => nonNegative(item.amount)),
    ),
  }
}

/** Whether the bank total gives the other person the rest of this month's invoice. */
export function bankFillsOther(target: Month, context: InvoiceContext) {
  return Boolean(
    context.otherPerson &&
    context.otherBankUntil &&
    target < context.otherBankUntil,
  )
}

export function invoiceTotals(invoice: Invoice, context: InvoiceContext) {
  const fixed = fixedCardAmounts(invoice.cardId, invoice.month, context)
  const expensesAmount = sumMoney(
    context.expenses
      .filter((item) => item.invoiceId === invoice.id)
      .map((item) => nonNegative(item.amount)),
  )
  const otherAmount = nonNegative(invoice.otherAmount)
  const calculatedTotal = sumMoney([
    ...Object.values(fixed),
    expensesAmount,
    otherAmount,
  ])
  if (invoice.paid && (invoice.closedTotal === null || invoice.paidOn === null))
    throw new RangeError('Fatura paga precisa de total congelado e data.')
  const total = invoice.paid
    ? nonNegative(invoice.closedTotal!)
    : calculatedTotal
  // Fase 13.3: the owner launches what is theirs ("outros" included); what
  // the other person bought is marked. The owner's part is the rest.
  const marked = sumMoney([
    ...context.plans
      .filter((plan) => plan.cardId === invoice.cardId && plan.forOther)
      .flatMap((plan) => installmentSchedule(plan, context.payments))
      .filter((item) => item.month === invoice.month)
      .map((item) => item.amount),
    ...context.expenses
      .filter((item) => item.invoiceId === invoice.id && item.forOther)
      .map((item) => nonNegative(item.amount)),
  ])
  const mine = cents(Math.max(0, total - marked))
  // Before otherBankUntil (owner only), the bank's total has everything, so
  // the other person's part is all of it that is not the owner's.
  const bank = invoice.bankTotal
  const otherShare =
    bankFillsOther(invoice.month, context) && bank != null
      ? cents(Math.max(marked, bank - mine))
      : marked
  return {
    ...fixed,
    expensesAmount,
    otherAmount,
    calculatedTotal,
    total,
    otherShare,
    mine,
  }
}

export function setInvoiceOther(invoice: Invoice, otherAmount: Cents): Invoice {
  return { ...invoice, otherAmount: nonNegative(otherAmount), estimated: false }
}

export function setInvoiceTotal(
  invoice: Invoice,
  total: Cents,
  context: InvoiceContext,
): Invoice {
  nonNegative(total)
  const parts = invoiceTotals(invoice, context)
  const fixed = sumMoney([
    parts.installmentsAmount,
    parts.subscriptionsAmount,
    parts.expensesAmount,
  ])
  if (total < fixed)
    throw new RangeError(
      `O total não pode ser menor que parcelas + assinaturas + gastos lançados (${formatMoney(fixed)}).`,
    )
  return setInvoiceOther(invoice, cents(total - fixed))
}

/** Returns an optimistic state; persistence must still let the DB trigger freeze. */
export function setInvoicePaid(
  invoice: Invoice,
  paid: boolean,
  date: ISODate,
  context: InvoiceContext,
): { invoice: Invoice; payments: readonly InstallmentPayment[] } {
  isoDate(date)
  if (!paid)
    return {
      invoice: { ...invoice, paid: false, paidOn: null, closedTotal: null },
      payments: context.payments.filter(
        (item) => !(item.source === 'invoice' && item.invoiceId === invoice.id),
      ),
    }
  const updated: Invoice = invoice.paid
    ? { ...invoice }
    : {
        ...invoice,
        paid: true,
        paidOn: date,
        closedTotal: invoiceTotals(invoice, context).calculatedTotal,
      }
  invoiceTotals(updated, context)
  const added: InstallmentPayment[] = context.plans
    .filter((plan) => plan.cardId === invoice.cardId)
    .flatMap((plan) => installmentSchedule(plan, context.payments))
    .filter((item) => item.month === invoice.month && !item.paid)
    .map((item) => ({
      planId: item.planId,
      month: item.month,
      paidOn: updated.paidOn!,
      source: 'invoice',
      invoiceId: invoice.id,
    }))
  return { invoice: updated, payments: [...context.payments, ...added] }
}
