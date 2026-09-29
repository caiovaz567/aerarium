import { installmentSchedule } from './installments'
import { invoiceTotals } from './invoices'
import { cents, nonNegative, sumMoney, type Cents } from './money'
import { month, type Month } from './months'
import type {
  Bill,
  FinancialData,
  InstallmentPlan,
  InvoiceExpense,
  Subscription,
} from './types'

// Fase 11: spending categories (outflows only). Pure rules; the data layer
// stores categories per person and links bills, card expenses, plans and
// subscriptions to them.

export interface Category {
  readonly id: string
  readonly name: string
  readonly color: string
  /** One of CATEGORY_ICONS, chosen by the person. */
  readonly icon: string
  readonly sortOrder: number
}

/** Drawings a category can have (the SVGs live in src/ui/CategoryIcon.tsx). */
export const CATEGORY_ICONS = [
  'food',
  'cart',
  'coffee',
  'car',
  'bus',
  'fuel',
  'plane',
  'home',
  'bolt',
  'phone',
  'heart',
  'pill',
  'dumbbell',
  'star',
  'game',
  'music',
  'tv',
  'bag',
  'shirt',
  'gift',
  'book',
  'pet',
  'repeat',
  'invest',
  'bank',
  'tools',
  'dots',
  'tag',
] as const
export type CategoryIconName = (typeof CATEGORY_ICONS)[number]
/** What each icon is called, for screen readers. */
export const CATEGORY_ICON_LABELS: Record<CategoryIconName, string> = {
  food: 'Comida',
  cart: 'Mercado',
  coffee: 'Café',
  car: 'Carro',
  bus: 'Ônibus',
  fuel: 'Combustível',
  plane: 'Viagem',
  home: 'Casa',
  bolt: 'Energia',
  phone: 'Celular',
  heart: 'Saúde',
  pill: 'Remédio',
  dumbbell: 'Academia',
  star: 'Estrela',
  game: 'Jogos',
  music: 'Música',
  tv: 'TV',
  bag: 'Compras',
  shirt: 'Roupa',
  gift: 'Presente',
  book: 'Estudo',
  pet: 'Pet',
  repeat: 'Assinatura',
  invest: 'Investimento',
  bank: 'Banco',
  tools: 'Conserto',
  dots: 'Outros',
  tag: 'Etiqueta',
}
/** Icon of a category someone creates, until they pick another. */
export const DEFAULT_ICON: CategoryIconName = 'tag'

/** The list every person starts with; they can rename, add and delete. */
export const DEFAULT_CATEGORIES: readonly {
  name: string
  color: string
  icon: CategoryIconName
}[] = [
  { name: 'Alimentação', color: '#E8590C', icon: 'food' },
  { name: 'Transporte', color: '#1C7ED6', icon: 'car' },
  { name: 'Moradia', color: '#7048E8', icon: 'home' },
  { name: 'Saúde', color: '#2B8A3E', icon: 'heart' },
  { name: 'Lazer', color: '#D6336C', icon: 'star' },
  { name: 'Compras', color: '#F59F00', icon: 'bag' },
  { name: 'Educação', color: '#0CA678', icon: 'book' },
  { name: 'Assinaturas', color: '#3140C2', icon: 'repeat' },
  { name: 'Outros', color: '#868E96', icon: 'dots' },
]

/** Colors for categories the person creates, in turn. */
export const CATEGORY_PALETTE = [
  '#E8590C',
  '#1C7ED6',
  '#7048E8',
  '#2B8A3E',
  '#D6336C',
  '#F59F00',
  '#0CA678',
  '#3140C2',
  '#AE3EC9',
  '#868E96',
] as const

/** First palette color nobody uses yet; when all are taken, around again. */
export function nextCategoryColor(used: readonly string[]) {
  const taken = new Set(used.map((item) => item.toUpperCase()))
  return (
    CATEGORY_PALETTE.find((item) => !taken.has(item)) ??
    CATEGORY_PALETTE[used.length % CATEGORY_PALETTE.length]!
  )
}

