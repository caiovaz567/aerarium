declare const centsBrand: unique symbol
export type Cents = number & { readonly [centsBrand]: true }

export function cents(value: number): Cents {
  if (!Number.isSafeInteger(value))
    throw new RangeError(
      'O valor deve ser um número inteiro de centavos seguro.',
    )
  return (value === 0 ? 0 : value) as Cents
}

export function nonNegative(value: Cents): Cents {
  cents(value)
  if (value < 0) throw new RangeError('O valor não pode ser negativo.')
  return value
}

/** Decimal database strings, never binary floating point reais. */
export function fromDecimal(value: string): Cents {
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(value))
    throw new RangeError('Valor decimal inválido.')
  const [whole = '', fraction = ''] = value.replace(/^-/, '').split('.')
  const amount = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
  return cents(Number(value.startsWith('-') ? -amount : amount))
}

export function toDecimal(value: Cents): string {
  const amount = BigInt(cents(value))
  const absolute = amount < 0n ? -amount : amount
  return `${amount < 0n ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`
}

/** Empty is missing input, not zero. Brazilian grouping or decimal point accepted. */
export function parseMoney(input: string, allowNegative = false): Cents | null {
  // "12," is someone about to type cents: read it as 12.
  const value = input
    .trim()
    .replace(/^R\$\s*/, '')
    .replace(/,$/, '')
  if (!value) return null
  let normalized: string
  if (/^-?[1-9]\d{0,2}(?:\.\d{3})+(?:,\d{1,2})?$/.test(value)) {
    normalized = value.replaceAll('.', '').replace(',', '.')
  } else if (/^-?\d+(?:[,.]\d{1,2})?$/.test(value)) {
    normalized = value.replace(',', '.')
  } else {
    throw new RangeError('Informe um valor válido com até duas casas decimais.')
  }
  const result = fromDecimal(normalized)
  return allowNegative ? result : nonNegative(result)
}

export function sumMoney(values: readonly Cents[]): Cents {
  return cents(
    Number(values.reduce((sum, value) => sum + BigInt(cents(value)), 0n)),
  )
}

/** Integer division rounded to nearest cent; half a cent rounds away from zero. */
export function divideMoney(value: Cents, divisor: number): Cents {
  if (!Number.isSafeInteger(divisor) || divisor <= 0)
    throw new RangeError('Divisor inválido.')
  const amount = BigInt(cents(value))
  const absolute = amount < 0n ? -amount : amount
  const denominator = BigInt(divisor)
  const rounded =
    absolute / denominator +
    (2n * (absolute % denominator) >= denominator ? 1n : 0n)
  return cents(Number(amount < 0n ? -rounded : rounded))
}

const fullFormat = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function formatMoney(value: Cents): string {
  const decimal = toDecimal(value)
  const [whole = '0', fraction] = decimal.split('.')
  // BigInt preserves cents even near Number.MAX_SAFE_INTEGER. -0 keeps the sign.
  const integer = whole === '-0' ? -0 : BigInt(whole)
  return fullFormat
    .formatToParts(integer)
    .map((part) => (part.type === 'fraction' ? fraction : part.value))
    .join('')
}

/**
 * Typing an amount like a bank app: only digits, filling from the cents, so
 * there is no comma to type. "2" → "0,02", "2390" → "23,90", "123456" →
 * "1.234,56"; deleting takes off the last digit. Up to 12 digits; where it may
 * be negative, a minus sign anywhere makes it so.
 */
export function maskMoneyInput(input: string, allowNegative = false): string {
  const sign = allowNegative && input.includes('-') ? '-' : ''
  const digits = input.replace(/\D/g, '').replace(/^0+/, '').slice(0, 12)
  if (!digits) return sign
  const padded = digits.padStart(3, '0')
  const whole = padded.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${sign}${whole},${padded.slice(-2)}`
}

export function formatMoneyInput(value: Cents): string {
  return toDecimal(value).replace('.', ',')
}
