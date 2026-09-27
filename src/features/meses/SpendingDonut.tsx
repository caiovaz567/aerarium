import type { Finance } from '../../data/finance'
import {
  UNCATEGORIZED,
  UNDETAILED,
  type CategoryGroup,
} from '../../domain/categories'
import { formatMoney, type Cents } from '../../domain/money'

const SIZE = 180
const STROKE = 26
const RADIUS = (SIZE - STROKE) / 2
const CIRCLE = 2 * Math.PI * RADIUS
/** Space between slices, along the ring. */
const GAP = 2.5

/** Slice color: the category's own; grays for "Sem categoria" and the rest. */
function groupColor(finance: Finance, key: string) {
  if (key === UNCATEGORIZED) return 'var(--muted)'
  if (key === UNDETAILED)
    return 'color-mix(in srgb, var(--muted) 40%, var(--surface))'
  return (
    finance.categories.find((item) => item.id === key)?.color ?? 'var(--muted)'
  )
}

/**
 * Fase 12 (asked by the user): the month's outflows as a ring, one slice per
 * category, with the total in the middle. The list below is the legend.
 */
export function SpendingDonut({
  finance,
  groups,
  total,
}: {
  readonly finance: Finance
  readonly groups: readonly CategoryGroup[]
  readonly total: Cents
}) {
  // Where each slice starts along the ring: the shares before it.
  const starts = groups.map(
    (_, index) =>
      groups.slice(0, index).reduce((sum, group) => sum + group.share, 0) *
      CIRCLE,
  )
  const slices = groups.map((group, index) => ({
    key: group.key,
    color: groupColor(finance, group.key),
    // A very small slice still shows as a dot, and gaps never eat it whole.
    dash: Math.max(group.share * CIRCLE - (groups.length > 1 ? GAP : 0), 1),
    offset: -starts[index]!,
  }))
  return (
    <div className="donut">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`Saídas do mês por categoria, ${formatMoney(total)} no total`}
      >
        <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          {slices.map((slice) => (
            <circle
              key={slice.key}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              strokeWidth={STROKE}
              style={{ stroke: slice.color }}
              strokeDasharray={`${slice.dash} ${CIRCLE}`}
              strokeDashoffset={slice.offset}
            />
          ))}
        </g>
      </svg>
      <div className="donut-center" aria-hidden="true">
        <small>Saídas</small>
        <b>{formatMoney(total)}</b>
      </div>
    </div>
  )
}
