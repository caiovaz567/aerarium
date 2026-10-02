import type { BankData } from '../../data/bank'
import type { Finance } from '../../data/finance'

/** A bank connection (a Pluggy "item"), as the server last said it was. */
export type BankItem = BankData['items'][number]

const KEY = 'aerarium.banco.itens'

/** The connections as of the last look at the bank, kept on this device. */
export function savedItems(): readonly BankItem[] {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown
    return Array.isArray(saved) ? (saved as BankItem[]) : []
  } catch {
    return []
  }
}
export function saveItems(items: readonly BankItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    /* private mode: shown again after the next look */
  }
}

const when = (instant: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(instant))

/** How long without news from the bank is worth a warning. */
const STALE_MS = 36 * 60 * 60 * 1000

export interface BankItemLine {
  readonly id: string
  /** The app's cards this connection feeds ("Santander Unique, Smiles BB"). */
  readonly name: string
  readonly text: string
  readonly tone: 'ok' | 'busy' | 'bad'
}

/**
 * One line per bank connection: when the bank last sent data, or what is
 * wrong. The bank sends through Pluggy, which looks at it about once a day;
 * a connection with an error stops until it is connected again.
 */
export function bankItemLines(
  finance: Finance,
  items: readonly BankItem[],
  now: Date,
): BankItemLine[] {
  return items.map((item) => {
    const accounts = finance.bankAccounts.filter(
      (account) => account.itemId === item.id,
    )
    // Only the cards that come into the app; a bank card set to "Não
    // importar" (one the person no longer has) is left out of the name.
    const used = accounts.flatMap(
      (account) =>
        finance.cards.find((card) => card.id === account.cardId)?.name ?? [],
    )
    const names = used.length ? used : accounts.map((account) => account.name)
    const name = [...new Set(names)].join(', ') || 'Banco'
    const last = item.lastUpdatedAt
    const seen = last ? `o banco mandou dados em ${when(last)}` : null
    if (item.status === 'UPDATING')
      return {
        id: item.id,
        name,
        text: 'Buscando no banco agora…',
        tone: 'busy',
      }
    if (item.status === 'LOGIN_ERROR' || item.status === 'WAITING_USER_INPUT')
      return {
        id: item.id,
        name,
        text: 'A conexão com o banco caiu. Reconecte em meu.pluggy.ai pra voltar a receber as compras.',
        tone: 'bad',
      }
    if (item.status === 'OUTDATED')
      return {
        id: item.id,
        name,
        text: `O banco não respondeu na última tentativa${seen ? `; ${seen}` : ''}.`,
        tone: 'bad',
      }
    if (!last)
      return {
        id: item.id,
        name,
        text: 'O banco ainda não mandou nada.',
        tone: 'bad',
      }
    const stale = now.getTime() - new Date(last).getTime() > STALE_MS
    return {
      id: item.id,
      name,
      text: stale
        ? `Sem novidade do banco há mais de um dia: ${seen}.`
        : `Em dia: ${seen}.`,
      tone: stale ? 'bad' : 'ok',
    }
  })
}
