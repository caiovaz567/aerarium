import { createHash } from 'node:crypto'
import { setInvoicePaid } from '../../src/domain/invoices'
import { cents, sumMoney, type Cents } from '../../src/domain/money'
import {
  isoDate,
  month,
  monthOf,
  monthsBetween,
  type ISODate,
  type Month,
} from '../../src/domain/months'
import type {
  Bill,
  FinancialData,
  Income,
  InstallmentPayment,
  InstallmentPlan,
  Invoice,
  InvoiceExpense,
  Subscription,
} from '../../src/domain/types'
import {
  cardForRow,
  cardList,
  invoiceNote,
  isCarryover,
  reais,
  v1CardParts,
  type V1Backup,
} from './v1'

export interface ImportOptions {
  readonly userId: string
  /** "Today" for v1 rules: installments without payments start in this month. */
  readonly today: ISODate
}

export interface CardRow {
  readonly id: string
  readonly v1Id: string
  readonly name: string
  readonly color: string | null
  readonly sortOrder: number
}
export interface MonthRow {
  readonly id: string
  readonly ref: Month
}
export type IncomeRow = Income & {
  readonly id: string
  readonly monthId: string
}
export type BillRow = Bill & { readonly id: string; readonly monthId: string }
export type InvoiceRow = Invoice & {
  readonly monthId: string
  /** Total stored by v1 in the month row. */
  readonly v1Total: Cents
  /** v1 `outros`, which includes the expenses launched on the invoice. */
  readonly v1Other: Cents
}
export type ExpenseRow = InvoiceExpense & {
  readonly id: string
  readonly description: string
  readonly spentOn: ISODate
}
export type PlanRow = InstallmentPlan & {
  readonly v1Id: string
  readonly note: string | null
}
export type PaymentRow = InstallmentPayment & { readonly id: string }
export type SubscriptionRow = Subscription & {
  readonly name: string
  readonly chargeDay: number
  readonly note: string | null
}

/** Where each v1 outflow row went, so the report can compare item by item. */
export interface OutflowTrace {
  readonly month: Month
  readonly label: string
  readonly v1Amount: Cents
  readonly v1Paid: boolean
  readonly target:
    | { readonly type: 'invoice'; readonly id: string }
    | { readonly type: 'bill'; readonly id: string }
    | { readonly type: 'loose'; readonly planId: string | null }
}

export interface ImportData {
  readonly cards: readonly CardRow[]
  readonly months: readonly MonthRow[]
  readonly incomes: readonly IncomeRow[]
  readonly bills: readonly BillRow[]
  /** Paid invoices already carry the frozen total the database trigger will compute. */
  readonly invoices: readonly InvoiceRow[]
  readonly expenses: readonly ExpenseRow[]
  readonly plans: readonly PlanRow[]
  /** Manual payments only. Invoice payments are created by the database when the invoice is marked paid. */
  readonly payments: readonly PaymentRow[]
  /** What the database will create for paid invoices; used only for the report. */
  readonly invoicePayments: readonly InstallmentPayment[]
  readonly subscriptions: readonly SubscriptionRow[]
  readonly outflows: readonly OutflowTrace[]
  readonly warnings: readonly string[]
  /** Installments that only become paid because v2 pays everything on a paid invoice (seção 4.4). */
  readonly autoPaid: readonly string[]
}