/** Lowercase, no accents, single spaces: "Almoço  iFood" → "almoco ifood". */
export function normalizeText(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Words in a description that point to a default category (normalized, whole
 * words). The longest match wins, so "mercado livre" beats "mercado".
 */
export const CATEGORY_KEYWORDS: Readonly<Record<string, readonly string[]>> = {
  Alimentação: [
    'ifood',
    'rappi',
    'restaurante',
    'mercado',
    'supermercado',
    'padaria',
    'lanche',
    'lanchonete',
    'almoco',
    'jantar',
    'pizza',
    'hamburguer',
    'burger',
    'mcdonalds',
    'mc donalds',
    'cafe',
    'acougue',
    'hortifruti',
    'feira',
    'delivery',
    'comida',
  ],
  Transporte: [
    'uber',
    '99',
    '99pop',
    'taxi',
    'onibus',
    'metro',
    'gasolina',
    'combustivel',
    'posto',
    'estacionamento',
    'pedagio',
    'sem parar',
    'ipva',
    'oficina',
    'carro',
    'moto',
  ],
  Moradia: [
    'aluguel',
    'condominio',
    'luz',
    'energia',
    'agua',
    'gas',
    'internet',
    'iptu',
    'enel',
    'sabesp',
    'cemig',
    'copel',
    'faxina',
    'diarista',
  ],
  Saúde: [
    'farmacia',
    'drogaria',
    'drogasil',
    'droga raia',
    'medico',
    'consulta',
    'dentista',
    'exame',
    'hospital',
    'plano de saude',
    'unimed',
    'amil',
    'academia',
    'smartfit',
    'psicologo',
    'terapia',
  ],
  Lazer: [
    'cinema',
    'show',
    'ingresso',
    'bar',
    'viagem',
    'hotel',
    'airbnb',
    'passeio',
    'festa',
    'steam',
    'playstation',
    'xbox',
  ],
  Compras: [
    'amazon',
    'mercado livre',
    'shopee',
    'shein',
    'magalu',
    'americanas',
    'aliexpress',
    'roupa',
    'roupas',
    'loja',
    'presente',
    'notebook',
    'iphone',
  ],
  Educação: [
    'curso',
    'faculdade',
    'escola',
    'livro',
    'livros',
    'udemy',
    'alura',
    'ingles',
  ],
  Assinaturas: [
    'netflix',
    'spotify',
    'disney',
    'prime video',
    'amazon prime',
    'hbo',
    'youtube premium',
    'icloud',
    'apple music',
    'globoplay',
    'deezer',
    'chatgpt',
    'paramount',
    'crunchyroll',
    'assinatura',
  ],
}

const KEYWORD_LIST = Object.entries(CATEGORY_KEYWORDS)
  .flatMap(([category, words]) => words.map((word) => ({ word, category })))
  .sort((a, b) => b.word.length - a.word.length)

/** Name of the default category the description points to, if any. */
export function keywordCategory(description: string): string | null {
  const text = ` ${normalizeText(description)} `
  return (
    KEYWORD_LIST.find(({ word }) => text.includes(` ${word} `))?.category ??
    null
  )
}

export interface CategorizedText {
  readonly description: string
  readonly categoryId?: string | null
}

/**
 * Suggestion while typing: first what the person chose before for the same
 * description (latest wins), then the keywords, matched to their own list by
 * name. Null when nothing fits.
 */
export function suggestCategory(
  description: string,
  categories: readonly Category[],
  history: readonly CategorizedText[] = [],
): string | null {
  const key = normalizeText(description)
  if (!key) return null
  const ids = new Set(categories.map((item) => item.id))
  for (let index = history.length - 1; index >= 0; index--) {
    const item = history[index]!
    if (
      item.categoryId &&
      ids.has(item.categoryId) &&
      normalizeText(item.description) === key
    )
      return item.categoryId
  }
  const name = keywordCategory(description)
  if (!name) return null
  const wanted = normalizeText(name)
  return (
    categories.find((item) => normalizeText(item.name) === wanted)?.id ?? null
  )
}

// ---------------------------------------------------------------------------
// Where the month's money went.

type WithId = { readonly id: string; readonly categoryId?: string | null }
export interface CategoryData extends FinancialData {
  readonly bills: readonly (Bill & WithId)[]
  readonly expenses: readonly (InvoiceExpense & WithId)[]
  readonly plans: readonly InstallmentPlan[]
  readonly subscriptions: readonly Subscription[]
}

export type OutflowSource =
  'bill' | 'expense' | 'installment' | 'subscription' | 'other'

/** One piece of the month's outflows. `id` is the bill, expense, plan,
 * subscription or (for "other") invoice it comes from. */
export interface OutflowItem {
  readonly source: OutflowSource
  readonly id: string
  /** Card of the invoice it is part of; null outside cards. */
  readonly cardId: string | null
  readonly amount: Cents
  readonly categoryId: string | null
  /** Installment number, for "3/10". */
  readonly number?: number
}

/**
 * Every outflow of the month split into categorizable pieces. The amounts add
 * up exactly to monthBalance(...).outflows: each invoice counts its
 * installments, subscriptions and launched expenses, and "other" is the rest of
 * its total (the part typed without detail, or the gap of a frozen total).
 */
export function monthOutflowItems(
  target: Month,
  data: CategoryData,
): OutflowItem[] {
  month(target)
  const items: OutflowItem[] = []
  const category = (value: string | null | undefined) => value ?? null
  for (const bill of data.bills.filter((item) => item.month === target))
    items.push({
      source: 'bill',
      id: bill.id,
      cardId: null,
      amount: nonNegative(bill.amount),
      categoryId: category(bill.categoryId),
    })
  const schedule = data.plans.flatMap((plan) =>
    installmentSchedule(plan, data.payments)
      .filter((item) => item.month === target)
      .map((item) => ({ plan, item })),
  )
  // Fase 13.3: what the other person bought is not the owner's outflow.
  for (const { plan, item } of schedule.filter(
    ({ plan }) => plan.cardId === null && !plan.forOther,
  ))
    items.push({
      source: 'installment',
      id: plan.id,
      cardId: null,
      amount: item.amount,
      categoryId: category(plan.categoryId),
      number: item.number,
    })
  for (const invoice of data.invoices.filter((item) => item.month === target)) {
    const parts: OutflowItem[] = [
      ...schedule
        .filter(({ plan }) => plan.cardId === invoice.cardId && !plan.forOther)
        .map(({ plan, item }) => ({
          source: 'installment' as const,
          id: plan.id,
          cardId: invoice.cardId,
          amount: item.amount,
          categoryId: category(plan.categoryId),
          number: item.number,
        })),
      ...data.subscriptions
        .filter((item) => item.cardId === invoice.cardId && item.active)
        .map((item) => ({
          source: 'subscription' as const,
          id: item.id,
          cardId: invoice.cardId,
          amount: nonNegative(item.amount),
          categoryId: category(item.categoryId),
        })),
      ...data.expenses
        .filter((item) => item.invoiceId === invoice.id && !item.forOther)
        .map((item) => ({
          source: 'expense' as const,
          id: item.id,
          cardId: invoice.cardId,
          amount: nonNegative(item.amount),
          categoryId: category(item.categoryId),
        })),
    ]
    const itemized = sumMoney(parts.map((item) => item.amount))
    const rest = sumMoney([invoiceTotals(invoice, data).mine, cents(-itemized)])
    items.push(...parts)
    if (rest !== 0)
      items.push({
        source: 'other',
        id: invoice.id,
        cardId: invoice.cardId,
        amount: rest,
        categoryId: null,
      })
  }
  return items
}

/** Group key for things without a category, and for invoice "other". */
export const UNCATEGORIZED = 'sem-categoria'
export const UNDETAILED = 'fatura-sem-detalhe'

export interface CategoryGroup {
  /** A category id, UNCATEGORIZED or UNDETAILED. */
  readonly key: string
  readonly amount: Cents
  /** Share of the month's outflows, 0 to 1. */
  readonly share: number
  readonly items: readonly OutflowItem[]
}

/**
 * Categories first, biggest first; then "Sem categoria" and the invoices'
 * undetailed part. Groups that add up to zero or less are left out.
 */
export function groupByCategory(
  items: readonly OutflowItem[],
): CategoryGroup[] {
  const total = sumMoney(items.map((item) => item.amount))
  const groups = new Map<string, OutflowItem[]>()
  for (const item of items) {
    const key =
      item.source === 'other' ? UNDETAILED : (item.categoryId ?? UNCATEGORIZED)
    groups.set(key, [...(groups.get(key) ?? []), item])
  }
  const rank = (key: string) =>
    key === UNDETAILED ? 2 : key === UNCATEGORIZED ? 1 : 0
  return [...groups.entries()]
    .map(([key, list]) => {
      const amount = sumMoney(list.map((item) => item.amount))
      return {
        key,
        amount,
        share: total > 0 ? amount / total : 0,
        items: [...list].sort((a, b) => b.amount - a.amount),
      }
    })
    .filter((group) => group.amount > 0)
    .sort(
      (a, b) =>
        rank(a.key) - rank(b.key) ||
        b.amount - a.amount ||
        a.key.localeCompare(b.key),
    )
}

/**
 * One-time suggestion for things that already existed (the v1 import): only
 * items without a category, only keyword matches. Returns id → category id.
 */
export function suggestExisting(
  items: readonly (CategorizedText & { readonly id: string })[],
  categories: readonly Category[],
): Map<string, string> {
  const result = new Map<string, string>()
  for (const item of items) {
    if (item.categoryId) continue
    const suggestion = suggestCategory(item.description, categories)
    if (suggestion) result.set(item.id, suggestion)
  }
  return result
}
