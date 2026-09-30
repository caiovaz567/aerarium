import { normalizeText } from './categories'

// Fase 13.1: banks with a logo (public/banks/KEY.png, drawn by
// scripts/make-bank-logos.mjs). A card without a chosen bank gets one guessed
// from its name; "none" means the person chose no logo.

export const BANKS = [
  { key: 'nubank', name: 'Nubank', color: '#820AD1', words: ['nubank', 'nu'] },
  {
    key: 'itau',
    name: 'Itaú',
    color: '#EC7000',
    words: ['itau', 'personnalite'],
  },
  {
    key: 'santander',
    name: 'Santander',
    color: '#CC0000',
    words: ['santander'],
  },
  { key: 'bradesco', name: 'Bradesco', color: '#CC092F', words: ['bradesco'] },
  {
    key: 'bb',
    name: 'Banco do Brasil',
    color: '#F5C400',
    words: ['bb', 'banco do brasil', 'ourocard', 'smiles'],
  },
  { key: 'caixa', name: 'Caixa', color: '#005CA9', words: ['caixa'] },
  { key: 'inter', name: 'Inter', color: '#FF7A00', words: ['inter'] },
  {
    key: 'mercadopago',
    name: 'Mercado Pago',
    color: '#009EE3',
    words: ['mercado pago', 'mercadopago', 'mp'],
  },
  { key: 'c6', name: 'C6 Bank', color: '#2B2B2B', words: ['c6'] },
  { key: 'btg', name: 'BTG Pactual', color: '#0B2D5B', words: ['btg'] },
  { key: 'picpay', name: 'PicPay', color: '#11C76F', words: ['picpay'] },
  { key: 'digio', name: 'Digio', color: '#202E55', words: ['digio'] },
  { key: 'revolut', name: 'Revolut', color: '#191C1F', words: ['revolut'] },
] as const

export type BankKey = (typeof BANKS)[number]['key']
export const NO_BANK = 'none'

export function isBankKey(value: string | null | undefined): value is BankKey {
  return BANKS.some((bank) => bank.key === value)
}

/** The bank a card name points to: "Smiles BB" → bb, "Nubank Ultravioleta" → nubank. */
export function guessBank(cardName: string): BankKey | null {
  const text = ` ${normalizeText(cardName)} `
  const found = BANKS.find((bank) =>
    bank.words.some((word) => text.includes(` ${word} `)),
  )
  return found?.key ?? null
}

/** The logo a card shows: the chosen bank, or a guess when none was chosen. */
export function cardBank(card: {
  readonly name: string
  readonly bank?: string | null
}): BankKey | null {
  if (card.bank === NO_BANK) return null
  return isBankKey(card.bank) ? card.bank : guessBank(card.name)
}

/** "Final 5580" from what the bank calls the card number. */
export function cardFinal(number: string | null | undefined): string | null {
  const digits = (number ?? '').replace(/\D/g, '').slice(-4)
  return digits.length === 4 ? digits : null
}

export function bankName(key: BankKey): string {
  return BANKS.find((bank) => bank.key === key)!.name
}

/** The bank's own color: a card with a bank takes it (the user's choice). */
export function bankColor(key: BankKey): string {
  return BANKS.find((bank) => bank.key === key)!.color
}

/** A Pix, boleto or cash payment: from a bank (its key) or from cash. */
export const CASH = 'cash'

/** "Santander", "Dinheiro", or null when it was not said (or is unknown). */
export function paidFromName(key: string | null | undefined): string | null {
  if (key === CASH) return 'Dinheiro'
  return isBankKey(key) ? bankName(key) : null
}

/**
 * The banks offered first for "Saiu de": the person's cards' banks, in their
 * order, then the one already chosen when it is another bank.
 */
export function paidFromBanks(
  cards: readonly { readonly name: string; readonly bank?: string | null }[],
  chosen: string | null | undefined,
): BankKey[] {
  const keys = cards.flatMap((card) => cardBank(card) ?? [])
  if (isBankKey(chosen)) keys.push(chosen)
  return [...new Set(keys)]
}
