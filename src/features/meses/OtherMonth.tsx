import { useState } from 'react'
import type { Finance } from '../../data/finance'
import { monthOutflowItems, type OutflowItem } from '../../domain/categories'
import { formatMoney, sumMoney } from '../../domain/money'
import { monthName, type Month } from '../../domain/months'
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
 * owner's cards this month (the total once), card by card, by date or by
 * category.
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
      </section>
      <section className="block" aria-labelledby="compras-outro">
        <div className="block-head">
          <h2 id="compras-outro">Compras do {name}</h2>
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
