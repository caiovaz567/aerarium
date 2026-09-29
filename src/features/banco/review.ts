import type { Card, Finance } from '../../data/finance'
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
}

/**
 * Fase 13.3 / 14.1, "Chegou do banco": what came from the bank and the owner
 * has not checked yet, newest first. Only with someone else using the cards.
 */
export function pendingReview(finance: Finance): ReviewItem[] {
  if (!finance.otherPerson) return []
  const cardOf = (id: string | null) =>
    finance.cards.find((card) => card.id === id) ?? null
  const invoiceCard = (invoiceId: string) =>
    cardOf(
      finance.invoices.find((item) => item.id === invoiceId)?.cardId ?? null,
    )
  const expenses = finance.expenses
    .filter((item) => item.externalId && !item.reviewedAt)
    .map((item) => ({
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
