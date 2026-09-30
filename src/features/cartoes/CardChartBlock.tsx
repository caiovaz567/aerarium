import { useEffect, useMemo, useState } from 'react'
import { currentMonth } from '../../app/paths'
import type { Card, Finance } from '../../data/finance'
import {
  chartAverage,
  chartComparison,
  chartSeries,
  type CardPart,
} from '../../domain/chartSeries'
import { cents, formatMoney } from '../../domain/money'
import { monthLabel, monthShort, type Month } from '../../domain/months'
import { CardChart } from '../cartao/CardChart'
import { pointStatus } from '../cartao/cardView'

const percent = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

function Triangle({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 10 10" aria-hidden="true" focusable="false">
      <path
        d={up ? 'M5 1.5 9 8.5H1z' : 'M5 8.5 1 1.5h8z'}
        fill="currentColor"
      />
    </svg>
  )
}

/**
 * The card's invoice month by month. It opens on the page's month and is for
 * looking: picking a month here only changes what the chart shows.
 */
export function CardChartBlock({
  card,
  finance,
  month,
  part = 'total',
}: {
  readonly card: Card
  readonly finance: Finance
  readonly month: Month
  /** Eu | Pai: whose part of each invoice. */
  readonly part?: CardPart
}) {
  const now = currentMonth()
  const points = useMemo(
    () => chartSeries(card.id, now, finance, part),
    [finance, card.id, now, part],
  )
  // A month picked here counts only until the page's month changes.
  const [pick, setPick] = useState<{ from: Month; month: Month } | null>(null)
  const picked = pick?.from === month ? pick.month : null
  const selected =
    [picked, month, now].find(
      (item) => item && points.some((point) => point.month === item),
    ) ?? points[points.length - 1]?.month
  const index = points.findIndex((point) => point.month === selected)
  const choose = (target: Month) => setPick({ from: month, month: target })

  // ← → walk the chart (computer). Not while a dialog is open or typing.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (document.body.classList.contains('locked')) return
      if (/input|select|textarea/i.test((event.target as Element).tagName))
        return
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      event.preventDefault()
      const next = points[index + (event.key === 'ArrowLeft' ? -1 : 1)]
      if (next) setPick({ from: month, month: next.month })
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [points, index, month])

  const point = points[index]
  if (!point || !selected) return null
  const status = pointStatus(point, now)
  const comparison = chartComparison(points, selected)
  const average = chartAverage(points, now)

  return (
    <section className="block card-chart" aria-label="Fatura por mês">
      <div className="chart-top">
        <div className="chart-head" aria-live="polite">
          <small>
            {monthLabel(selected)} ·{' '}
            <span className={status.tone}>{status.text}</span>
          </small>
          <b>{formatMoney(point.total)}</b>
          <div className="change-row">
            {comparison &&
              (comparison.direction === 'equal' ? (
                <span className="change equal">
                  igual a {monthShort(comparison.previousMonth).slice(0, 3)}
                </span>
              ) : (
                <span className={`change ${comparison.direction}`}>
                  <Triangle up={comparison.direction === 'up'} />
                  {formatMoney(cents(Math.abs(comparison.difference)))}
                  {comparison.percentage !== null &&
                    ` (${percent.format(comparison.percentage)}%)`}
                  <small>
                    vs {monthShort(comparison.previousMonth).slice(0, 3)}
                  </small>
                </span>
              ))}
          </div>
        </div>
        {average && (
          <p className="average">
            média {average.count} meses <b>{formatMoney(average.amount)}</b>
          </p>
        )}
      </div>
      <CardChart
        points={points}
        selected={selected}
        current={now}
        onSelect={choose}
      />
    </section>
  )
}
