import type { Card, Finance } from '../../data/finance'
import type { ImportResult } from '../../domain/bank'
import { sumMoney, type Cents } from '../../domain/money'
import type { ISODate, Month } from '../../domain/months'

export interface PreviewPurchase {
  readonly id: string
  readonly description: string
  readonly spentOn: ISODate
  readonly amount: Cents
  readonly month: Month | null
  readonly forOther: boolean
}

export interface PreviewCard {
  readonly card: Card
  readonly purchases: readonly PreviewPurchase[]
  readonly purchasesTotal: Cents
  readonly plans: ImportResult['plans']
  readonly bills: ImportResult['billChecks']
}

/** What the first import would do, card by card, to check before saving. */
export function importPreview(
  finance: Finance,
  result: ImportResult,
): PreviewCard[] {
  const invoices = [...finance.invoices, ...result.invoices]
  const invoiceOf = (id: string) => invoices.find((item) => item.id === id)
  return finance.cards
    .map((card) => {
      const purchases = result.expenses
        .filter((item) => invoiceOf(item.invoiceId)?.cardId === card.id)
        .map((item) => ({
          id: item.id,
          description: item.description,
          spentOn: item.spentOn,
          amount: item.amount,
          month: invoiceOf(item.invoiceId)?.month ?? null,
          forOther: item.forOther,
        }))
        .sort((a, b) => b.spentOn.localeCompare(a.spentOn))
      return {
        card,
        purchases,
        purchasesTotal: sumMoney(purchases.map((item) => item.amount)),
        plans: result.plans.filter((item) => item.cardId === card.id),
        bills: result.billChecks.filter((item) => item.cardId === card.id),
      }
    })
    .filter(
      (item) => item.purchases.length || item.plans.length || item.bills.length,
    )
}
