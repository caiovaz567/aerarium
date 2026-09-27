import type { Finance } from '../../data/finance'
import type { OutflowItem } from '../../domain/categories'

/** What each piece is called in the list, and where it comes from. */
export function describeOutflow(finance: Finance, item: OutflowItem) {
  const card = finance.cards.find((row) => row.id === item.cardId)
  const onCard = card ? card.name : 'Fora do cartão'
  switch (item.source) {
    case 'bill': {
      const bill = finance.bills.find((row) => row.id === item.id)
      return { title: bill?.description ?? 'Conta', detail: 'Conta' }
    }
    case 'expense': {
      const expense = finance.expenses.find((row) => row.id === item.id)
      return { title: expense?.description ?? 'Gasto', detail: onCard }
    }
    case 'installment': {
      const plan = finance.plans.find((row) => row.id === item.id)
      return {
        title: plan?.description ?? 'Parcela',
        detail: `parcela ${item.number}/${plan?.totalInstallments} · ${onCard}`,
      }
    }
    case 'subscription': {
      const subscription = finance.subscriptions.find(
        (row) => row.id === item.id,
      )
      return {
        title: subscription?.name ?? 'Assinatura',
        detail: `assinatura · ${onCard}`,
      }
    }
    case 'other':
      return {
        title: `Fatura ${card?.name ?? ''}`.trim(),
        detail: 'sem detalhe',
      }
  }
}
