import { useState } from 'react'
import type { Finance } from '../../data/finance'
import type { OutflowItem } from '../../domain/categories'
import { formatMoney, sumMoney } from '../../domain/money'
import { dayMonth, type Month } from '../../domain/months'
import {
  buildTimeline,
  timeLabel,
  timedItems,
  type TimedItem,
} from '../../domain/timeline'
import { CardArt } from '../../ui/CardArt'
import { GroupHead } from './MonthBlocks'
import { OutflowRow } from './TimelineView'

const total = (items: readonly OutflowItem[]) =>
  sumMoney(items.map((item) => item.amount))

/**
 * "2 parcelas R$ 225 · 3 compras R$ 180 · resto da fatura R$ 40"; with one
 * kind only, no value (it is the card's, beside it).
 */
function cardParts(items: readonly OutflowItem[]): string {
  const kinds = new Set(items.map((item) => item.source)).size
  const group = (
    source: OutflowItem['source'],
    one: string,
    many: (count: number) => string,
  ) => {
    const list = items.filter((item) => item.source === source)
    if (!list.length) return []
    const text = list.length === 1 ? one : many(list.length)
    return [kinds > 1 ? `${text} ${formatMoney(total(list))}` : text]
  }
  return [
    ...group('installment', '1 parcela', (count) => `${count} parcelas`),
    ...group('expense', '1 compra', (count) => `${count} compras`),
    ...group('other', 'resto da fatura', () => 'resto da fatura'),
  ].join(' · ')
}

/**
 * Fase 13.3, profile of the other person, "Por tipo": their part card by card
 * (tapping a card shows its items, newest first, then the installments),
 * then their installments off the cards.
 */
export function OtherByType({
  finance,
  month,
  onOpen,
  empty,
}: {
  /** Seen as the other person's (viewAs: 'other'). */
  readonly finance: Finance
  readonly month: Month
  readonly onOpen: (item: OutflowItem) => void
  /** Shown when the month has nothing. */
  readonly empty?: string
}) {
  const [open, setOpen] = useState<string | null>(null)
  // Newest first, like "Por data"; what has no date (installments) after.
  const { dated, fixed } = timedItems(month, finance)
  const timeline = buildTimeline(dated, fixed)
  const items: readonly (OutflowItem | TimedItem)[] = [
    ...timeline.days.flatMap((day) => day.items),
    ...timeline.fixed,
  ]
  const cards = finance.cards
    .map((card) => ({
      card,
      items: items.filter((item) => item.cardId === card.id),
    }))
    .filter((item) => item.items.length > 0)
  const loose = items.filter((item) => item.cardId === null)
  const row = (item: OutflowItem | TimedItem) => (
    <OutflowRow
      key={`${item.source}-${item.id}`}
      finance={finance}
      item={item}
      time={
        'day' in item
          ? [dayMonth(item.day), item.at && timeLabel(item.at)]
              .filter(Boolean)
              .join(' ')
          : null
      }
      onOpen={onOpen}
    />
  )
  return (
    <div aria-label="Por tipo" role="group">
      {cards.length > 0 && (
        <>
          <GroupHead
            title="Cartões"
            total={
              loose.length
                ? total(cards.flatMap((item) => item.items))
                : undefined
            }
          />
          <ul className="rows">
            {cards.map(({ card, items: mine }) => (
              <li className="row other-card" key={card.id}>
                <button
                  type="button"
                  className="row-main card-row"
                  aria-expanded={open === card.id}
                  onClick={() => setOpen(open === card.id ? null : card.id)}
                >
                  <CardArt card={card} size="xs" />
                  <span className="card-body">
                    <span className="card-name">{card.name}</span>
                    <span className="val">{formatMoney(total(mine))}</span>
                    <span className="card-sub">{cardParts(mine)}</span>
                  </span>
                </button>
                {open === card.id && (
                  <ul className="timeline-list">{mine.map(row)}</ul>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {loose.length > 0 && (
        <>
          <GroupHead
            title="Parcelas"
            total={cards.length ? total(loose) : undefined}
          />
          <ul className="timeline-list">{loose.map(row)}</ul>
        </>
      )}
      {items.length === 0 && (
        <p className="empty-hint">
          {empty ?? `Nada do ${finance.otherPerson} neste mês.`}
        </p>
      )}
    </div>
  )
}
