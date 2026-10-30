import { useState } from 'react'
import type { Finance } from '../../data/finance'
import {
  groupByCategory,
  monthOutflowItems,
  UNCATEGORIZED,
  UNDETAILED,
  type OutflowItem,
} from '../../domain/categories'
import { cents, formatMoney, sumMoney } from '../../domain/money'
import { monthShort, type Month } from '../../domain/months'
import { categoryChanges } from '../../domain/timeline'
import { CategoryBadge } from '../../ui/CategoryBadge'
import { CardIcon, ChevronDownIcon } from '../../ui/icons'
import { categoryName, percent } from './categoryName'
import { describeOutflow } from './outflowText'
import { SpendingDonut } from './SpendingDonut'

/**
 * Saídas "Por categoria": a ring with the share of each category, then the
 * list; each row says how it changed against the month before. A tap opens the
 * category with what is in it; a tap on an item opens it.
 */
export function SpendingList({
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
  if (!groups.length)
    return (
      <p className="empty-hint">Nenhuma saída ainda. Toca no + pra lançar.</p>
    )

  const label = (key: string) => categoryName(finance, key)
  const compared = categoryChanges(month, finance)
  const total = sumMoney(groups.map((group) => group.amount))

  return (
    <>
      <SpendingDonut
        finance={finance}
        groups={groups}
        total={total as (typeof groups)[number]['amount']}
      />
      <ul className="spending-list" aria-label="Por categoria">
        {groups.map((group) => {
          const expanded = open === group.key
          const change = compared?.changes.get(group.key) ?? null
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
                <span className="chevron">
                  <ChevronDownIcon />
                </span>
                <span className="share">
                  {percent.format(group.share * 100)}% das saídas
                  {change !== null && compared && (
                    <span
                      className={`change-pill ${change > 0 ? 'up' : 'down'}`}
                    >
                      {change > 0 ? '▲' : '▼'}{' '}
                      {formatMoney(cents(Math.abs(change)))} vs{' '}
                      {monthShort(compared.previous)}
                    </span>
                  )}
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
                            <small>
                              {['note' in text && text.note, text.detail]
                                .filter(Boolean)
                                .join(' · ')}
                            </small>
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
    </>
  )
}