/** Same user and v1 key always give the same UUID, so a rerun updates instead of duplicating. */
export function stableId(userId: string, kind: string, key: string): string {
  const hex = createHash('sha256')
    .update(`aerarium-v1-import|${userId}|${kind}|${key}`)
    .digest('hex')
  const variant = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

const text = (value: string | undefined) => (value ?? '').trim()

function validDate(value: string | undefined): ISODate | null {
  try {
    return value ? isoDate(value) : null
  } catch {
    return null
  }
}

function validMonth(value: string | undefined): Month | null {
  try {
    return value ? month(value) : null
  } catch {
    return null
  }
}

export function mapBackup(
  backup: V1Backup,
  options: ImportOptions,
): ImportData {
  const { userId } = options
  const today = isoDate(options.today)
  const todayMonth = monthOf(today)
  const id = (kind: string, key: string) => stableId(userId, kind, key)
  const warnings: string[] = []
  const warn = (message: string) => warnings.push(message)
  const limited = (
    value: string,
    max: number,
    fallback: string,
    what: string,
  ) => {
    if (!value) {
      warn(`${what} sem nome: importado como "${fallback}".`)
      return fallback
    }
    if (value.length > max) {
      warn(`${what} "${value}" passou de ${max} letras e foi cortado.`)
      return value.slice(0, max)
    }
    return value
  }

  // Cards
  const v1Cards = cardList(backup)
  const cardIds = new Map<string, string>()
  const cards = v1Cards.map((card, index): CardRow => {
    const row = {
      id: id('card', card.id),
      v1Id: card.id,
      name: limited(text(card.nome), 60, `Cartão ${index + 1}`, 'Cartão'),
      color: /^#[0-9A-Fa-f]{6}$/.test(card.cor ?? '') ? card.cor! : null,
      sortOrder:
        Number.isInteger(card.ordem) && Math.abs(card.ordem!) < 2 ** 31
          ? card.ordem!
          : index,
    }
    cardIds.set(card.id, row.id)
    return row
  })
  // Installment plans and their v1 payments
  const plans: PlanRow[] = []
  const pendingPayments: {
    plan: PlanRow
    month: Month
    paidOn: ISODate
    viaInvoice: boolean
  }[] = []
  for (const [v1Id, plan] of Object.entries(backup.parcelamentos)) {
    const description = limited(
      text(plan.item),
      200,
      'Parcelamento',
      'Parcelamento',
    )
    const amount = reais(plan.valor)
    if (amount <= 0) {
      warn(`Parcelamento "${description}" sem valor: não foi importado.`)
      continue
    }
    const payments = new Map<Month, { paidOn: ISODate; viaInvoice: boolean }>()
    for (const payment of plan.pagamentos ?? []) {
      const date = validDate(payment.data)
      const paidMonth = validMonth(payment.mes) ?? (date ? monthOf(date) : null)
      if (!paidMonth) {
        warn(`Pagamento de "${description}" sem mês nem data: ignorado.`)
        continue
      }
      if (payments.has(paidMonth)) {
        warn(
          `"${description}" tinha dois pagamentos em ${paidMonth}: ficou só o primeiro.`,
        )
        continue
      }
      if (!date)
        warn(
          `Pagamento de "${description}" em ${paidMonth} sem data: usei ${today}.`,
        )
      payments.set(paidMonth, {
        paidOn: date ?? today,
        viaInvoice: payment.via === 'mes',
      })
    }
    const paidMonths = [...payments.keys()].sort()
    const firstMonth = paidMonths[0] ?? todayMonth
    const remaining = Math.max(0, Math.trunc(plan.faltam ?? 0))
    let total = remaining + payments.size
    const lastPaid = paidMonths[paidMonths.length - 1]
    if (lastPaid && monthsBetween(firstMonth, lastPaid) + 1 > total) {
      const needed = monthsBetween(firstMonth, lastPaid) + 1
      warn(
        `"${description}": os pagamentos pulam meses, então o cronograma fixo ficou com ${needed} parcelas em vez de ${total}.`,
      )
      total = needed
    }
    if (total < 1) {
      warn(`Parcelamento "${description}" sem parcelas: não foi importado.`)
      continue
    }
    if (total > 120)
      throw new RangeError(
        `"${description}" teria ${total} parcelas (máximo 120).`,
      )
    let cardId: string | null = null
    if (plan.cartao && cardIds.has(plan.cartao))
      cardId = cardIds.get(plan.cartao)!
    else if (plan.cartao)
      warn(
        `"${description}" apontava pra um cartão que não existe mais: foi importado fora de cartão.`,
      )
    else if (plan.saida)
      warn(
        `"${description}" estava ligado à saída "${plan.saida}", sem cartão: foi importado fora de cartão.`,
      )
    const row: PlanRow = {
      id: id('plan', v1Id),
      v1Id,
      cardId,
      description,
      installmentAmount: amount,
      finalAdjustment: cents(0),
      totalInstallments: total,
      firstMonth,
      note: text(plan.obs ?? plan.paraQuem) || null,
    }
    plans.push(row)
    for (const [paidMonth, payment] of payments)
      pendingPayments.push({ plan: row, month: paidMonth, ...payment })
  }
  const planByV1 = new Map(plans.map((plan) => [plan.v1Id, plan]))

  // Months
  const months: MonthRow[] = []
  const incomes: IncomeRow[] = []
  const bills: BillRow[] = []
  const invoices: InvoiceRow[] = []
  const expenses: ExpenseRow[] = []
  const outflows: OutflowTrace[] = []
  for (const ym of Object.keys(backup.months).sort()) {
    const ref = month(ym)
    const data = backup.months[ym]!
    const monthId = id('month', ym)
    months.push({ id: monthId, ref })
    const used = new Set<string>()
    const rowKey = (list: string, rowId: string | undefined, index: number) => {
      const base = `${ym}:${list}:${rowId ?? `#${index}`}`
      const key = used.has(base) ? `${base}#${index}` : base
      used.add(key)
      return key
    }

    let carryover = false
    data.entradas.forEach((row, index) => {
      const description = limited(
        text(row.desc),
        200,
        'Entrada',
        `Entrada de ${ym}`,
      )
      const amount = reais(row.valor)
      let kind: Income['kind'] = 'normal'
      if (isCarryover(row)) {
        if (carryover)
          warn(
            `${ym}: mais de uma entrada de sobra; "${description}" virou entrada comum.`,
          )
        else kind = 'carryover'
        carryover = true
      }
      if (amount < 0 && kind !== 'carryover')
        throw new RangeError(`${ym}: a entrada "${description}" é negativa.`)
      incomes.push({
        id: id('income', rowKey('entradas', row.id, index)),
        monthId,
        month: ref,
        description,
        amount,
        kind,
        sortOrder: index,
      })
    })

    data.saidas.forEach((row, index) => {
      const key = rowKey('saidas', row.id, index)
      const v1Amount = reais(row.valor)
      const label = text(row.desc) || '(sem descrição)'
      const trace = { month: ref, label, v1Amount, v1Paid: !!row.pago }
      if (row.parc) {
        // Derived from the installment plan in v1; v2 computes it from the schedule.
        outflows.push({
          ...trace,
          target: { type: 'loose', planId: planByV1.get(row.parc)?.id ?? null },
        })
        return
      }
      const card = cardForRow(v1Cards, row)
      const cardId = card ? cardIds.get(card.id)! : null
      if (
        card &&
        invoices.some((item) => item.cardId === cardId && item.month === ref)
      )
        warn(
          `${ym}: "${label}" é uma segunda fatura do ${card.nome}; entrou como conta.`,
        )
      else if (card && cardId) {
        const invoiceId = id('invoice', `${ym}:${card.id}`)
        const launched: ExpenseRow[] = []
        ;(row.gastos ?? []).forEach((expense, expenseIndex) => {
          const description = limited(
            text(expense.desc),
            200,
            'Gasto',
            `Gasto de ${ym}`,
          )
          const amount = reais(expense.valor)
          if (amount <= 0) {
            warn(
              `${ym}: gasto "${description}" sem valor no ${card.nome}: ignorado.`,
            )
            return
          }
          const spentOn = validDate(expense.data)
          if (!spentOn)
            warn(
              `${ym}: gasto "${description}" sem data válida: usei o dia 1º.`,
            )
          launched.push({
            id: id('expense', `${key}:${expense.id ?? `#${expenseIndex}`}`),
            invoiceId,
            description,
            amount,
            spentOn: spentOn ?? isoDate(`${ym}-01`),
          })
        })
        const parts = v1CardParts(backup, card.id, ref, todayMonth)
        const v1Other =
          row.outros != null
            ? reais(row.outros)
            : sumMoney([
                v1Amount,
                cents(-parts.installments),
                cents(-parts.subscriptions),
              ])
        let other = sumMoney([
          v1Other,
          cents(-sumMoney(launched.map((item) => item.amount))),
        ])
        if (other < 0) {
          warn(
            `${ym}: "outros" do ${card.nome} ficou negativo; importado como zero.`,
          )
          other = cents(0)
        }
        expenses.push(...launched)
        invoices.push({
          id: invoiceId,
          cardId,
          monthId,
          month: ref,
          otherAmount: other,
          estimated: !!row.est,
          note: invoiceNote(row, card)?.slice(0, 500) ?? null,
          paid: !!row.pago,
          paidOn: null,
          closedTotal: null,
          v1Total: v1Amount,
          v1Other,
        })
        outflows.push({
          ...trace,
          label: card.nome ?? label,
          target: { type: 'invoice', id: invoiceId },
        })
        return
      }
      if (v1Amount < 0)
        throw new RangeError(`${ym}: a saída "${label}" é negativa.`)
      const billId = id('bill', key)
      bills.push({
        id: billId,
        monthId,
        month: ref,
        description: limited(text(row.desc), 200, 'Conta', `Saída de ${ym}`),
        amount: v1Amount,
        paid: !!row.pago,
        paidOn: row.pago ? today : null,
        sortOrder: index,
      })
      outflows.push({ ...trace, target: { type: 'bill', id: billId } })
    })
  }

  // v1 payments made "via mês" belong to the paid invoice; the database recreates them.
  const payments: PaymentRow[] = []
  const invoicePaidOn = new Map<string, ISODate>()
  for (const item of pendingPayments) {
    const invoice = invoices.find(
      (row) =>
        row.cardId === item.plan.cardId && row.month === item.month && row.paid,
    )
    if (item.viaInvoice && invoice) {
      const latest = invoicePaidOn.get(invoice.id)
      if (!latest || item.paidOn > latest)
        invoicePaidOn.set(invoice.id, item.paidOn)
      continue
    }
    if (item.viaInvoice)
      warn(
        `"${item.plan.description}" ${item.month}: pago pela fatura, mas a fatura não está paga; virou pagamento manual.`,
      )
    payments.push({
      id: id('payment', `${item.plan.v1Id}:${item.month}`),
      planId: item.plan.id,
      month: item.month,
      paidOn: item.paidOn,
      source: 'manual',
      invoiceId: null,
    })
  }

  // Subscriptions
  const subscriptions: SubscriptionRow[] = []
  for (const [v1Id, item] of Object.entries(backup.assinaturas)) {
    const name = limited(text(item.nome), 120, 'Assinatura', 'Assinatura')
    const amount = reais(item.valor)
    if (amount <= 0) {
      warn(`Assinatura "${name}" sem valor: não foi importada.`)
      continue
    }
    let chargeDay = Number(item.dia)
    if (!Number.isInteger(chargeDay) || chargeDay < 1 || chargeDay > 31) {
      warn(`Assinatura "${name}" sem dia de cobrança válido: usei o dia 1.`)
      chargeDay = 1
    }
    if (item.cartaoId && !cardIds.has(item.cartaoId))
      warn(
        `Assinatura "${name}" apontava pra um cartão que não existe mais: ficou sem cartão.`,
      )
    subscriptions.push({
      id: id('subscription', v1Id),
      cardId: (item.cartaoId && cardIds.get(item.cartaoId)) || null,
      name,
      amount,
      chargeDay,
      note: text(item.obs) || null,
      active: true,
    })
  }

  // Freeze paid invoices the way the database trigger will.
  let context: FinancialData = {
    incomes,
    bills,
    invoices: [],
    plans,
    payments,
    subscriptions,
    expenses,
  }
  const manualKeys = new Set(
    pendingPayments.map((item) => `${item.plan.id}:${item.month}`),
  )
  const autoPaid: string[] = []
  const frozen = invoices.map((invoice) => {
    if (!invoice.paid) return invoice
    const result = setInvoicePaid(
      { ...invoice, paid: false },
      true,
      invoicePaidOn.get(invoice.id) ?? today,
      context,
    )
    for (const payment of result.payments.slice(context.payments.length)) {
      if (manualKeys.has(`${payment.planId}:${payment.month}`)) continue
      const plan = plans.find((item) => item.id === payment.planId)!
      const card = cards.find((item) => item.id === plan.cardId)!
      autoPaid.push(
        `${plan.description} (${payment.month}) passa a contar como paga, porque a fatura do ${card.name} desse mês está paga.`,
      )
    }
    context = { ...context, payments: result.payments }
    return { ...invoice, ...result.invoice }
  })

  return {
    cards,
    months,
    incomes,
    bills,
    invoices: frozen,
    expenses,
    plans,
    payments,
    invoicePayments: context.payments.slice(payments.length),
    subscriptions,
    outflows,
    warnings,
    autoPaid,
  }
}

/** The imported rows as the domain sees them, including the payments paid invoices create. */
export function toFinancialData(data: ImportData): FinancialData {
  return {
    incomes: data.incomes,
    bills: data.bills,
    invoices: data.invoices,
    plans: data.plans,
    payments: [...data.payments, ...data.invoicePayments],
    subscriptions: data.subscriptions,
    expenses: data.expenses,
  }
}
