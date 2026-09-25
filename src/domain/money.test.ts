import { describe, expect, it } from 'vitest'
import {
  cents,
  divideMoney,
  formatMoney,
  formatMoneyInput,
  formatMoneyShort,
  fromDecimal,
  nonNegative,
  parseMoney,
  sumMoney,
  toDecimal,
} from './money'

describe('dinheiro em centavos', () => {
  it.each([
    ['12', 1200],
    ['12,5', 1250],
    ['1.147,29', 114729],
    ['1147.29', 114729],
    ['R$ 1.147,29', 114729],
    ['1.147', 114700],
    ['0,01', 1],
    ['000,00', 0],
    ['9999999999,99', 999999999999],
  ])('lê %s sem arredondar', (input, expected) => {
    expect(parseMoney(input)).toBe(expected)
  })
  it.each(['', ' ', 'R$ '])('distingue entrada vazia %s de zero', (value) =>
    expect(parseMoney(value)).toBeNull(),
  )
  it.each([
    '1,234',
    '1,147.29',
    '1.14,29',
    '1e3',
    'Infinity',
    'NaN',
    '--1',
    'R$ 1 000',
    '12abc',
    '12,',
    '0.001',
    '-0,01',
  ])('recusa entrada inválida %s', (value) =>
    expect(() => parseMoney(value)).toThrow(),
  )
  it('aceita negativo explicitamente para déficit', () =>
    expect(parseMoney('-1.147,29', true)).toBe(-114729))
  it('0,1 + 0,2 = 0,30 exatos', () =>
    expect(sumMoney([fromDecimal('0.1'), fromDecimal('0.2')])).toBe(30))
  it.each(['12.345', 'NaN', '1e2', '1,20', '', '90071992547409.92'])(
    'recusa decimal de banco inválido %s',
    (value) => expect(() => fromDecimal(value)).toThrow(),
  )
  it.each([NaN, Infinity, 0.1, Number.MAX_SAFE_INTEGER + 1])(
    'recusa centavos inválidos %s',
    (value) => expect(() => cents(value)).toThrow(),
  )
  it('normaliza menos zero e preserva precisão no limite seguro', () => {
    expect(Object.is(cents(-0), -0)).toBe(false)
    expect(toDecimal(cents(Number.MAX_SAFE_INTEGER))).toBe('90071992547409.91')
    expect(fromDecimal('-90071992547409.91')).toBe(-Number.MAX_SAFE_INTEGER)
    expect(
      sumMoney([cents(Number.MAX_SAFE_INTEGER), cents(1), cents(-1)]),
    ).toBe(Number.MAX_SAFE_INTEGER)
    expect(() => sumMoney([cents(Number.MAX_SAFE_INTEGER), cents(1)])).toThrow()
    expect(sumMoney([])).toBe(0)
  })
  it('formata reais completos, curtos, negativos e campos', () => {
    expect(formatMoney(cents(114729))).toBe('R$ 1.147,29')
    expect(formatMoney(cents(-1))).toBe('-R$ 0,01')
    expect(formatMoney(cents(0))).toBe('R$ 0,00')
    expect(formatMoney(cents(Number.MAX_SAFE_INTEGER))).toBe(
      'R$ 90.071.992.547.409,91',
    )
    expect(formatMoneyShort(cents(114750))).toBe('R$ 1.148')
    expect(formatMoneyShort(cents(-150))).toBe('-R$ 2')
    expect(formatMoneyInput(cents(-114729))).toBe('-1147,29')
  })
  it.each([
    [1, 2, 1],
    [-1, 2, -1],
    [10, 3, 3],
    [11, 3, 4],
    [0, 6, 0],
  ])('divide %i por %i em centavos', (amount, count, expected) =>
    expect(divideMoney(cents(amount), count)).toBe(expected),
  )
  it.each([0, -1, 1.1, Infinity])('recusa divisor %s', (divisor) =>
    expect(() => divideMoney(cents(1), divisor)).toThrow(),
  )
  it('recusa saídas negativas', () =>
    expect(() => nonNegative(cents(-1))).toThrow())
})
