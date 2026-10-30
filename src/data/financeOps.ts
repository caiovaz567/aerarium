import { setInvoicePaid } from '../domain/invoices'
import { toDecimal, type Cents } from '../domain/money'
import { dateInSaoPaulo, type ISODate, type Month } from '../domain/months'
import type {
  BillRow,
  ExpenseRow,
  Finance,
  IncomeRow,
  InvoiceRow,
  MonthEntry,
  PaymentRow,
  PlanRow,
} from './finance'
import { supabase } from './supabase'

/**
 * One change: `run` writes to Supabase (RLS applies), `apply` shows it on screen
 * right away. The cache is refetched afterwards, so `apply` only has to be close.
 */
export interface FinanceOp {
  readonly run: () => Promise<void>
  readonly apply: (finance: Finance) => Finance
}

type Result = PromiseLike<{ error: { message: string } | null }>
export async function ok(request: Result) {
  const { error } = await request
  if (error) throw new Error(error.message)
}
export const table = (name: string) => supabase().from(name)
export const monthDate = (value: Month) => `${value}-01`

export function patch<T extends { readonly id: string }>(
  list: readonly T[],
  id: string,
  changes: Partial<T>,
): T[] {
  return list.map((item) => (item.id === id ? { ...item, ...changes } : item))
}
export const without = <T extends { readonly id: string }>(
  list: readonly T[],
  id: string,
) => list.filter((item) => item.id !== id)

const incomeRecord = (row: IncomeRow) => ({
  id: row.id,
  month_id: row.monthId,
  description: row.description,
  amount: toDecimal(row.amount),
  kind: row.kind,
  sort_order: row.sortOrder,
})
const billRecord = (row: BillRow) => ({
  id: row.id,
  month_id: row.monthId,
  description: row.description,
  amount: toDecimal(row.amount),
  paid: row.paid,
  paid_on: row.paidOn,
  sort_order: row.sortOrder,
  category_id: row.categoryId ?? null,
  occurred_at: row.occurredAt ?? null,
  paid_from: row.paidFrom ?? null,
})
const invoiceRecord = (row: InvoiceRow) => ({
  id: row.id,
  card_id: row.cardId,
  month_id: row.monthId,
  other_amount: toDecimal(row.otherAmount),
  estimated: row.estimated,
  note: row.note,
  bank_total: row.bankTotal == null ? null : toDecimal(row.bankTotal),
})
const expenseRecord = (row: ExpenseRow) => ({
  id: row.id,
  invoice_id: row.invoiceId,
  description: row.description,
  amount: toDecimal(row.amount),
  spent_on: row.spentOn,
  category_id: row.categoryId ?? null,
  occurred_at: row.occurredAt ?? null,
  note: row.note ?? null,
  external_id: row.externalId ?? null,
  for_other: row.forOther ?? false,
  reviewed_at: row.reviewedAt ?? null,
})

/** Invoices go in unpaid; marking them paid afterwards lets the database freeze the total. */
export async function insertInvoices(
  invoices: readonly InvoiceRow[],
  expenses: readonly ExpenseRow[],
) {
  if (invoices.length)
    await ok(table('invoices').insert(invoices.map(invoiceRecord)))
  if (expenses.length)
    await ok(table('invoice_expenses').insert(expenses.map(expenseRecord)))
  for (const invoice of invoices.filter((item) => item.paid))
    await ok(
      table('invoices')
        .update({ paid: true, paid_on: invoice.paidOn })
        .eq('id', invoice.id),
    )
}

/** Mirror of the database trigger: paying an invoice pays its card installments. */
export function withInvoicePaid(
  finance: Finance,
  invoiceId: string,
  paid: boolean,
  date: ISODate,
): Finance {
  // Always the latest row, so an edit queued just before is not lost.
  const invoice = finance.invoices.find((item) => item.id === invoiceId)
  if (!invoice) return finance
  const unpaid = { ...invoice, paid: false, paidOn: null, closedTotal: null }
  const result = setInvoicePaid(paid ? unpaid : invoice, paid, date, finance)
  const payments: PaymentRow[] = result.payments.map(
    (item) =>
      finance.payments.find(
        (old) => old.planId === item.planId && old.month === item.month,
      ) ?? { ...item, id: `pendente-${item.planId}-${item.month}` },
  )
  return {
    ...finance,
    invoices: patch(finance.invoices, invoiceId, result.invoice),
    payments,
  }
}

