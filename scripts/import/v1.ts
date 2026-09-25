import { cents, sumMoney, type Cents } from '../../src/domain/money'
import { addMonths, month, type Month } from '../../src/domain/months'

// Shape of the v1 backup (Firestore documents keyed by id). Every field is
// optional because v1 wrote whatever the screen had at the time.
export interface V1Expense {
  readonly id?: string
  readonly desc?: string
  readonly valor?: number
  readonly data?: string
}
export interface V1Row {
  readonly id?: string
  readonly desc?: string
  readonly valor?: number
  readonly pago?: boolean
  readonly outros?: number
  readonly est?: boolean
  readonly obs?: string
  readonly gastos?: readonly V1Expense[]
  readonly parc?: string
}
export interface V1Month {
  readonly entradas: readonly V1Row[]
  readonly saidas: readonly V1Row[]
}
export interface V1Payment {
  readonly data?: string
  readonly mes?: string
  readonly via?: string
}
export interface V1Plan {
  readonly item?: string
  readonly valor?: number
  readonly faltam?: number
  readonly obs?: string
  readonly paraQuem?: string
  readonly cartao?: string
  readonly saida?: string
  readonly pagamentos?: readonly V1Payment[]
}
export interface V1Subscription {
  readonly nome?: string
  readonly dia?: number
  readonly valor?: number
  readonly cartaoId?: string
  readonly obs?: string
}
export interface V1Card {
  readonly nome?: string
  readonly ordem?: number
  readonly saida?: string
  readonly saidaNome?: string
  readonly cor?: string
}
export interface V1Backup {
  readonly months: Readonly<Record<string, V1Month>>
  readonly parcelamentos: Readonly<Record<string, V1Plan>>
  readonly assinaturas: Readonly<Record<string, V1Subscription>>
  readonly cartoes: Readonly<Record<string, V1Card>>
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function checkNumbers(value: unknown, path: string): void {
  if (typeof value === 'number' && !Number.isFinite(value))
    throw new RangeError(`Número inválido em ${path}.`)
  if (Array.isArray(value))
    value.forEach((item, index) => checkNumbers(item, `${path}[${index}]`))
  else if (isObject(value))
    for (const [key, item] of Object.entries(value))
      checkNumbers(item, `${path}.${key}`)
}

export function parseBackup(json: unknown): V1Backup {
  if (!isObject(json)) throw new TypeError('O backup não é um objeto JSON.')
  for (const key of ['months', 'parcelamentos', 'assinaturas', 'cartoes'])
    if (json[key] !== undefined && !isObject(json[key]))
      throw new TypeError(`"${key}" deveria ser um objeto.`)
  checkNumbers(json, 'backup')
  const months: Record<string, V1Month> = {}
  for (const [key, value] of Object.entries(json.months ?? {})) {
    month(key)
    if (!isObject(value)) throw new TypeError(`Mês ${key} inválido.`)
    for (const list of ['entradas', 'saidas'])
      if (value[list] !== undefined && !Array.isArray(value[list]))
        throw new TypeError(`${key}.${list} deveria ser uma lista.`)
    months[key] = {
      entradas: (value.entradas ?? []) as V1Row[],
      saidas: (value.saidas ?? []) as V1Row[],
    }
  }
  return {
    months,
    parcelamentos: (json.parcelamentos ?? {}) as Record<string, V1Plan>,
    assinaturas: (json.assinaturas ?? {}) as Record<string, V1Subscription>,
    cartoes: (json.cartoes ?? {}) as Record<string, V1Card>,
  }
}

/** v1 `Math.round(valor * 100)`, the same rounding its `sum` used. */
export const reais = (value: number | undefined): Cents =>
  cents(Math.round((Number(value) || 0) * 100))

export const cleanDesc = (text: string) =>
  text
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b\d{1,2}\/\d{1,2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
export const norm = (text: string) =>
  cleanDesc(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const soft = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

export const isCarryover = (row: V1Row) => /sobr/i.test(row.desc ?? '')

export type V1CardEntry = V1Card & { readonly id: string }

export function cardList(backup: V1Backup): V1CardEntry[] {
  return Object.entries(backup.cartoes)
    .map(([id, card]) => ({ id, ...card }))
    .sort(
      (a, b) =>
        (a.ordem ?? 0) - (b.ordem ?? 0) ||
        String(a.nome).localeCompare(String(b.nome)),
    )
}

/** The card whose invoice this month row is (v1 `cardForRow`). */
export function cardForRow(
  cards: readonly V1CardEntry[],
  row: V1Row,
): V1CardEntry | null {
  const key = norm(row.desc ?? '')
  return cards.find((card) => card.saida && card.saida === key) ?? null
}

/** v1 `fcNote`: explicit obs wins; otherwise the description if it says more than the default name. */
export function invoiceNote(row: V1Row, card: V1CardEntry): string | null {
  if (row.obs != null) return row.obs.trim() || null
  const text = soft(row.desc ?? '')
  const extra =
    !!text &&
    text !== soft(card.nome ?? '') &&
    text !== soft(`fatura ${card.nome ?? ''}`) &&
    text !== soft(card.saidaNome ?? '')
  return extra ? (row.desc ?? '').trim() : null
}

/** v1 `parcMonths`: paid months, then `faltam` open months from today (skipping paid ones). */
export function v1PlanMonths(
  plan: V1Plan,
  today: Month,
): Map<Month, 'pago' | 'aberto'> {
  const result = new Map<Month, 'pago' | 'aberto'>()
  const paid = (plan.pagamentos ?? []).flatMap((item) =>
    item.mes ? [month(item.mes)] : [],
  )
  for (const item of paid) result.set(item, 'pago')
  let open = plan.faltam ?? 0
  if (open > 0) {
    const last = [...paid].sort().pop()
    let start = today
    if (last && addMonths(last, 1) < today) start = addMonths(last, 1)
    for (let at = start, guard = 0; open > 0 && guard < 240; guard++) {
      if (!result.has(at)) {
        result.set(at, 'aberto')
        open--
      }
      at = addMonths(at, 1)
    }
  }
  return result
}

/** Month totals exactly as the v1 screen showed them: sums of the stored values. */
export function v1MonthTotals(data: V1Month) {
  const incomes = sumMoney(data.entradas.map((row) => reais(row.valor)))
  const outflows = sumMoney(data.saidas.map((row) => reais(row.valor)))
  return {
    incomes,
    outflows,
    available: sumMoney([incomes, cents(-outflows)]),
    unpaid: sumMoney(
      data.saidas.filter((row) => !row.pago).map((row) => reais(row.valor)),
    ),
  }
}

/** v1 `cardParts`: installments of the card in the month and all its subscriptions. */
export function v1CardParts(
  backup: V1Backup,
  cardId: string,
  target: Month,
  today: Month,
) {
  const plans = Object.entries(backup.parcelamentos).filter(
    ([, plan]) =>
      plan.cartao === cardId && v1PlanMonths(plan, today).has(target),
  )
  const subscriptions = Object.values(backup.assinaturas).filter(
    (item) => item.cartaoId === cardId,
  )
  return {
    planIds: plans.map(([id]) => id),
    installments: sumMoney(plans.map(([, plan]) => reais(plan.valor))),
    subscriptions: sumMoney(subscriptions.map((item) => reais(item.valor))),
  }
}
