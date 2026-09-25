import { toDecimal } from '../domain/money'
import type { ISODate, Month } from '../domain/months'
import type {
  Card,
  ExpenseRow,
  Finance,
  InvoiceRow,
  PaymentRow,
  PlanRow,
  SubscriptionRow,
} from './finance'
import {
  insertInvoices,
  monthDate,
  ok,
  patch,
  table,
  withInvoicePaid,
  without,
  type FinanceOp,
} from './financeOps'

const subscriptionRecord = (row: SubscriptionRow) => ({
  id: row.id,
  card_id: row.cardId,
  name: row.name,
  amount: toDecimal(row.amount),
  charge_day: row.chargeDay,
  note: row.note,
  active: row.active,
})

const cardRecord = (card: Card) => ({
  id: card.id,
  name: card.name,
  color: card.color,
  photo_path: card.photoPath,
  closing_day: card.closingDay,
  sort_order: card.sortOrder,
})

/** Everything deleting a card takes with it (seção 4.9), to undo it. */
export interface CardSnapshot {
  readonly card: Card
  readonly invoices: readonly InvoiceRow[]
  readonly expenses: readonly ExpenseRow[]
  readonly planIds: readonly string[]
  readonly subscriptionIds: readonly string[]
}

export function cardSnapshot(finance: Finance, card: Card): CardSnapshot {
  const invoices = finance.invoices.filter((item) => item.cardId === card.id)
  const ids = new Set(invoices.map((item) => item.id))
  return {
    card,
    invoices,
    expenses: finance.expenses.filter((item) => ids.has(item.invoiceId)),
    planIds: finance.plans
      .filter((item) => item.cardId === card.id)
      .map((item) => item.id),
    subscriptionIds: finance.subscriptions
      .filter((item) => item.cardId === card.id)
      .map((item) => item.id),
  }
}

export const editOps = {
  addSubscription(row: SubscriptionRow): FinanceOp {
    return {
      run: () => ok(table('subscriptions').insert(subscriptionRecord(row))),
      apply: (f) => ({ ...f, subscriptions: [...f.subscriptions, row] }),
    }
  },

  updateSubscription(row: SubscriptionRow): FinanceOp {
    const { id, ...record } = subscriptionRecord(row)
    return {
      run: () => ok(table('subscriptions').update(record).eq('id', id)),
      apply: (f) => ({
        ...f,
        subscriptions: patch(f.subscriptions, row.id, row),
      }),
    }
  },

  removeSubscription(row: SubscriptionRow): FinanceOp {
    return {
      run: () => ok(table('subscriptions').delete().eq('id', row.id)),
      apply: (f) => ({ ...f, subscriptions: without(f.subscriptions, row.id) }),
    }
  },

  addCard(card: Card): FinanceOp {
    return {
      run: () => ok(table('cards').insert(cardRecord(card))),
      apply: (f) => ({ ...f, cards: [...f.cards, card] }),
    }
  },

  updateCard(card: Card): FinanceOp {
    const { id, ...record } = cardRecord(card)
    return {
      run: () => ok(table('cards').update(record).eq('id', id)),
      apply: (f) => ({ ...f, cards: patch(f.cards, card.id, card) }),
    }
  },

  /** Its invoices go with it; plans and subscriptions stay, without a card. */
  removeCard(snapshot: CardSnapshot): FinanceOp {
    const invoiceIds = new Set(snapshot.invoices.map((item) => item.id))
    return {
      run: () => ok(table('cards').delete().eq('id', snapshot.card.id)),
      apply: (f) => ({
        ...f,
        cards: without(f.cards, snapshot.card.id),
        invoices: f.invoices.filter((item) => !invoiceIds.has(item.id)),
        expenses: f.expenses.filter((item) => !invoiceIds.has(item.invoiceId)),
        payments: f.payments.filter(
          (item) => !item.invoiceId || !invoiceIds.has(item.invoiceId),
        ),
        plans: f.plans.map((item) =>
          item.cardId === snapshot.card.id ? { ...item, cardId: null } : item,
        ),
        subscriptions: f.subscriptions.map((item) =>
          item.cardId === snapshot.card.id ? { ...item, cardId: null } : item,
        ),
      }),
    }
  },

  /** Puts the card back, links its plans again, then its invoices (paid ones last). */
  restoreCard(snapshot: CardSnapshot, today: ISODate): FinanceOp {
    const cardId = snapshot.card.id
    const plans = new Set(snapshot.planIds)
    const subscriptions = new Set(snapshot.subscriptionIds)
    return {
      run: async () => {
        await ok(table('cards').insert(cardRecord(snapshot.card)))
        if (snapshot.planIds.length)
          await ok(
            table('installment_plans')
              .update({ card_id: cardId })
              .in('id', [...snapshot.planIds]),
          )
        if (snapshot.subscriptionIds.length)
          await ok(
            table('subscriptions')
              .update({ card_id: cardId })
              .in('id', [...snapshot.subscriptionIds]),
          )
        await insertInvoices(snapshot.invoices, snapshot.expenses)
      },
      apply: (f) => {
        let restored: Finance = {
          ...f,
          cards: [...f.cards, snapshot.card],
          plans: f.plans.map((item) =>
            plans.has(item.id) ? { ...item, cardId } : item,
          ),
          subscriptions: f.subscriptions.map((item) =>
            subscriptions.has(item.id) ? { ...item, cardId } : item,
          ),
          invoices: [
            ...f.invoices,
            ...snapshot.invoices.map((item) => ({ ...item, paid: false })),
          ],
          expenses: [...f.expenses, ...snapshot.expenses],
        }
        for (const invoice of snapshot.invoices.filter((item) => item.paid))
          restored = withInvoicePaid(
            restored,
            invoice.id,
            true,
            invoice.paidOn ?? today,
          )
        return restored
      },
    }
  },

  updatePlan(plan: PlanRow): FinanceOp {
    return {
      run: () =>
        ok(
          table('installment_plans')
            .update({
              card_id: plan.cardId,
              description: plan.description,
              installment_amount: toDecimal(plan.installmentAmount),
              final_adjustment: toDecimal(plan.finalAdjustment),
              total_installments: plan.totalInstallments,
              first_month: monthDate(plan.firstMonth),
              note: plan.note,
            })
            .eq('id', plan.id),
        ),
      apply: (f) => ({ ...f, plans: patch(f.plans, plan.id, plan) }),
    }
  },

  /** A payment registered by hand on the plan, with its date and month (seção 4.4). */
  addPayment(payment: PaymentRow): FinanceOp {
    return {
      run: () =>
        ok(
          table('installment_payments').insert({
            id: payment.id,
            plan_id: payment.planId,
            month: monthDate(payment.month),
            paid_on: payment.paidOn,
            source: 'manual',
          }),
        ),
      apply: (f) => ({ ...f, payments: [...f.payments, payment] }),
    }
  },

  removePayment(payment: PaymentRow): FinanceOp {
    return {
      run: () =>
        ok(table('installment_payments').delete().eq('id', payment.id)),
      apply: (f) => ({ ...f, payments: without(f.payments, payment.id) }),
    }
  },
}

/** Manual payment for one month of a plan, dated as the person says. */
export function manualPayment(
  plan: PlanRow,
  target: Month,
  paidOn: ISODate,
  id: string = crypto.randomUUID(),
): PaymentRow {
  return {
    id,
    planId: plan.id,
    month: target,
    paidOn,
    source: 'manual',
    invoiceId: null,
  }
}
