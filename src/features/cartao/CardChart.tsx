import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ChartPoint } from '../../domain/chartSeries'
import { monthShort, type Month } from '../../domain/months'
import { chartLayout, nearestIndex } from './chartGeometry'

const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Invoice total per month (seção 8.4). The selected month is always in the
 * centre: tapping glides to it, dragging snaps to the nearest month ~120 ms
 * after scrolling stops, and a width change redraws keeping it centred.
 */
export function CardChart({
  points,
  selected,
  current,
  onSelect,
}: {
  readonly points: readonly ChartPoint[]
  readonly selected: Month
  readonly current: Month
  readonly onSelect: (month: Month) => void
}) {
  const strip = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [reveal, setReveal] = useState<number | null>(null)
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const layout = useMemo(
    () => (width ? chartLayout(points, width, current) : null),
    [points, width, current],
  )
  const index = points.findIndex((point) => point.month === selected)

  useLayoutEffect(() => {
    const node = strip.current!
    const measure = () => setWidth(node.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  // First draw and every width change: put the selected month in the centre at once.
  const slot = layout?.slot
  const selectedIndex = useRef(index)
  useLayoutEffect(() => {
    selectedIndex.current = index
  }, [index])
  useLayoutEffect(() => {
    if (slot) strip.current!.scrollLeft = selectedIndex.current * slot
  }, [slot, width])

  // A new selection glides to the centre. While gliding, the drag snap waits,
  // or a slow first frame would snap back to where the glide started.
  const glide = useRef<{ target: number; until: number } | null>(null)
  useEffect(() => {
    if (!slot) return
    const node = strip.current!
    const target = index * slot
    if (Math.abs(node.scrollLeft - target) > 1) {
      glide.current = { target, until: performance.now() + 1500 }
      node.scrollTo({
        left: target,
        behavior: reducedMotion() ? 'auto' : 'smooth',
      })
    }
  }, [index, slot])

  // The line draws itself from left to right once, unless motion is reduced.
  const drawn = useRef(false)
  useEffect(() => {
    if (!layout || drawn.current) return
    drawn.current = true
    if (reducedMotion()) return
    const start = performance.now()
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - start) / 900)
      setReveal(t < 1 ? 1 - (1 - t) ** 3 : null)
      if (t < 1) frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
  }, [layout])

  // Dragging: after the scroll settles, the month nearest the centre is selected.
  // The snap runs later, so it reads the measures of that moment, not of the
  // render that saw the scroll (rotating the phone changes them in between).
  const live = useRef({ slot, points, index, onSelect })
  useLayoutEffect(() => {
    live.current = { slot, points, index, onSelect }
  })
  const timer = useRef(0)
  const onScroll = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const node = strip.current
      const now = live.current
      if (!node || !now.slot) return
      const gliding = glide.current
      if (gliding) {
        const arrived = Math.abs(node.scrollLeft - gliding.target) <= 1
        if (!arrived && performance.now() < gliding.until) return onScroll()
        glide.current = null
      }
      const nearest = nearestIndex(node.scrollLeft, now.slot, now.points.length)
      if (nearest !== now.index) now.onSelect(now.points[nearest]!.month)
      else if (Math.abs(node.scrollLeft - nearest * now.slot) > 1)
        node.scrollTo({
          left: nearest * now.slot,
          behavior: reducedMotion() ? 'auto' : 'smooth',
        })
    }, 120)
  }
  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    // Focusable so the strip can be scrolled from the keyboard; the arrows
    // themselves are handled by CardPage.
    <div
      className="chart-strip"
      ref={strip}
      onScroll={onScroll}
      tabIndex={0}
      role="group"
      aria-label="Meses do gráfico. As setas trocam de mês."
    >
      {layout && (
        <svg
          width={layout.svgWidth}
          height={layout.svgHeight}
          viewBox={`0 0 ${layout.svgWidth} ${layout.svgHeight}`}
          role="img"
          aria-label="Fatura por mês"
        >
          <defs>
            <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--accent)" stopOpacity=".38" />
              <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
            <clipPath id={`${id}r`}>
              <rect
                x="0"
                y="0"
                width={layout.svgWidth * (reveal ?? 1)}
                height={layout.svgHeight}
              />
            </clipPath>
            <clipPath id={`${id}s`}>
              <rect
                x="0"
                y="0"
                width={Math.max(0, layout.cutX)}
                height={layout.svgHeight}
              />
            </clipPath>
            <clipPath id={`${id}f`}>
              <rect
                x={Math.max(0, layout.cutX)}
                y="0"
                width={layout.svgWidth}
                height={layout.svgHeight}
              />
            </clipPath>
          </defs>
          {layout.grid.map((y) => (
            <line
              key={y}
              x1="0"
              x2={layout.svgWidth}
              y1={y}
              y2={y}
              className="grid"
            />
          ))}
          <line
            x1="0"
            x2={layout.svgWidth}
            y1={layout.base}
            y2={layout.base}
            className="baseline"
          />
          {index >= 0 && (
            <line
              x1={layout.points[index]!.x}
              x2={layout.points[index]!.x}
              y1={layout.points[index]!.y + 8}
              y2={layout.base}
              className="focus-line"
            />
          )}
          <g clipPath={`url(#${id}r)`}>
            {layout.area && (
              <>
                <path
                  d={layout.area}
                  fill={`url(#${id}g)`}
                  clipPath={`url(#${id}s)`}
                />
                <path
                  d={layout.area}
                  fill={`url(#${id}g)`}
                  opacity=".45"
                  clipPath={`url(#${id}f)`}
                />
                <path
                  d={layout.line}
                  className="line"
                  clipPath={`url(#${id}s)`}
                />
                <path
                  d={layout.line}
                  className="line forecast"
                  clipPath={`url(#${id}f)`}
                />
              </>
            )}
            {layout.points.map((point, i) =>
              i === index ? null : points[i]!.kind === 'empty' ? (
                <circle
                  key={i}
                  cx={point.x}
                  cy={point.y}
                  r="3"
                  className="dot empty"
                />
              ) : (
                <circle
                  key={i}
                  cx={point.x}
                  cy={point.y}
                  r="3.6"
                  className={`dot${points[i]!.kind === 'forecast' ? ' forecast' : ''}`}
                />
              ),
            )}
          </g>
          {index >= 0 && (
            <>
              <circle
                cx={layout.points[index]!.x}
                cy={layout.points[index]!.y}
                r="11"
                className="halo"
              />
              <circle
                cx={layout.points[index]!.x}
                cy={layout.points[index]!.y}
                r="6"
                className="dot selected"
              />
            </>
          )}
          {points.map((point, i) => {
            const x = layout.points[i]!.x
            const on = i === index ? ' on' : ''
            return (
              <g key={point.month}>
                <text
                  x={x}
                  y={layout.svgHeight - 29}
                  textAnchor="middle"
                  className={`month-label${on}${point.kind === 'forecast' ? ' forecast' : ''}`}
                >
                  {monthShort(point.month)}
                </text>
                {point.month === current && (
                  <circle cx={x} cy={layout.base + 7} r="2.5" className="now" />
                )}
                <text
                  x={x}
                  y={layout.svgHeight - 8}
                  textAnchor="middle"
                  className={`value-label${on}${point.kind === 'empty' ? ' empty' : ''}`}
                >
                  {layout.labels[i]}
                </text>
                <rect
                  x={Math.max(0, x - layout.slot / 2)}
                  y="0"
                  width={layout.slot}
                  height={layout.svgHeight}
                  className="hit"
                  data-month={point.month}
                  onClick={() => onSelect(point.month)}
                />
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}
