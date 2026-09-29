import { useState } from 'react'
import type { Finance } from '../../data/finance'
import { monthOutflowItems, type OutflowItem } from '../../domain/categories'
import { cents, formatMoney, sumMoney } from '../../domain/money'
import { monthName, type Month } from '../../domain/months'
import { CardArt } from '../../ui/CardArt'
import { OtherByType } from './OtherByType'
import { SpendingList } from './SpendingBlock'
import { TimelineView } from './TimelineView'

type View = 'tipo' | 'data' | 'categoria'
// Like the owner's Saídas: "Por tipo" first, and it always opens there.
const VIEWS: [View, string][] = [
  ['tipo', 'Por tipo'],
  ['data', 'Por data'],
  ['categoria', 'Por categoria'],
]

/**
 * Fase 13.3, profile of the other person ("Pai"): what they spent on the
 * owner's cards this month, card by card, by date or by category.
 */
export function OtherMonth({
  finance,
  month,
  onOpen,
}: {
  readonly finance: Finance
  readonly month: Month
  readonly onOpen: (item: OutflowItem) => void
}) {
  const [view, setView] = useState<View>('tipo')
  const seen: Finance = { ...finance, viewAs: 'other' }
  const items = monthOutflowItems(month, seen)
  const total = sumMoney(items.map((item) => item.amount))
  const name = finance.otherPerson!
  const byCard = finance.cards
    .map((card) => ({
      card,
      amount: sumMoney(
        items.filter((item) => item.cardId === card.id).map((i) => i.amount),
      ),
    }))
    .filter((item) => item.amount > 0)
  const outside = sumMoney(
    items.filter((item) => item.cardId === null).map((item) => item.amount),
  )
  return (
    <>
      <section className="hero" aria-label={`Resumo do ${name}`}>
        <div className="hero-label">
          Gastos do {name} em {monthName(month)}
        </div>
        <p className="hero-num">{formatMoney(total)}</p>
        <p className="bar-cap">
          Nos seus cartões. Você paga a fatura e ele te devolve.
        </p>
        {(byCard.length > 0 || outside > 0) && (
          <ul className="other-cards">
            {byCard.map((item) => (
              <li key={item.card.id}>
                <CardArt card={item.card} size="xs" />
                <span>{item.card.name}</span>
                <b>{formatMoney(item.amount)}</b>
              </li>
            ))}
            {outside > 0 && (
              <li>
                <span>Fora dos cartões</span>
                <b>{formatMoney(cents(outside))}</b>
              </li>
            )}
          </ul>
        )}
      </section>
      <section className="block" aria-labelledby="compras-outro">
        <div className="block-head">
          <h2 id="compras-outro">Compras do {name}</h2>
          <span className="sum neg">{formatMoney(total)}</span>
        </div>
        <div
          className="segmented views"
          role="group"
          aria-label={`Ver compras do ${name}`}
        >
          {VIEWS.map(([key, label]) => (
            <button
              type="button"
              key={key}
              aria-pressed={view === key}
              onClick={() => setView(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {view === 'tipo' && (
          <OtherByType finance={seen} month={month} onOpen={onOpen} />
        )}
        {view === 'data' && (
          <TimelineView finance={seen} month={month} onOpen={onOpen} />
        )}
        {view === 'categoria' && (
          <SpendingList finance={seen} month={month} onOpen={onOpen} />
        )}
      </section>
    </>
  )
}
