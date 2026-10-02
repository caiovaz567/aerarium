import type { ChartPoint } from '../../domain/chartSeries'
import { formatMoney } from '../../domain/money'
import type { Month } from '../../domain/months'

export interface Point {
  readonly x: number
  readonly y: number
}

/**
 * Monotone cubic spline (Fritsch–Carlson), as in v1: smooth, and the curve never
 * goes above or below its neighbouring points.
 */
export function monotonePath(points: readonly Point[]): string {
  const n = points.length
  if (n < 2) return ''
  const dx: number[] = []
  const slope: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx[i] = points[i + 1]!.x - points[i]!.x
    slope[i] = (points[i + 1]!.y - points[i]!.y) / (dx[i] || 1)
  }
  const tangent: number[] = [slope[0]!]
  for (let i = 1; i < n - 1; i++)
    tangent[i] =
      slope[i - 1]! * slope[i]! <= 0 ? 0 : (slope[i - 1]! + slope[i]!) / 2
  tangent[n - 1] = slope[n - 2]!
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      tangent[i] = 0
      tangent[i + 1] = 0
      continue
    }
    const a = tangent[i]! / slope[i]!
    const b = tangent[i + 1]! / slope[i]!
    const size = a * a + b * b
    if (size > 9) {
      const k = 3 / Math.sqrt(size)
      tangent[i] = k * a * slope[i]!
      tangent[i + 1] = k * b * slope[i]!
    }
  }
  const f = (value: number) => value.toFixed(1)
  let path = `M${f(points[0]!.x)},${f(points[0]!.y)}`
  for (let i = 0; i < n - 1; i++) {
    const third = dx[i]! / 3
    const p = points[i]!
    const q = points[i + 1]!
    path +=
      `C${f(p.x + third)},${f(p.y + tangent[i]! * third)} ` +
      `${f(q.x - third)},${f(q.y - tangent[i + 1]! * third)} ${f(q.x)},${f(q.y)}`
  }
  return path
}

const TOP = 20
const BOTTOM = 50

/** Space per month: max(76px, value label width, min(170px, width / 4.2)). */
export function slotWidth(width: number, labels: readonly string[]): number {
  const longest = Math.max(0, ...labels.map((label) => label.length))
  return Math.round(
    Math.max(76, longest * 7.3 + 18, Math.min(170, width / 4.2)),
  )
}

/** Plot height grows with the width: clamp(170px, width × 0.5, 280px). */
export const plotHeight = (width: number) =>
  Math.round(Math.min(280, Math.max(170, width * 0.5)))

export interface ChartLayout {
  readonly width: number
  readonly slot: number
  readonly svgWidth: number
  readonly svgHeight: number
  readonly base: number
  readonly plot: number
  readonly points: readonly Point[]
  readonly labels: readonly string[]
  readonly line: string
  readonly area: string
  /** Solid line up to here; dashed (forecast) after. */
  readonly cutX: number
  readonly grid: readonly number[]
}

/**
 * The strip: half a screen of margin on each side, so the first and last month
 * can also sit in the centre. Month i is centred when scrollLeft = i × slot.
 */
export function chartLayout(
  points: readonly ChartPoint[],
  width: number,
  current: Month,
): ChartLayout {
  const safeWidth = Math.max(260, width)
  const labels = points.map((point) => formatMoney(point.total))
  const slot = slotWidth(safeWidth, labels)
  const plot = plotHeight(safeWidth)
  const base = TOP + plot
  const max = Math.max(1, ...points.map((point) => point.total)) * 1.08
  const x = (index: number) => safeWidth / 2 + index * slot
  const y = (value: number) => base - (value / max) * plot
  const coords = points.map((point, index) => ({
    x: x(index),
    y: y(point.total),
  }))
  const line = monotonePath(coords)
  const first = coords[0]
  const last = coords[coords.length - 1]
  let solidUntil = -1
  points.forEach((point, index) => {
    if (
      point.kind === 'real' ||
      (point.kind === 'empty' && point.month <= current)
    )
      solidUntil = index
  })
  return {
    width: safeWidth,
    slot,
    svgWidth: Math.round(safeWidth + (points.length - 1) * slot),
    svgHeight: TOP + plot + BOTTOM,
    base,
    plot,
    points: coords,
    labels,
    line,
    area:
      line && first && last
        ? `${line}L${last.x.toFixed(1)},${base}L${first.x.toFixed(1)},${base}Z`
        : '',
    cutX: solidUntil < 0 ? safeWidth / 2 - 1 : x(solidUntil),
    grid: [0.5, 1].map((share) => base - (plot * share) / 1.08),
  }
}

/** Index of the month closest to the centre for a given scroll position. */
export function nearestIndex(scrollLeft: number, slot: number, count: number) {
  return Math.max(0, Math.min(count - 1, Math.round(scrollLeft / slot)))
}