export const ops = {
  billPaid(bill: BillRow, paid: boolean, today: ISODate): FinanceOp {
    return {
      run: () =>
        ok(
          table('bills')
            .update({ paid, paid_on: paid ? today : null })
            .eq('id', bill.id),
        ),
      apply: (f) => ({
        ...f,
        bills: patch(f.bills, bill.id, { paid, paidOn: paid ? today : null }),
      }),
    }
  },

  invoicePaid(invoice: InvoiceRow, paid: boolean, today: ISODate): FinanceOp {
    return {
      run: () =>
        ok(
          table('invoices')
            .update({ paid, paid_on: paid ? today : null })
            .eq('id', invoice.id),
        ),
      apply: (f) => withInvoicePaid(f, invoice.id, paid, today),
    }
  },

  /** Standalone installments (no card) are paid one by one, dated today. */
  loosePaid(plan: PlanRow, target: Month, paid: boolean, today: ISODate) {
    const id = crypto.randomUUID()
    return {
      run: () =>
        paid
          ? ok(
              table('installment_payments').insert({
                id,
                plan_id: plan.id,
                month: monthDate(target),
                paid_on: today,
                source: 'manual',
              }),
            )
          : ok(
              table('installment_payments')
                .delete()
                .eq('plan_id', plan.id)
                .eq('month', monthDate(target))
                .eq('source', 'manual'),
            ),
      apply: (f) => ({
        ...f,
        payments: paid
          ? [
              ...f.payments,
              {
                id,
                planId: plan.id,
                month: target,
                paidOn: today,
                source: 'manual' as const,
                invoiceId: null,
              },
            ]
          : f.payments.filter(
              (item) => !(item.planId === plan.id && item.month === target),
            ),
      }),
    } satisfies FinanceOp
  },

  updateIncome(
    income: IncomeRow,
    changes: { description: string; amount: Cents },
  ): FinanceOp {
    return {
      run: () =>
        ok(
          table('incomes')
            .update({
              description: changes.description,
              amount: toDecimal(changes.amount),
            })
            .eq('id', income.id),
        ),
      apply: (f) => ({ ...f, incomes: patch(f.incomes, income.id, changes) }),
    }
  },

  removeIncome(income: IncomeRow): FinanceOp {
    return {
      run: () => ok(table('incomes').delete().eq('id', income.id)),
      apply: (f) => ({ ...f, incomes: without(f.incomes, income.id) }),
    }
  },

  /** Also used by Lançar to add a new income. */
  restoreIncome(income: IncomeRow): FinanceOp {
    return {
      run: () => ok(table('incomes').insert(incomeRecord(income))),
      apply: (f) => ({ ...f, incomes: [...f.incomes, income] }),
    }
  },

  updateBill(
    bill: BillRow,
    changes: {
      description: string
      amount: Cents
      paid: boolean
      categoryId?: string | null
      occurredAt?: string | null
      paidFrom?: string | null
    },
    today: ISODate,
  ): FinanceOp {
    const paidOn = changes.paid ? (bill.paidOn ?? today) : null
    return {
      run: () =>
        ok(
          table('bills')
            .update({
              description: changes.description,
              amount: toDecimal(changes.amount),
              paid: changes.paid,
              paid_on: paidOn,
              ...(changes.categoryId !== undefined && {
                category_id: changes.categoryId,
              }),
              ...(changes.occurredAt !== undefined && {
                occurred_at: changes.occurredAt,
              }),
              ...(changes.paidFrom !== undefined && {
                paid_from: changes.paidFrom,
              }),
            })
            .eq('id', bill.id),
        ),
      apply: (f) => ({
        ...f,
        bills: patch(f.bills, bill.id, { ...changes, paidOn }),
      }),
    }
  },

  removeBill(bill: BillRow): FinanceOp {
    return {
      run: () => ok(table('bills').delete().eq('id', bill.id)),
      apply: (f) => ({ ...f, bills: without(f.bills, bill.id) }),
    }
  },

  /** Also used by Lançar to add a new bill. */
  restoreBill(bill: BillRow): FinanceOp {
    return {
      run: () => ok(table('bills').insert(billRecord(bill))),
      apply: (f) => ({ ...f, bills: [...f.bills, bill] }),
    }
  },

  /**
   * The whole invoice at the bank, typed for a card without Open Finance (null
   * clears it).
   */
  setBankTotal(invoice: InvoiceRow, bankTotal: Cents | null): FinanceOp {
    return {
      run: () =>
        ok(
          table('invoices')
            .update({
              bank_total: bankTotal === null ? null : toDecimal(bankTotal),
            })
            .eq('id', invoice.id),
        ),
      apply: (f) => ({
        ...f,
        invoices: patch(f.invoices, invoice.id, { bankTotal }),
      }),
    }
  },

  /** Other amount, estimate flag and note of an invoice. */
  updateInvoice(
    invoice: InvoiceRow,
    changes: { otherAmount: Cents; estimated: boolean; note: string | null },
  ): FinanceOp {
    return {
      run: () =>
        ok(
          table('invoices')
            .update({
              other_amount: toDecimal(changes.otherAmount),
              estimated: changes.estimated,
              note: changes.note,
            })
            .eq('id', invoice.id),
        ),
      apply: (f) => ({
        ...f,
        invoices: patch(f.invoices, invoice.id, changes),
      }),
    }
  },

  updateExpense(
    expense: ExpenseRow,
    changes: {
      description: string
      amount: Cents
      categoryId: string | null
      occurredAt?: string | null
      note?: string | null
      forOther?: boolean
    },
  ): FinanceOp {
    // The database moves spent_on to the day of occurred_at; so does the screen.
    const spentOn = changes.occurredAt
      ? dateInSaoPaulo(new Date(changes.occurredAt))
      : expense.spentOn
    return {
      run: () =>
        ok(
          table('invoice_expenses')
            .update({
              description: changes.description,
              amount: toDecimal(changes.amount),
              category_id: changes.categoryId,
              ...(changes.occurredAt !== undefined && {
                occurred_at: changes.occurredAt,
              }),
              ...(changes.note !== undefined && { note: changes.note }),
              ...(changes.forOther !== undefined && {
                for_other: changes.forOther,
              }),
            })
            .eq('id', expense.id),
        ),
      apply: (f) => ({
        ...f,
        expenses: patch(f.expenses, expense.id, { ...changes, spentOn }),
      }),
    }
  },

  /** An expense to another invoice of its card, created first when new. */
  moveExpense(
    expense: ExpenseRow,
    invoice: InvoiceRow,
    created: boolean,
  ): FinanceOp {
    return {
      run: async () => {
        if (created) await ok(table('invoices').insert(invoiceRecord(invoice)))
        await ok(
          table('invoice_expenses')
            .update({ invoice_id: invoice.id })
            .eq('id', expense.id),
        )
      },
      apply: (f) => ({
        ...f,
        invoices: created ? [...f.invoices, invoice] : f.invoices,
        expenses: patch(f.expenses, expense.id, { invoiceId: invoice.id }),
      }),
    }
  },

  removeExpense(expense: ExpenseRow): FinanceOp {
    return {
      run: () => ok(table('invoice_expenses').delete().eq('id', expense.id)),
      apply: (f) => ({ ...f, expenses: without(f.expenses, expense.id) }),
    }
  },

  /** Also used by Lançar to add a new expense (same insert). */
  restoreExpense(expense: ExpenseRow): FinanceOp {
    return {
      run: () => ok(table('invoice_expenses').insert(expenseRecord(expense))),
      apply: (f) => ({ ...f, expenses: [...f.expenses, expense] }),
    }
  },

  /** Deleting an invoice also drops its launched expenses and automatic payments. */
  removeInvoice(invoice: InvoiceRow): FinanceOp {
    return {
      run: () => ok(table('invoices').delete().eq('id', invoice.id)),
      apply: (f) => ({
        ...f,
        invoices: without(f.invoices, invoice.id),
        expenses: f.expenses.filter((item) => item.invoiceId !== invoice.id),
        payments: f.payments.filter((item) => item.invoiceId !== invoice.id),
      }),
    }
  },

  restoreInvoice(
    invoice: InvoiceRow,
    expenses: readonly ExpenseRow[],
    today: ISODate,
  ): FinanceOp {
    return {
      run: () => insertInvoices([invoice], expenses),
      apply: (f) => {
        const restored = {
          ...f,
          invoices: [...f.invoices, { ...invoice, paid: false }],
          expenses: [...f.expenses, ...expenses],
        }
        return invoice.paid
          ? withInvoicePaid(restored, invoice.id, true, invoice.paidOn ?? today)
          : restored
      },
    }
  },

  /** Deleting a plan also deletes its payments (cascade). */
  removePlan(plan: PlanRow): FinanceOp {
    return {
      run: () => ok(table('installment_plans').delete().eq('id', plan.id)),
      apply: (f) => ({
        ...f,
        plans: without(f.plans, plan.id),
        payments: f.payments.filter((item) => item.planId !== plan.id),
      }),
    }
  },

  /** Also used by Lançar to add a new plan (no payments). */
  restorePlan(plan: PlanRow, payments: readonly PaymentRow[]): FinanceOp {
    return {
      run: async () => {
        await ok(
          table('installment_plans').insert({
            id: plan.id,
            card_id: plan.cardId,
            description: plan.description,
            installment_amount: toDecimal(plan.installmentAmount),
            final_adjustment: toDecimal(plan.finalAdjustment),
            total_installments: plan.totalInstallments,
            first_month: monthDate(plan.firstMonth),
            note: plan.note,
            category_id: plan.categoryId ?? null,
            external_key: plan.externalKey ?? null,
            for_other: plan.forOther ?? false,
            reviewed_at: plan.reviewedAt ?? null,
          }),
        )
        if (payments.length)
          await ok(
            table('installment_payments').insert(
              payments.map((item) => ({
                id: item.id,
                plan_id: item.planId,
                month: monthDate(item.month),
                paid_on: item.paidOn,
                source: item.source,
                invoice_id: item.invoiceId,
              })),
            ),
          )
      },
      apply: (f) => ({
        ...f,
        plans: [...f.plans, plan],
        payments: [...f.payments, ...payments],
      }),
    }
  },

  /** A whole month with its rows. If any insert fails, the month is removed again. */
  createMonth(month: MonthSnapshot): FinanceOp {
    return {
      run: async () => {
        await ok(
          table('months').insert({
            id: month.entry.id,
            ref: monthDate(month.entry.ref),
          }),
        )
        try {
          if (month.incomes.length)
            await ok(table('incomes').insert(month.incomes.map(incomeRecord)))
          if (month.bills.length)
            await ok(table('bills').insert(month.bills.map(billRecord)))
          await insertInvoices(month.invoices, month.expenses)
        } catch (error) {
          await table('months').delete().eq('id', month.entry.id)
          throw error
        }
      },
      apply: (f) => ({
        ...f,
        months: [...f.months, month.entry].sort((a, b) =>
          a.ref.localeCompare(b.ref),
        ),
        incomes: [...f.incomes, ...month.incomes],
        bills: [...f.bills, ...month.bills],
        invoices: [...f.invoices, ...month.invoices],
        expenses: [...f.expenses, ...month.expenses],
      }),
    }
  },

  removeMonth(month: MonthSnapshot): FinanceOp {
    const invoiceIds = new Set(month.invoices.map((item) => item.id))
    return {
      run: () => ok(table('months').delete().eq('id', month.entry.id)),
      apply: (f) => ({
        ...f,
        months: without(f.months, month.entry.id),
        incomes: f.incomes.filter((item) => item.monthId !== month.entry.id),
        bills: f.bills.filter((item) => item.monthId !== month.entry.id),
        invoices: f.invoices.filter((item) => !invoiceIds.has(item.id)),
        expenses: f.expenses.filter((item) => !invoiceIds.has(item.invoiceId)),
        payments: f.payments.filter(
          (item) => !item.invoiceId || !invoiceIds.has(item.invoiceId),
        ),
      }),
    }
  },
}

/** Everything that belongs to one month, used to create, delete and undo. */
export interface MonthSnapshot {
  readonly entry: MonthEntry
  readonly incomes: readonly IncomeRow[]
  readonly bills: readonly BillRow[]
  readonly invoices: readonly InvoiceRow[]
  readonly expenses: readonly ExpenseRow[]
}

export function monthSnapshot(finance: Finance, ref: Month): MonthSnapshot {
  const entry = finance.months.find((item) => item.ref === ref)
  if (!entry) throw new RangeError('Mês não encontrado.')
  const invoices = finance.invoices.filter((item) => item.monthId === entry.id)
  const ids = new Set(invoices.map((item) => item.id))
  return {
    entry,
    incomes: finance.incomes.filter((item) => item.monthId === entry.id),
    bills: finance.bills.filter((item) => item.monthId === entry.id),
    invoices,
    expenses: finance.expenses.filter((item) => ids.has(item.invoiceId)),
  }
}
