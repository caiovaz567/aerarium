import { describe, expect, it } from 'vitest'
import {
  dayMonth,
  addMonths,
  dateInSaoPaulo,
  daysInMonth,
  isoDate,
  month,
  monthLabel,
  monthName,
  monthOf,
  monthRange,
  monthShort,
  monthStart,
  monthsBetween,
} from './months'

describe('meses e datas civis', () => {
  it('atravessa anos nos dois sentidos', () => {
    expect(addMonths(month('2026-09'), 9)).toBe('2027-06')
    expect(addMonths(month('2026-01'), -1)).toBe('2025-12')
    expect(monthsBetween(month('2026-09'), month('2027-06'))).toBe(9)
    expect(monthsBetween(month('2027-06'), month('2026-09'))).toBe(-9)
    expect(monthRange(month('2026-12'), month('2027-02'))).toEqual([
      '2026-12',
      '2027-01',
      '2027-02',
    ])
  })
  it.each(['2026-00', '2026-13', '26-09', '2026-9', '0000-01', '2026-09-01'])(
    'recusa mês %s',
    (value) => expect(() => month(value)).toThrow(),
  )
  it.each([
    '2026-02-29',
    '2026-04-31',
    '2026-00-01',
    '0000-01-01',
    '2026-9-1',
    '2026-09-01T00:00:00Z',
  ])('recusa data %s', (value) => expect(() => isoDate(value)).toThrow())
  it('respeita anos bissextos', () => {
    expect(isoDate('2028-02-29')).toBe('2028-02-29')
    expect(daysInMonth(month('2028-02'))).toBe(29)
    expect(daysInMonth(month('2100-02'))).toBe(28)
    expect(monthOf(isoDate('2026-09-30'))).toBe('2026-09')
    expect(monthStart(month('2026-09'))).toBe('2026-09-01')
  })
  it('formata os rótulos da referência', () => {
    expect(monthLabel(month('2026-09'))).toBe('Setembro 2026')
    expect(monthName(month('2026-03'))).toBe('Março')
    expect(monthShort(month('2026-09'))).toBe('set')
    expect(monthShort(month('2027-01'))).toBe('jan/27')
    expect(dayMonth(isoDate('2026-09-23'))).toBe('23/09')
  })
  it('usa São Paulo na virada de dia em UTC', () => {
    expect(dateInSaoPaulo(new Date('2027-01-01T02:59:59Z'))).toBe('2026-12-31')
    expect(dateInSaoPaulo(new Date('2027-01-01T03:00:00Z'))).toBe('2027-01-01')
    expect(() => dateInSaoPaulo(new Date(NaN))).toThrow()
  })
  it('recusa intervalos invertidos, fracionários ou fora dos anos suportados', () => {
    expect(() => monthRange(month('2026-09'), month('2026-08'))).toThrow()
    expect(() => addMonths(month('2026-09'), 1.5)).toThrow()
    expect(() => addMonths(month('9999-12'), 1)).toThrow()
  })
})
