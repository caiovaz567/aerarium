import { useState } from 'react'
import type { Finance, IncomeRow } from '../../data/finance'
import { monthOutflowItems, type OutflowItem } from '../../domain/categories'
import { cents, formatMoney, sumMoney, type Cents } from '../../domain/money'
import { CheckIcon } from '../../ui/icons'
import { paidIncome } from './paidBack'
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
  owed,
  due,
  onOpen,
  onPaid,
  onUndo,
}: {
  readonly finance: Finance
  readonly month: Month
  /** Their part this month, and what they have not sent back yet. */
  readonly owed: Cents
  readonly due: Cents
  readonly onOpen: (item: OutflowItem) => void
  readonly onPaid: (income: IncomeRow) => void
  readonly onUndo: () => void
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
        {owed > 0 && due === 0 ? (
          <p className="paid-status">
            <CheckIcon />
            Pagou tudo de {monthName(month).toLowerCase()}.
            <button type="button" className="link-button" onClick={onUndo}>
              Desfazer
            </button>
          </p>
        ) : (
          <p className="bar-cap">
            {due > 0
              ? `Falta ele te devolver ${formatMoney(due)}${
                  owed > due
                    ? ` (já devolveu ${formatMoney(cents(owed - due))})`
                    : ''
                }.`
              : 'Nos seus cartões. Você paga a fatura e ele te devolve.'}
          </p>
        )}
        {due > 0 && (
          <button
            type="button"
            className="btn primary self-start"
            onClick={() => onPaid(paidIncome(finance, month, due))}
          >
            {name} pagou
          </button>
        )}
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
