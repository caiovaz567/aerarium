import { describe, expect, it } from 'vitest'
import { emptyData, invoice, plan } from './__fixtures__/seed'
import {
  chartAverage,
  chartComparison,
  chartSeries,
  type ChartPoint,
} from './chartSeries'
import { cents } from './money'
import { isoDate, month } from './months'

const point = (
  ref: string,
  total: number,
  kind: ChartPoint['kind'] = 'real',
): ChartPoint => ({
  month: month(ref),
  total: cents(total),
  kind,
  paid: false,
  invoiceId: null,
})

describe('série do gráfico', () => {
  it('mantém seis meses vazios de cada lado e o atual, todos no zero', () => {
    const series = chartSeries('card', month('2026-09'), emptyData())
    expect(series).toHaveLength(13)
    expect(series[0]?.month).toBe('2026-03')
    expect(series[12]?.month).toBe('2027-03')
    expect(
      series.every((item) => item.kind === 'empty' && item.total === 0),
    ).toBe(true)
    expect(chartAverage(series, month('2026-09'))).toBeNull()
    expect(chartComparison(series, month('2026-09'))).toBeNull()
  })
  it('projeta parcelas fixas + assinaturas somente do cartão e limita horizonte', () => {
    const data = emptyData({
      plans: [
        plan({ totalInstallments: 120 }),
        plan({ cardId: null, id: 'outside' }),
      ],
      subscriptions: [
        { id: 's', cardId: 'card', active: true, amount: cents(2000) },
      ],
    })
    const series = chartSeries('card', month('2026-09'), data)
    expect(series[series.length - 1]?.month).toBe('2027-09')
    expect(series.find((item) => item.month === '2026-09')).toMatchObject({
      kind: 'forecast',
      total: 12000,
    })
    expect(series.find((item) => item.month === '2026-08')).toMatchObject({
      kind: 'empty',
      total: 0,
    })
  })
  it('distingue real zero, estimada, paga congelada e ausência; preserva histórico', () => {
    const data = emptyData({
      invoices: [
        invoice({ id: 'old', month: month('2025-12'), estimated: false }),
        invoice({
          id: 'estimated',
          month: month('2026-08'),
          otherAmount: cents(1200),
        }),
        invoice({
          id: 'paid',
          month: month('2026-09'),
          paid: true,
          paidOn: isoDate('2026-09-01'),
          closedTotal: cents(1500),
          otherAmount: cents(2000),
        }),
        invoice({
          id: 'future',
          month: month('2027-06'),
          estimated: false,
          otherAmount: cents(3000),
        }),
        invoice({
          id: 'other',
          cardId: 'other',
          month: month('2026-09'),
          otherAmount: cents(9999),
        }),
      ],
    })
    const series = chartSeries('card', month('2026-09'), data)
    expect(series[0]).toMatchObject({
      month: '2025-12',
      kind: 'real',
      total: 0,
    })
    expect(series.find((item) => item.month === '2026-08')).toMatchObject({
      kind: 'forecast',
    })
    expect(series.find((item) => item.month === '2026-09')).toMatchObject({
      kind: 'real',
      total: 1500,
      paid: true,
    })
    expect(series[series.length - 1]?.month).toBe('2027-06')
    expect(chartAverage(series, month('2026-09'))).toEqual({
      amount: 750,
      count: 2,
    })
  })
  it('média usa as seis últimas reais até o mês atual, ignorando lacunas e previsões', () => {
    const points = [
      point('2026-01', 9999),
      point('2026-02', 100),
      point('2026-03', 200),
      point('2026-04', 300),
      point('2026-05', 400),
      point('2026-06', 500),
      point('2026-07', 601),
      point('2026-08', 99999, 'forecast'),
      point('2026-09', 0, 'empty'),
      point('2026-10', 99999),
    ]
    const before = [...points]
    expect(chartAverage(points.reverse(), month('2026-09'))).toEqual({
      amount: 350,
      count: 6,
    })
    expect(points).toEqual(before.reverse())
    expect(chartAverage([point('2026-09', 10)], month('2026-09'))).toBeNull()
  })
  it.each([
    [10000, 8000, 'down', -2000, 20],
    [10000, 12000, 'up', 2000, 20],
    [10000, 10000, 'equal', 0, 0],
    [0, 100, 'up', 100, null],
  ])(
    'compara %i com %i',
    (before, after, direction, difference, percentage) => {
      expect(
        chartComparison(
          [point('2026-08', before), point('2026-09', after, 'forecast')],
          month('2026-09'),
        ),
      ).toEqual({ previousMonth: '2026-08', difference, direction, percentage })
    },
  )
  it('não pula lacunas para comparar com um mês distante', () => {
    expect(
      chartComparison(
        [point('2026-07', 100), point('2026-09', 200)],
        month('2026-09'),
      ),
    ).toBeNull()
    expect(chartComparison([], month('2026-09'))).toBeNull()
    expect(
      chartComparison(
        [point('2026-08', 100), point('2026-09', 0, 'empty')],
        month('2026-09'),
      ),
    ).toBeNull()
  })
  it('recusa faturas duplicadas', () =>
    expect(() =>
      chartSeries(
        'card',
        month('2026-09'),
        emptyData({ invoices: [invoice(), invoice()] }),
      ),
    ).toThrow())
})
