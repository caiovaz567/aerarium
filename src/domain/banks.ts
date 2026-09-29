import { normalizeText } from './categories'

// Fase 13.1: banks with a logo (public/banks/KEY.png, drawn by
// scripts/make-bank-logos.mjs). A card without a chosen bank gets one guessed
// from its name; "none" means the person chose no logo.

export const BANKS = [
  { key: 'nubank', name: 'Nubank', words: ['nubank', 'nu'] },
  { key: 'itau', name: 'Itaú', words: ['itau', 'personnalite'] },
  { key: 'santander', name: 'Santander', words: ['santander'] },
  { key: 'bradesco', name: 'Bradesco', words: ['bradesco'] },
  {
    key: 'bb',
    name: 'Banco do Brasil',
    words: ['bb', 'banco do brasil', 'ourocard', 'smiles'],
  },
  { key: 'caixa', name: 'Caixa', words: ['caixa'] },
  { key: 'inter', name: 'Inter', words: ['inter'] },
  {
    key: 'mercadopago',
    name: 'Mercado Pago',
    words: ['mercado pago', 'mercadopago', 'mp'],
  },
  { key: 'c6', name: 'C6 Bank', words: ['c6'] },
  { key: 'btg', name: 'BTG Pactual', words: ['btg'] },
  { key: 'picpay', name: 'PicPay', words: ['picpay'] },
  { key: 'digio', name: 'Digio', words: ['digio'] },
  { key: 'revolut', name: 'Revolut', words: ['revolut'] },
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
