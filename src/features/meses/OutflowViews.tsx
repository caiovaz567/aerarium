import { useState, type ComponentProps } from 'react'
import type { Finance } from '../../data/finance'
import type { OutflowItem } from '../../domain/categories'
import { formatMoney } from '../../domain/money'
import type { Month } from '../../domain/months'
import { OutflowsByType } from './MonthBlocks'
import { SpendingList } from './SpendingBlock'
import { TimelineView } from './TimelineView'

type View = 'data' | 'tipo' | 'categoria'
const VIEWS: [View, string][] = [
  ['tipo', 'Por tipo'],
  ['data', 'Por data'],
  ['categoria', 'Por categoria'],
]

/**
 * Fase 12: Saídas with three ways to see them (by date, by type, by category).
 * Only one shows at a time.
 */
export function OutflowViews({
  finance,
  month,
  onOpen,
  ...byType
}: {
  readonly finance: Finance
  readonly month: Month
  /** Opens an item from the date and category views. */
  readonly onOpen: (item: OutflowItem) => void
} & ComponentProps<typeof OutflowsByType>) {
  // Always opens "Por tipo" (the owner's choice, 29/09/2026).
  const [view, setView] = useState<View>('tipo')
  const { view: summary } = byType
  return (
    <section className="block" aria-labelledby="saidas">
      <div className="block-head">
        <h2 id="saidas">Saídas</h2>
        <span className="meta">
          {summary.paidCount} de {summary.outflowCount} pagas
        </span>
        {/* What is still to pay: it goes down as each one is marked paid
            (the owner's choice, 29/09/2026). The month's total and Disponível
            stay in the summary above. */}
        <span
          className={summary.balance.unpaid > 0 ? 'sum neg' : 'sum'}
          aria-label={`Falta pagar ${formatMoney(summary.balance.unpaid)}`}
        >
          {formatMoney(summary.balance.unpaid)}
        </span>
      </div>
      <div className="segmented views" role="group" aria-label="Ver saídas">
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
      {view === 'data' && (
        <TimelineView
          finance={finance}
          month={month}
          onOpen={onOpen}
          paidOf={(item) =>
            item.source === 'bill'
              ? (summary.bills.find((bill) => bill.id === item.id)?.paid ??
                null)
              : item.source === 'installment' && item.cardId === null
                ? (summary.loose.find((loose) => loose.plan.id === item.id)
                    ?.paid ?? null)
                : null
          }
          onPaid={(item, paid) => {
            const bill = summary.bills.find((row) => row.id === item.id)
            if (item.source === 'bill' && bill) byType.onBillPaid(bill, paid)
            const loose = summary.loose.find((row) => row.plan.id === item.id)
            if (item.source === 'installment' && loose)
              byType.onLoosePaid(loose, paid)
          }}
        />
      )}
      {view === 'tipo' && <OutflowsByType {...byType} />}
      {view === 'categoria' && (
        <SpendingList finance={finance} month={month} onOpen={onOpen} />
      )}
    </section>
  )
}
