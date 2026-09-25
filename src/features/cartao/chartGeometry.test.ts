import { describe, expect, it } from 'vitest'
import type { ChartPoint } from '../../domain/chartSeries'
import { cents } from '../../domain/money'
import { month, monthRange } from '../../domain/months'
import {
  chartLayout,
  monotonePath,
  nearestIndex,
  plotHeight,
  slotWidth,
} from './chartGeometry'

const numbers = (path: string) =>
  path.replace(/[MC]/g, ' ').trim().split(/[ ,]+/).map(Number)

describe('curva monotônica', () => {
  it('não passa acima nem abaixo dos pontos vizinhos', () => {
    const points = [
      { x: 0, y: 100 },
      { x: 10, y: 20 },
      { x: 20, y: 25 },
      { x: 30, y: 90 },
      { x: 40, y: 90 },
    ]
    const values = numbers(monotonePath(points))
    // Every segment is: start, then triples (control 1, control 2, end).
    for (let i = 0; i < points.length - 1; i++) {
      const low = Math.min(points[i]!.y, points[i + 1]!.y)
      const high = Math.max(points[i]!.y, points[i + 1]!.y)
      const controls = values.slice(2 + i * 6, 2 + i * 6 + 4)
      expect(controls[1]).toBeGreaterThanOrEqual(low - 0.05)
      expect(controls[1]).toBeLessThanOrEqual(high + 0.05)
      expect(controls[3]).toBeGreaterThanOrEqual(low - 0.05)
      expect(controls[3]).toBeLessThanOrEqual(high + 0.05)
    }
  })

  it('com menos de dois pontos não desenha nada', () => {
    expect(monotonePath([{ x: 1, y: 1 }])).toBe('')
  })
})

describe('medidas', () => {
  it('espaço por mês segue max(76, rótulo, min(170, largura / 4,2))', () => {
    expect(slotWidth(320, ['R$ 0'])).toBe(76)
    expect(slotWidth(390, ['R$ 1.147'])).toBe(93)
    expect(slotWidth(1000, ['R$ 1'])).toBe(170)
    expect(slotWidth(320, ['R$ 12.345.678'])).toBe(113)
  })

  it('altura entre 170 e 280, metade da largura', () => {
    expect(plotHeight(300)).toBe(170)
    expect(plotHeight(400)).toBe(200)
    expect(plotHeight(800)).toBe(280)
  })

  it('mês i fica no centro quando a rolagem é i × espaço', () => {
    expect(nearestIndex(0, 90, 13)).toBe(0)
    expect(nearestIndex(90 * 6 + 40, 90, 13)).toBe(6)
    expect(nearestIndex(90 * 6 + 50, 90, 13)).toBe(7)
    expect(nearestIndex(99999, 90, 13)).toBe(12)
    expect(nearestIndex(-50, 90, 13)).toBe(0)
  })
})

describe('faixa do gráfico', () => {
  const months = monthRange(month('2026-03'), month('2027-03'))
  const points: ChartPoint[] = months.map((ref, index) => ({
    month: ref,
    total: cents(index < 3 ? 0 : 50000 + index * 1000),
    kind: index < 3 ? 'empty' : index <= 6 ? 'real' : 'forecast',
    paid: false,
    invoiceId: null,
  }))
  const layout = chartLayout(points, 390, month('2026-09'))

  it('meia tela de margem de cada lado', () => {
    expect(layout.points[0]!.x).toBe(195)
    expect(layout.svgWidth).toBe(390 + 12 * layout.slot)
    expect(layout.points[12]!.x).toBe(layout.svgWidth - 195)
  })

  it('linha cheia até a última fatura real, tracejada depois', () => {
    expect(layout.cutX).toBe(layout.points[6]!.x)
  })

  it('meses vazios ficam no chão, e o maior valor abaixo do topo', () => {
    expect(layout.points[0]!.y).toBe(layout.base)
    const top = Math.min(...layout.points.map((point) => point.y))
    expect(top).toBeGreaterThan(20)
    expect(layout.labels[0]!.replace(/\s/g, ' ')).toBe('R$ 0')
  })
})
