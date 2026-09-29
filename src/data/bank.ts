import {
  cardDaysFromBank,
  guessCard,
  planBankImport,
  type BankAccount,
  type BankBill,
  type BankTransaction,
  type ImportResult,
  type ImportState,
} from '../domain/bank'
import { cents, fromDecimal, toDecimal, type Cents } from '../domain/money'
import { isoDate, type ISODate } from '../domain/months'
import { categoryHistory } from './categoryOps'
import type {
  BankAccountRow,
  ExpenseRow,
  Finance,
  InvoiceRow,
  PlanRow,
} from './finance'
import { monthDate, ok, table, type FinanceOp } from './financeOps'
import { supabase } from './supabase'

// Open Finance (Meu Pluggy): the Edge Function "bank" only reads the bank;
// the rules are in src/domain/bank.ts; this file talks to both.

/** What the Edge Function returns (amounts in reais, as the bank sends them). */
export interface BankData {
  readonly items: readonly {
    readonly id: string
    readonly status: string
    readonly lastUpdatedAt: string | null
  }[]
  readonly accounts: readonly {
    readonly id: string
    readonly itemId: string
    readonly name: string
    readonly number: string | null
    readonly closeDate: string | null
    readonly dueDate: string | null
    readonly creditLimit?: number | null
    readonly availableLimit?: number | null
    /** What the open bill has so far (Pluggy's account balance). */
    readonly balance?: number | null
  }[]
  readonly transactions: readonly {
    readonly id: string
    readonly accountId: string
    readonly description: string
    readonly amount: number
    readonly date: string
    readonly installmentNumber: number | null
    readonly totalInstallments: number | null
    readonly billId: string | null
  }[]
  readonly bills: readonly {
    readonly id: string
    readonly accountId: string
    readonly dueDate: string
    readonly totalAmount: number
  }[]
}

/** True only for the account the function serves (the app's owner). */
export async function bankStatus(): Promise<boolean> {
  const { data, error } = await supabase().functions.invoke('bank', {
    body: { action: 'status' },
  })
  return !error && data?.enabled === true
}

export async function fetchBank(from: ISODate): Promise<BankData> {
  const { data, error } = await supabase().functions.invoke('bank', {
    body: { action: 'fetch', from },
  })
  if (error)
    throw new Error(
      'Não consegui falar com o banco. Tenta de novo daqui a pouco.',
    )
  return data as BankData
}

/** Reais as the bank sends them → cents, without floating point surprises. */
const toCents = (value: number): Cents => fromDecimal(value.toFixed(2))
const dayOf = (value: string | null): ISODate | null =>
  value ? isoDate(value.slice(0, 10)) : null

export function importInput(finance: Finance, data: BankData) {
  const cardOf = new Map(
    finance.bankAccounts.map((item) => [item.pluggyAccountId, item.cardId]),
  )
  const accounts: BankAccount[] = data.accounts.map((item) => ({
    pluggyAccountId: item.id,
    cardId: cardOf.get(item.id) ?? null,
    dueDate: dayOf(item.dueDate),
    closeDate: dayOf(item.closeDate),
    openBalance:
      item.balance != null && item.balance > 0 ? toCents(item.balance) : null,
  }))
  const transactions: BankTransaction[] = data.transactions.map((item) => ({
    id: item.id,
    accountId: item.accountId,
    description: item.description.replace(/\s+/g, ' ').trim(),
    amount: toCents(item.amount),
    date: item.date,
    installmentNumber: item.installmentNumber,
    totalInstallments: item.totalInstallments,
    billId: item.billId,
  }))
  const bills: BankBill[] = data.bills.map((item) => ({
    id: item.id,
    accountId: item.accountId,
    dueDate: isoDate(item.dueDate.slice(0, 10)),
    total: toCents(item.totalAmount),
  }))
  return { accounts, transactions, bills }
}

export function importState(finance: Finance): ImportState {
  const records = new Map<string, { amount: Cents | null }>(
    finance.bankRecords.map((item) => [
      item.externalId,
      { amount: item.amount },
    ]),
  )
  // Saved but not yet recorded (an interrupted sync): already handled too.
  for (const expense of finance.expenses)
    if (expense.externalId && !records.has(expense.externalId))
      records.set(expense.externalId, { amount: null })
  return {
    cards: finance.cards,
    months: finance.months,
    invoices: finance.invoices,
    expenses: finance.expenses,
    plans: finance.plans,
    payments: finance.payments,
    subscriptions: finance.subscriptions,
    categories: finance.categories,
    history: categoryHistory(finance),
    records,
    otherPerson: Boolean(finance.otherPerson),
    dueNextMonth: finance.dueNextMonth ?? false,
  }
}

/** A short, plain summary of what an import does. */
export function importSummary(result: ImportResult) {
  const count = (kind: string) =>
    result.records.filter((item) => item.kind === kind).length
  return {
    expenses: result.expenses.length,
    plans: result.plans.length,
    matched: result.links.length + result.planLinks.length,
    subscriptions: count('subscription'),
    // Closed bills whose total came from the bank.
    bills: result.bankTotals.length,
  }
}

