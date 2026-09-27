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
  ['data', 'Por data'],
  ['tipo', 'Por tipo'],
  ['categoria', 'Por categoria'],
]
/** The last view used, per device (a convenience; the default is "Por data"). */
const KEY = 'aerarium.meses.visao'

function remembered(): View {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'data' || saved === 'tipo' || saved === 'categoria')
      return saved
  } catch {
    /* private mode */
  }
  return 'data'
}

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
  const [view, setView] = useState<View>(remembered)
  const choose = (next: View) => {
    setView(next)
    try {
      localStorage.setItem(KEY, next)
    } catch {
      /* private mode: not remembered */
    }
  }
  const { view: summary } = byType
  return (
    <section className="block" aria-labelledby="saidas">
      <div className="block-head">
        <h2 id="saidas">Saídas</h2>
        <span className="meta">
          {summary.paidCount} de {summary.outflowCount} pagas
        </span>
        <span className="sum neg">{formatMoney(summary.balance.outflows)}</span>
      </div>
      <div className="segmented views" role="group" aria-label="Ver saídas">
        {VIEWS.map(([key, label]) => (
          <button
            type="button"
            key={key}
            aria-pressed={view === key}
            onClick={() => choose(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {view === 'data' && (
        <TimelineView finance={finance} month={month} onOpen={onOpen} />
      )}
      {view === 'tipo' && <OutflowsByType {...byType} />}
      {view === 'categoria' && (
        <SpendingList finance={finance} month={month} onOpen={onOpen} />
      )}
    </section>
  )
}
