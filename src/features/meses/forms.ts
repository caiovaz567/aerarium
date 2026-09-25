import { parseMoney, type Cents } from '../../domain/money'

/** Reads a typed amount; returns the error text instead of throwing. */
export function readMoney(
  text: string,
  allowNegative = false,
): { amount: Cents } | { error: string } {
  try {
    const amount = parseMoney(text, allowNegative)
    return amount === null ? { error: 'Coloca um valor.' } : { amount }
  } catch {
    return { error: 'Esse valor não deu certo. Exemplo: 1.147,29' }
  }
}
