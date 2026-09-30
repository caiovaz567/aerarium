import type { Finance } from '../../data/finance'
import { installmentSchedule } from '../../domain/installments'
import { invoiceTotals } from '../../domain/invoices'
import { cents, sumMoney, toDecimal } from '../../domain/money'

/**
 * What the owner shows the other person (shares.data): only what was marked
 * theirs. Purchases, installments, the part of old bank invoices that is theirs
 * but not itemized, the cards they are on, the categories they use, and what
 * was paid back. Amounts as decimals, like the database.
 */
export function shareData(finance: Finance) {
  const expenses = finance.expenses.filter((item) => item.forOther)
  const plans = finance.plans.filter((item) => item.forOther)
  const invoiceOf = new Map(finance.invoices.map((item) => [item.id, item]))

  const rests = finance.invoices.flatMap((invoice) => {
    const marked = sumMoney([
      ...expenses
        .filter((item) => item.invoiceId === invoice.id)
        .map((item) => item.amount),
      ...plans
        .filter((plan) => plan.cardId === invoice.cardId)
        .flatMap((plan) => installmentSchedule(plan, finance.payments))
        .filter((item) => item.month === invoice.month)
        .map((item) => item.amount),
    ])
    const rest = invoiceTotals(invoice, finance).otherShare - marked
    return rest > 0
      ? [
          {
            cardId: invoice.cardId,
            month: invoice.month,
            amount: toDecimal(cents(rest)),
          },
        ]
      : []
  })

  const cardIds = new Set([
    ...expenses.flatMap((item) => invoiceOf.get(item.invoiceId)?.cardId ?? []),
    ...plans.flatMap((item) => item.cardId ?? []),
    ...rests.map((item) => item.cardId),
  ])
  const categoryIds = new Set(
    [...expenses, ...plans].flatMap((item) => item.categoryId ?? []),
  )

  return {
    cards: finance.cards
      .filter((card) => cardIds.has(card.id))
      .map((card) => ({
        id: card.id,
        name: card.name,
        color: card.color,
        bank: card.bank ?? null,
        sortOrder: card.sortOrder,
      })),
    expenses: expenses.flatMap((item) => {
      const invoice = invoiceOf.get(item.invoiceId)
      if (!invoice) return []
      return [
        {
          id: item.id,
          cardId: invoice.cardId,
          month: invoice.month,
          description: item.description,
          note: item.note ?? null,
          amount: toDecimal(item.amount),
          spentOn: item.spentOn,
          occurredAt: item.occurredAt ?? null,
          categoryId: item.categoryId ?? null,
        },
      ]
    }),
    plans: plans.map((plan) => ({
      id: plan.id,
      cardId: plan.cardId,
      description: plan.description,
      installmentAmount: toDecimal(plan.installmentAmount),
      finalAdjustment: toDecimal(plan.finalAdjustment),
      totalInstallments: plan.totalInstallments,
      firstMonth: plan.firstMonth,
      categoryId: plan.categoryId ?? null,
    })),
    rests,
    categories: finance.categories
      .filter((item) => categoryIds.has(item.id))
      .map((item) => ({
        id: item.id,
        name: item.name,
        color: item.color,
        icon: item.icon,
        sortOrder: item.sortOrder,
      })),
    paidBack: finance.incomes
      .filter((item) => item.kind === 'from_other')
      .map((item) => ({ month: item.month, amount: toDecimal(item.amount) })),
  }
}

/** JSON with the keys in order, to tell whether the saved copy is up to date. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`,
      )
      .join(',')}}`
  return JSON.stringify(value ?? null)
}
