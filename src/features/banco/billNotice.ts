import type { Finance } from '../../data/finance'
import type { ImportResult } from '../../domain/bank'
import { invoiceTotals } from '../../domain/invoices'
import { formatMoney } from '../../domain/money'
import { monthName, type Month } from '../../domain/months'

export interface BillNotice {
  readonly cardId: string
  readonly month: Month
  readonly message: string
}

/**
 * Bills the bank closed in this import, in plain words (asked by the owner
 * on 28/10/2026): "A fatura do Nubank de outubro fechou: R$ 4.123,45.
 * Sua parte R$ 1.200,00, do Pai R$ 2.923,45." `finance` already has the
 * import applied. A total the bank only corrected is not told again.
 */
export function billNotices(
  finance: Finance,
  result: ImportResult,
): BillNotice[] {
  const closed = new Set(
    result.records
      .filter((item) => item.externalId.startsWith('bill:'))
      .map((item) => item.refId),
  )
  return result.bankTotals.flatMap((total) => {
    const invoice = finance.invoices.find((item) => item.id === total.invoiceId)
    const card = finance.cards.find((item) => item.id === invoice?.cardId)
    if (!invoice || !card || !closed.has(invoice.id)) return []
    const totals = invoiceTotals(invoice, finance)
    const parts = finance.otherPerson
      ? ` Sua parte ${formatMoney(totals.mine)}, do ${finance.otherPerson} ${formatMoney(totals.otherShare)}.`
      : ''
    return [
      {
        cardId: card.id,
        month: invoice.month,
        message: `A fatura do ${card.name} de ${monthName(invoice.month).toLowerCase()} fechou: ${formatMoney(total.bankTotal)}.${parts}`,
      },
    ]
  })
}
