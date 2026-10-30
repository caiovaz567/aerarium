import type { Card, ExpenseRow, Finance } from '../../data/finance'
import { daysBetween } from '../../domain/cardDates'
import { normalizeText } from '../../domain/categories'
import { installmentSchedule } from '../../domain/installments'
import type { Cents } from '../../domain/money'
import type { ISODate } from '../../domain/months'

export interface ReviewItem {
  readonly kind: 'expense' | 'plan'
  readonly id: string
  readonly description: string
  readonly amount: Cents
  /** The purchase day; for a plan, the day it came from the bank. */
  readonly day: ISODate
  readonly at: string | null
  readonly card: Card | null
  readonly categoryId: string | null
  readonly forOther: boolean
  /** "3x" for a plan. */
  readonly installments: number | null
  /** A purchase launched by hand that looks like this one: maybe the same. */
  readonly similar: ExpenseRow | null
}

/** How far a purchase launched by hand can be from the bank's and still ask. */
const SIMILAR_DAYS = 5
const similarGap = (amount: Cents) =>
  Math.max(100, Math.round(Math.abs(amount) * 0.05))

/**
 * For each purchase from the bank, one launched by hand on the same card with
 * a close value and day (the import only joins the exact ones). The closest
 * wins, and each one launched by hand answers for one purchase only.
 */
function similarPurchases(finance: Finance, bank: readonly ExpenseRow[]) {
  const cardOf = (invoiceId: string) =>
    finance.invoices.find((item) => item.id === invoiceId)?.cardId ?? null
  const manual = finance.expenses.filter((item) => !item.externalId)
  const pairs = bank.flatMap((purchase) =>
    manual.flatMap((typed) => {
      const gap = Math.abs(typed.amount - purchase.amount)
      const days = Math.abs(daysBetween(typed.spentOn, purchase.spentOn))
      return cardOf(typed.invoiceId) === cardOf(purchase.invoiceId) &&
        gap <= similarGap(purchase.amount) &&
        days <= SIMILAR_DAYS
        ? [{ purchase, typed, gap, days }]
        : []
    }),
  )
  pairs.sort((a, b) => a.gap - b.gap || a.days - b.days)
  const found = new Map<string, ExpenseRow>()
  const taken = new Set<string>()
  for (const pair of pairs)
    if (!found.has(pair.purchase.id) && !taken.has(pair.typed.id)) {
      found.set(pair.purchase.id, pair.typed)
      taken.add(pair.typed.id)
    }
  return found
}

/**
 * "É a mesma": the one launched by hand becomes the bank's purchase. It takes
 * the bank's name, value, day and invoice; what was typed stays as the note
 * when it says more, and whose it is and the category stay as chosen.
 */
export function joinedPurchase(
  typed: ExpenseRow,
  bank: ExpenseRow,
  at: string,
): ExpenseRow {
  const text = typed.description.trim()
  return {
    ...typed,
    invoiceId: bank.invoiceId,
    description: bank.description,
    note:
      typed.note ??
      (normalizeText(text) === normalizeText(bank.description) ? null : text),
    amount: bank.amount,
    spentOn: bank.spentOn,
    occurredAt:
      bank.occurredAt ??
      (typed.spentOn === bank.spentOn ? (typed.occurredAt ?? null) : null),
    categoryId: typed.categoryId ?? bank.categoryId ?? null,
    externalId: bank.externalId,
    reviewedAt: at,
  }
}

/**
 * 3 / 14.1, "Chegou do banco": what came from the bank and the owner has not
 * checked yet, newest first. Only with someone else using the cards.
 */
export function pendingReview(finance: Finance): ReviewItem[] {
  if (!finance.otherPerson) return []
  const cardOf = (id: string | null) =>
    finance.cards.find((card) => card.id === id) ?? null
  const invoiceCard = (invoiceId: string) =>
    cardOf(
      finance.invoices.find((item) => item.id === invoiceId)?.cardId ?? null,
    )
  const fresh = finance.expenses.filter(
    (item) => item.externalId && !item.reviewedAt,
  )
  const similar = similarPurchases(finance, fresh)
  const expenses = fresh.map((item) => ({
    kind: 'expense' as const,
    id: item.id,
    description: item.description,
    amount: item.amount,
    day: item.spentOn,
    at: item.occurredAt ?? null,
    card: invoiceCard(item.invoiceId),
    categoryId: item.categoryId ?? null,
    forOther: item.forOther ?? false,
    installments: null,
    similar: similar.get(item.id) ?? null,
  }))
  const plans = finance.plans
    .filter((plan) => plan.externalKey && !plan.reviewedAt)
    .map((plan) => ({
      kind: 'plan' as const,
      id: plan.id,
      description: plan.description,
      amount: installmentSchedule(plan, finance.payments)[0]!.amount,
      day: `${plan.firstMonth}-01` as ISODate,
      at: null,
      card: cardOf(plan.cardId),
      categoryId: plan.categoryId ?? null,
      forOther: plan.forOther ?? false,
      installments: plan.totalInstallments,
      similar: null,
    }))
  return [...expenses, ...plans].sort(
    (a, b) =>
      b.day.localeCompare(a.day) || (b.at ?? '').localeCompare(a.at ?? ''),
  )
}

/** The review list grouped by day, newest first. */
export function reviewDays(items: readonly ReviewItem[]) {
  const days: { day: ISODate; items: ReviewItem[] }[] = []
  for (const item of items) {
    const last = days[days.length - 1]
    if (last?.day === item.day) last.items.push(item)
    else days.push({ day: item.day, items: [item] })
  }
  return days
}
