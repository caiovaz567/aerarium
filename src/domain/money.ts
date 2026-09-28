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
const shortFormat = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
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

export function formatMoneyShort(value: Cents): string {
  return shortFormat.format(BigInt(divideMoney(value, 100)))
}

/**
 * Typing an amount left to right (the user's choice): thousands dots appear by
 * themselves and a comma starts the cents. "1250" → "1.250", "1250,5" →
 * "1.250,5". The dots in the field are always ours, so a dot typed at the end
 * means a comma. Up to 10 whole digits and 2 of cents; letters never stay.
 */
export function maskMoneyInput(input: string, allowNegative = false): string {
  const negative = allowNegative && input.trim().startsWith('-')
  const text = input.includes(',') ? input : input.replace(/\.$/, ',')
  const [before = '', ...after] = text.split(',')
  const whole = before
    .replace(/\D/g, '')
    .replace(/^0+(?=\d)/, '')
    .slice(0, 10)
  const sign = negative ? '-' : ''
  if (!whole && !after.length) return sign
  const grouped = (whole || '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  if (!after.length) return `${sign}${grouped}`
  return `${sign}${grouped},${after.join('').replace(/\D/g, '').slice(0, 2)}`
}

export function formatMoneyInput(value: Cents): string {
  return toDecimal(value).replace('.', ',')
}
