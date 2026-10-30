import type { ExpenseRow, Finance, InvoiceRow } from '../../data/finance'
import { ops, type FinanceOp } from '../../data/financeOps'
import { cents } from '../../domain/money'
import type { Month } from '../../domain/months'

// "Fatura" in the expense's edit: a purchase that fell in the wrong month goes
// to its card's invoice of another month in one tap.

export function expenseMonth(
  finance: Finance,
  expense: ExpenseRow,
): Month | undefined {
  return finance.invoices.find((item) => item.id === expense.invoiceId)?.month
}

/**
 * The months an expense can go to: the existing months whose invoice of the
 * same card is not paid. None while its own invoice is paid (its total is
 * frozen).
 */
export function expenseMonths(finance: Finance, expense: ExpenseRow): Month[] {
  const invoice = finance.invoices.find((item) => item.id === expense.invoiceId)
  if (!invoice || invoice.paid) return []
  return finance.months
    .map((item) => item.ref)
    .filter(
      (ref) =>
        !finance.invoices.some(
          (item) =>
            item.cardId === invoice.cardId && item.month === ref && item.paid,
        ),
    )
}

/** Moves an expense to its card's invoice of `target`, made when missing. */
export function moveExpense(
  finance: Finance,
  expense: ExpenseRow,
  target: Month,
  newId: () => string = () => crypto.randomUUID(),
): FinanceOp {
  const from = finance.invoices.find((item) => item.id === expense.invoiceId)!
  const existing = finance.invoices.find(
    (item) => item.cardId === from.cardId && item.month === target,
  )
  const invoice: InvoiceRow = existing ?? {
    id: newId(),
    cardId: from.cardId,
    monthId: finance.months.find((item) => item.ref === target)!.id,
    month: target,
    otherAmount: cents(0),
    estimated: true,
    note: null,
    paid: false,
    paidOn: null,
    closedTotal: null,
  }
  return ops.moveExpense(expense, invoice, !existing)
}

/**
 * Saving the expense's edit: one write, then the move when another month was
 * picked (one operation, so the move waits for the edit).
 */
export function saveExpense(
  finance: Finance,
  expense: ExpenseRow,
  {
    month: target,
    ...changes
  }: Parameters<typeof ops.updateExpense>[1] & { readonly month?: Month },
): FinanceOp {
  const update = ops.updateExpense(expense, changes)
  if (!target) return update
  const move = moveExpense(finance, expense, target)
  return {
    run: async () => {
      await update.run()
      await move.run()
    },
    apply: (f) => move.apply(update.apply(f)),
  }
}