export const bankOps = {
  /** Bank cards seen for the first time, linked to a card by name if possible. */
  addAccounts(finance: Finance, data: BankData): FinanceOp | null {
    const known = new Set(
      finance.bankAccounts.map((item) => item.pluggyAccountId),
    )
    const rows: BankAccountRow[] = data.accounts
      .filter((item) => !known.has(item.id))
      .map((item) => ({
        id: crypto.randomUUID(),
        pluggyAccountId: item.id,
        itemId: item.itemId,
        name: item.name,
        number: item.number,
        cardId: guessCard(item.name, finance.cards),
      }))
    if (!rows.length) return null
    return {
      run: () =>
        ok(
          table('bank_accounts').insert(
            rows.map((row) => ({
              id: row.id,
              pluggy_account_id: row.pluggyAccountId,
              item_id: row.itemId,
              name: row.name,
              number: row.number,
              card_id: row.cardId,
            })),
          ),
        ),
      apply: (f) => ({ ...f, bankAccounts: [...f.bankAccounts, ...rows] }),
    }
  },

  /** The limit of each bank card, as the bank says it now. */
  updateLimits(finance: Finance, data: BankData): FinanceOp | null {
    const at = new Date().toISOString()
    const changes = finance.bankAccounts.flatMap((row) => {
      const account = data.accounts.find(
        (item) => item.id === row.pluggyAccountId,
      )
      if (account?.creditLimit == null || account.availableLimit == null)
        return []
      return [
        {
          id: row.id,
          creditLimit: toCents(account.creditLimit),
          availableLimit: toCents(account.availableLimit),
        },
      ]
    })
    if (!changes.length) return null
    return {
      run: async () => {
        for (const change of changes)
          await ok(
            table('bank_accounts')
              .update({
                credit_limit: toDecimal(change.creditLimit),
                available_limit: toDecimal(change.availableLimit),
                limit_at: at,
              })
              .eq('id', change.id),
          )
      },
      apply: (f) => ({
        ...f,
        bankAccounts: f.bankAccounts.map((row) => {
          const change = changes.find((item) => item.id === row.id)
          return change
            ? {
                ...row,
                creditLimit: change.creditLimit,
                availableLimit: change.availableLimit,
                limitAt: at,
              }
            : row
        }),
      }),
    }
  },

  /**
   * Fase 13.3: the owner checked what came from the bank; each one keeps
   * whose it was set to.
   */
  review(
    choices: readonly {
      readonly kind: 'expense' | 'plan'
      readonly id: string
      readonly forOther: boolean
    }[],
  ): FinanceOp {
    const at = new Date().toISOString()
    const pick = (kind: 'expense' | 'plan', id: string) =>
      choices.find((item) => item.kind === kind && item.id === id)
    return {
      run: async () => {
        for (const choice of choices)
          await ok(
            table(
              choice.kind === 'expense'
                ? 'invoice_expenses'
                : 'installment_plans',
            )
              .update({ for_other: choice.forOther, reviewed_at: at })
              .eq('id', choice.id),
          )
      },
      apply: (f) => ({
        ...f,
        expenses: f.expenses.map((item) => {
          const choice = pick('expense', item.id)
          return choice
            ? { ...item, forOther: choice.forOther, reviewedAt: at }
            : item
        }),
        plans: f.plans.map((item) => {
          const choice = pick('plan', item.id)
          return choice
            ? { ...item, forOther: choice.forOther, reviewedAt: at }
            : item
        }),
      }),
    }
  },

  /** Closing and due days from the bank, only where the card has none. */
  fillCardDays(finance: Finance, data: BankData): FinanceOp | null {
    const changes = cardDaysFromBank(
      finance.cards,
      importInput(finance, data).accounts,
    )
    if (!changes.length) return null
    return {
      run: async () => {
        for (const change of changes)
          await ok(
            table('cards')
              .update({
                closing_day: change.closingDay,
                due_day: change.dueDay,
              })
              .eq('id', change.cardId),
          )
      },
      apply: (f) => ({
        ...f,
        cards: f.cards.map((card) => {
          const change = changes.find((item) => item.cardId === card.id)
          return change
            ? { ...card, closingDay: change.closingDay, dueDay: change.dueDay }
            : card
        }),
      }),
    }
  },

  setAccountCard(account: BankAccountRow, cardId: string | null): FinanceOp {
    return {
      run: () =>
        ok(
          table('bank_accounts')
            .update({ card_id: cardId })
            .eq('id', account.id),
        ),
      apply: (f) => ({
        ...f,
        bankAccounts: f.bankAccounts.map((item) =>
          item.id === account.id ? { ...item, cardId } : item,
        ),
      }),
    }
  },

  /** Writes an import. Records go last: an interrupted import is redone. */
  apply(result: ImportResult): FinanceOp {
    const invoices: InvoiceRow[] = result.invoices.map((item) => ({
      id: item.id,
      cardId: item.cardId,
      monthId: item.monthId,
      month: item.month,
      otherAmount: cents(0),
      estimated: true,
      note: null,
      paid: false,
      paidOn: null,
      closedTotal: null,
    }))
    const now = new Date().toISOString()
    const plans: PlanRow[] = result.plans.map((item) => ({
      id: item.id,
      cardId: item.cardId,
      description: item.description,
      installmentAmount: item.installmentAmount,
      finalAdjustment: cents(0),
      totalInstallments: item.totalInstallments,
      firstMonth: item.firstMonth,
      note: null,
      categoryId: item.categoryId,
      externalKey: item.externalKey,
      forOther: item.forOther,
      reviewedAt: item.reviewed ? now : null,
    }))
    const expenses: ExpenseRow[] = result.expenses.map(
      ({ reviewed, ...item }) => ({
        ...item,
        createdAt: now,
        reviewedAt: reviewed ? now : null,
      }),
    )
    const totals = new Map(
      result.invoiceTotals.map((item) => [item.invoiceId, item.otherAmount]),
    )
    const bankTotals = new Map(
      result.bankTotals.map((item) => [item.invoiceId, item.bankTotal]),
    )
    return {
      run: async () => {
        if (invoices.length)
          await ok(
            table('invoices').insert(
              invoices.map((item) => ({
                id: item.id,
                card_id: item.cardId,
                month_id: item.monthId,
              })),
            ),
          )
        if (plans.length)
          await ok(
            table('installment_plans').insert(
              plans.map((item) => ({
                id: item.id,
                card_id: item.cardId,
                description: item.description,
                installment_amount: toDecimal(item.installmentAmount),
                total_installments: item.totalInstallments,
                first_month: monthDate(item.firstMonth),
                category_id: item.categoryId,
                external_key: item.externalKey,
                for_other: item.forOther,
                reviewed_at: item.reviewedAt,
              })),
            ),
          )
        for (const link of result.planLinks)
          await ok(
            table('installment_plans')
              .update({ external_key: link.externalKey })
              .eq('id', link.planId),
          )
        if (expenses.length)
          await ok(
            table('invoice_expenses').insert(
              expenses.map((item) => ({
                id: item.id,
                invoice_id: item.invoiceId,
                description: item.description,
                amount: toDecimal(item.amount),
                spent_on: item.spentOn,
                occurred_at: item.occurredAt,
                category_id: item.categoryId,
                external_id: item.externalId,
                for_other: item.forOther,
                reviewed_at: item.reviewedAt,
              })),
            ),
          )
        for (const link of result.links)
          await ok(
            table('invoice_expenses')
              .update({
                external_id: link.externalId,
                description: link.description,
                note: link.note,
              })
              .eq('id', link.expenseId),
          )
        for (const [invoiceId, otherAmount] of totals)
          await ok(
            table('invoices')
              .update({
                other_amount: toDecimal(otherAmount),
                estimated: false,
              })
              .eq('id', invoiceId),
          )
        for (const [invoiceId, bankTotal] of bankTotals)
          await ok(
            table('invoices')
              .update({ bank_total: toDecimal(bankTotal) })
              .eq('id', invoiceId),
          )
        if (result.records.length)
          await ok(
            table('bank_records').insert(
              result.records.map((item) => ({
                external_id: item.externalId,
                kind: item.kind,
                ref_id: item.refId,
                amount: item.amount === null ? null : toDecimal(item.amount),
              })),
            ),
          )
      },
      apply: (f) => ({
        ...f,
        invoices: [...f.invoices, ...invoices].map((item) => {
          const next = totals.has(item.id)
            ? { ...item, otherAmount: totals.get(item.id)!, estimated: false }
            : item
          return bankTotals.has(item.id)
            ? { ...next, bankTotal: bankTotals.get(item.id)! }
            : next
        }),
        plans: [
          ...f.plans.map((item) => {
            const link = result.planLinks.find((row) => row.planId === item.id)
            return link ? { ...item, externalKey: link.externalKey } : item
          }),
          ...plans,
        ],
        expenses: [
          ...f.expenses.map((item) => {
            const link = result.links.find((row) => row.expenseId === item.id)
            return link
              ? {
                  ...item,
                  externalId: link.externalId,
                  description: link.description,
                  note: link.note,
                }
              : item
          }),
          ...expenses,
        ],
        bankRecords: [
          ...f.bankRecords,
          ...result.records.map((item) => ({
            externalId: item.externalId,
            amount: item.amount,
            refId: item.refId,
          })),
        ],
      }),
    }
  },
}

/** How far back a sync looks: enough for the open bill and the last closed. */
export function syncFrom(today: ISODate): ISODate {
  const day = new Date(`${today}T12:00:00Z`)
  day.setUTCDate(day.getUTCDate() - 75)
  return isoDate(day.toISOString().slice(0, 10))
}

/** Plans an import against what the app has now (bank cards added first). */
export function planSync(finance: Finance, data: BankData, day: ISODate) {
  return planBankImport(importState(finance), {
    ...importInput(finance, data),
    today: day,
  })
}
