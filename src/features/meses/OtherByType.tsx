import { useState } from 'react'
import type { Finance } from '../../data/finance'
import type { OutflowItem } from '../../domain/categories'
import { formatMoney, formatMoneyShort, sumMoney } from '../../domain/money'
import { CardArt } from '../../ui/CardArt'
import { GroupHead } from './MonthBlocks'
import { OutflowRow } from './TimelineView'

const total = (items: readonly OutflowItem[]) =>
  sumMoney(items.map((item) => item.amount))

/** "2 parcelas R$ 225 · 3 compras R$ 180 · resto da fatura R$ 40". */
function cardParts(items: readonly OutflowItem[]): string {
  const group = (
    source: OutflowItem['source'],
    one: string,
    many: (count: number) => string,
  ) => {
    const list = items.filter((item) => item.source === source)
    if (!list.length) return []
    return [
      `${list.length === 1 ? one : many(list.length)} ${formatMoneyShort(total(list))}`,
    ]
  }
  return [
    ...group('installment', '1 parcela', (count) => `${count} parcelas`),
    ...group('expense', '1 compra', (count) => `${count} compras`),
    ...group('other', 'resto da fatura', () => 'resto da fatura'),
  ].join(' · ')
}

/**
 * Fase 13.3, profile of the other person, "Por tipo": their part card by card
 * (tapping a card shows its items), then their installments off the cards.
 */
export function OtherByType({
  finance,
  items,
  onOpen,
}: {
  /** Seen as the other person's (viewAs: 'other'). */
  readonly finance: Finance
  readonly items: readonly OutflowItem[]
  readonly onOpen: (item: OutflowItem) => void
}) {
  const [open, setOpen] = useState<string | null>(null)
  const cards = finance.cards
    .map((card) => ({
      card,
      items: items.filter((item) => item.cardId === card.id),
    }))
    .filter((item) => item.items.length > 0)
  const loose = items.filter((item) => item.cardId === null)
  const row = (item: OutflowItem) => (
    <OutflowRow
      key={`${item.source}-${item.id}`}
      finance={finance}
      item={item}
      time={null}
      onOpen={onOpen}
    />
  )
  return (
    <div aria-label="Por tipo" role="group">
      {cards.length > 0 && (
        <>
          <GroupHead
            title="Cartões"
            total={total(cards.flatMap((item) => item.items))}
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
          <GroupHead title="Parcelas" total={total(loose)} />
          <ul className="timeline-list">{loose.map(row)}</ul>
        </>
      )}
      {items.length === 0 && (
        <p className="empty-hint">Nada do {finance.otherPerson} neste mês.</p>
      )}
    </div>
  )
}
