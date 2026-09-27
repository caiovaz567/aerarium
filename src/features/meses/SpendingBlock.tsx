import { useState } from 'react'
import type { Finance } from '../../data/finance'
import {
  groupByCategory,
  monthOutflowItems,
  UNCATEGORIZED,
  UNDETAILED,
  type OutflowItem,
} from '../../domain/categories'
import { formatMoney } from '../../domain/money'
import type { Month } from '../../domain/months'
import { CategoryBadge } from '../../ui/CategoryBadge'
import { CardIcon, ChevronDownIcon } from '../../ui/icons'

const percent = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

/** What each piece is called in the list, and where it comes from. */
function describeOutflow(finance: Finance, item: OutflowItem) {
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

/**
 * Fase 11, "Para onde foi o dinheiro": the month's outflows by category. A tap
 * opens the category with what is in it; a tap on an item opens it to edit.
 */
export function SpendingBlock({
  finance,
  month,
  onOpen,
}: {
  readonly finance: Finance
  readonly month: Month
  readonly onOpen: (item: OutflowItem) => void
}) {
  const [open, setOpen] = useState<string | null>(null)
  const groups = groupByCategory(monthOutflowItems(month, finance))
  if (!groups.length) return null

  const label = (key: string) =>
    key === UNCATEGORIZED
      ? 'Sem categoria'
      : key === UNDETAILED
        ? 'Outros gastos das faturas'
        : (finance.categories.find((item) => item.id === key)?.name ??
          'Sem categoria')
  const color = (key: string) =>
    finance.categories.find((item) => item.id === key)?.color ?? null

  return (
    <section className="block" aria-labelledby="categorias">
      <div className="block-head">
        <h2 id="categorias">Para onde foi o dinheiro</h2>
      </div>
      <ul className="spending-list">
        {groups.map((group) => {
          const expanded = open === group.key
          const dot = color(group.key)
          const listId = `categoria-${group.key}`
          return (
            <li key={group.key}>
              <button
                type="button"
                className="spending-row"
                aria-expanded={expanded}
                aria-controls={listId}
                onClick={() => setOpen(expanded ? null : group.key)}
              >
                {group.key === UNDETAILED ? (
                  // The invoices' undetailed part: a card, not a category.
                  <span className="cat-badge round none" aria-hidden="true">
                    <CardIcon />
                  </span>
                ) : (
                  <CategoryBadge
                    category={
                      finance.categories.find(
                        (item) => item.id === group.key,
                      ) ?? null
                    }
                    shape="round"
                  />
                )}
                <span className="name">{label(group.key)}</span>
                <span className="amount">{formatMoney(group.amount)}</span>
                <span className="share">
                  <span className="bar" aria-hidden="true">
                    <i
                      style={{
                        width: `${Math.max(2, group.share * 100)}%`,
                        background: dot ?? 'var(--muted)',
                      }}
                    />
                  </span>
                  {percent.format(group.share * 100)}%
                  <span className="chevron">
                    <ChevronDownIcon />
                  </span>
                </span>
              </button>
              {expanded && (
                <div id={listId}>
                  {group.key === UNDETAILED && (
                    <p className="spending-hint">
                      É o que foi colocado em "outros gastos" das faturas. Lance
                      os gastos no + pra saber onde foram.
                    </p>
                  )}
                  {group.key === UNCATEGORIZED && (
                    <p className="spending-hint">
                      Toca num item pra escolher a categoria.
                    </p>
                  )}
                  <ul className="spending-items">
                    {group.items.map((item) => {
                      const text = describeOutflow(finance, item)
                      return (
                        <li key={`${item.source}-${item.id}`}>
                          <button type="button" onClick={() => onOpen(item)}>
                            {text.title}
                            <small>{text.detail}</small>
                          </button>
                          <span className="value">
                            {formatMoney(item.amount)}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
