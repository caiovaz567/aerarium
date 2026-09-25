// Card colors (seção 7.3 do plano), same rules as v1. Never a bank logo, only a color.

const BRAND: readonly (readonly [RegExp, string])[] = [
  [/nu ?bank|^nu\b/, '#820AD1'],
  [/itau/, '#EC7000'],
  [/santander/, '#CC0000'],
  [/mercado ?pago/, '#009EE3'],
  [/picpay/, '#11C76F'],
  [/smiles/, '#F26722'],
  [/revolut/, '#191C1F'],
  [/\binter\b/, '#FF7A00'],
  [/\bc6\b/, '#2B2B2B'],
  [/bradesco/, '#CC092F'],
  [/caixa/, '#005CA9'],
  [/banco do brasil|\bbb\b|ourocard/, '#F5C400'],
  [/\bxp\b/, '#111111'],
  [/btg/, '#0B2D5B'],
  [/neon/, '#00A5D8'],
  [/\bpan\b/, '#00AEEF'],
  [/will/, '#FFD500'],
  [/\bnext\b/, '#00C96B'],
]

export const CARD_PALETTE = [
  '#3140C2',
  '#820AD1',
  '#CC0000',
  '#EC7000',
  '#F5C400',
  '#11C76F',
  '#009EE3',
  '#191C1F',
  '#6B7280',
  '#D6336C',
] as const

const plain = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

/** Bank color when the name mentions one; otherwise a palette color by hash. */
export function autoColor(name: string): string {
  const text = plain(name)
  for (const [pattern, color] of BRAND) if (pattern.test(text)) return color
  let hash = 0
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return CARD_PALETTE[hash % CARD_PALETTE.length]!
}

export function cardColor(card: {
  readonly name: string
  readonly color: string | null
}): string {
  return card.color ?? autoColor(card.name)
}

/** Dark text on light colors (luminance above 0.62), white otherwise. */
export function inkFor(hex: string): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!match) return '#FFFFFF'
  const value = parseInt(match[1]!, 16)
  const luminance =
    (0.299 * ((value >> 16) & 255) +
      0.587 * ((value >> 8) & 255) +
      0.114 * (value & 255)) /
    255
  return luminance > 0.62 ? '#161A26' : '#FFFFFF'
}
