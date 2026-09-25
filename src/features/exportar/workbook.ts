import type { Finance } from '../../data/finance'
import { monthBalance } from '../../domain/balance'
import { installmentStatus } from '../../domain/installments'
import { sumMoney, type Cents } from '../../domain/money'
import { dateBR, monthLabel, type ISODate } from '../../domain/months'
import { monthView } from '../meses/monthView'

// Excel export (seção 8.8): one sheet per month, then Parcelamentos, Cartões
// and Assinaturas. Same layout as v1. Kept free of the library so it can be tested.

export interface CellValue {
  readonly value: string | number
  readonly type?: StringConstructor | NumberConstructor
  readonly format?: string
  readonly fontWeight?: 'bold'
}
export type SheetRow = readonly (CellValue | null)[]
export interface SheetSpec {
  readonly sheet: string
  readonly data: readonly SheetRow[]
  readonly columns: readonly { readonly width: number }[]
}

export const MONEY_FORMAT = '"R$" #,##0.00'

const text = (value: string): CellValue => ({ value, type: String })
const bold = (value: string): CellValue => ({
  ...text(value),
  fontWeight: 'bold',
})
const money = (value: Cents, strong = false): CellValue => ({
  value: value / 100,
  type: Number,
  format: MONEY_FORMAT,
  ...(strong ? { fontWeight: 'bold' as const } : {}),
})
const count = (value: number): CellValue => ({ value, type: Number })
const blank: SheetRow = []
const widths = (...values: number[]) => values.map((width) => ({ width }))

/** "Aerarium_2026-09-24.xlsx" */
export const fileName = (today: ISODate) => `Aerarium_${today}.xlsx`

export function buildWorkbook(finance: Finance): SheetSpec[] {
  const cardName = (id: string | null) =>
    finance.cards.find((card) => card.id === id)?.name ?? ''

  const months = finance.months.map(({ ref }) => {
    const view = monthView(finance, ref)
    const { incomes, outflows, available } = monthBalance(ref, finance)
    const outflowRows: SheetRow[] = [
      ...view.cards.map((item) => [
        text(`Fatura ${item.card.name}${item.note ? ` (${item.note})` : ''}`),
        money(item.total),
        text(item.invoice.paid ? 'Sim' : ''),
      ]),
      ...view.loose.map((item) => [
        text(
          `${item.plan.description} ${item.number}/${item.totalInstallments}`,
        ),
        money(item.amount),
        text(item.paid ? 'Sim' : ''),
      ]),
      ...view.bills.map((item) => [
        text(item.description),
        money(item.amount),
        text(item.paid ? 'Sim' : ''),
      ]),
    ]
    return {
      sheet: monthLabel(ref).slice(0, 31),
      columns: widths(46, 16, 8),
      data: [
        [bold(`FINANÇAS - ${monthLabel(ref)}`)],
        blank,
        [bold('ENTRADAS')],
        [bold('Descrição'), bold('Valor')],
        ...view.incomes.map((item) => [
          text(item.description),
          money(item.amount),
        ]),
        [bold('TOTAL ENTRADAS'), money(incomes, true)],
        blank,
        [bold('SAÍDAS')],
        [bold('Descrição'), bold('Valor'), bold('Pago')],
        ...outflowRows,
        [bold('TOTAL SAÍDAS'), money(outflows, true)],
        blank,
        [bold('RESUMO DO MÊS')],
        [text('(+) Total entradas'), money(incomes)],
        [text('(-) Total saídas'), money(outflows)],
        [bold('TOTAL DISPONÍVEL'), money(available, true)],
      ],
    }
  })

  const plans = finance.plans.map((plan) => ({
    plan,
    status: installmentStatus(plan, finance.payments),
    payments: finance.payments
      .filter((item) => item.planId === plan.id)
      .sort((a, b) => a.month.localeCompare(b.month)),
  }))
  const outstanding = sumMoney(plans.map((item) => item.status.outstanding))

  const active = (cardId: string) =>
    plans.filter((item) => item.plan.cardId === cardId && !item.status.settled)
  const subscriptions = finance.subscriptions
    .filter((item) => item.active)
    .sort((a, b) => a.chargeDay - b.chargeDay)

  return [
    ...months,
    {
      sheet: 'Parcelamentos',
      columns: widths(24, 22, 22, 16, 14, 16, 44),
      data: [
        [bold('PARCELAMENTOS')],
        blank,
        [
          bold('Item'),
          bold('Cobrado em'),
          bold('Observação'),
          bold('Parcelas faltando'),
          bold('Valor parcela'),
          bold('Total faltante'),
          bold('Pagamentos'),
        ],
        ...plans.map(({ plan, status, payments }) => [
          text(plan.description),
          text(cardName(plan.cardId)),
          text(plan.note ?? ''),
          count(status.remaining),
          money(plan.installmentAmount),
          money(status.outstanding),
          text(
            payments
              .map(
                (item) => `${dateBR(item.paidOn)} (${monthLabel(item.month)})`,
              )
              .join('; '),
          ),
        ]),
        blank,
        [
          bold('TOTAL GERAL FALTANTE'),
          null,
          null,
          null,
          null,
          money(outstanding, true),
        ],
      ],
    },
    {
      sheet: 'Cartões',
      columns: widths(24, 18, 15, 16, 18),
      data: [
        [bold('CARTÕES')],
        blank,
        [
          bold('Cartão'),
          bold('Dia de fechamento'),
          bold('Parcelas ativas'),
          bold('Parcelas por mês'),
          bold('Assinaturas por mês'),
        ],
        ...finance.cards.map((card) => [
          text(card.name),
          card.closingDay ? count(card.closingDay) : text(''),
          count(active(card.id).length),
          money(
            sumMoney(
              active(card.id).map((item) => item.plan.installmentAmount),
            ),
          ),
          money(
            sumMoney(
              subscriptions
                .filter((item) => item.cardId === card.id)
                .map((item) => item.amount),
            ),
          ),
        ]),
      ],
    },
    {
      sheet: 'Assinaturas',
      columns: widths(24, 16, 14, 20, 24),
      data: [
        [bold('ASSINATURAS MENSAIS')],
        [
          bold('Assinatura'),
          bold('Dia vencimento'),
          bold('Valor'),
          bold('Cartão'),
          bold('Observação'),
        ],
        ...subscriptions.map((item) => [
          text(item.name),
          count(item.chargeDay),
          money(item.amount),
          text(cardName(item.cardId)),
          text(item.note ?? ''),
        ]),
        [
          bold('TOTAL MENSAL'),
          null,
          money(sumMoney(subscriptions.map((item) => item.amount)), true),
        ],
      ],
    },
  ]
}

/** Builds and downloads the file; the library loads only now. */
export async function downloadExcel(finance: Finance, today: ISODate) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const sheets = buildWorkbook(finance).map((sheet) => ({
    sheet: sheet.sheet,
    columns: [...sheet.columns],
    data: sheet.data.map((row) => [...row]),
  }))
  await writeXlsxFile(sheets as Parameters<typeof writeXlsxFile>[0]).toFile(
    fileName(today),
  )
}
