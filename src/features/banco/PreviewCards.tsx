import type { Finance } from '../../data/finance'
import type { ImportResult } from '../../domain/bank'
import { cents, formatMoney, sumMoney } from '../../domain/money'
import { dayMonth, monthName, monthShort } from '../../domain/months'
import { CardArt } from '../../ui/CardArt'
import { importPreview } from './importPreview'

/**
 * First import, card by card: each closed bill against what the app would
 * know of it, the new plans and every purchase with whose it was taken as.
 */
export function PreviewCards({
  finance,
  result,
}: {
  readonly finance: Finance
  readonly result: ImportResult
}) {
  const other = finance.otherPerson
  return (
    <>
      <p className="muted">Toca num cartão pra ver o que entra nele.</p>
      {importPreview(finance, result).map((item) => {
        const theirs = item.purchases.filter((purchase) => purchase.forOther)
        return (
          <details className="preview-card" key={item.card.id}>
            <summary>
              <CardArt card={item.card} size="xs" />
              <span>
                <b>{item.card.name}</b>
                <small>
                  {[
                    item.purchases.length > 0 &&
                      `${item.purchases.length} compras · ${formatMoney(item.purchasesTotal)}`,
                    other &&
                      theirs.length > 0 &&
                      `${theirs.length} do ${other}`,
                    item.plans.length > 0 &&
                      `${item.plans.length} parcelamentos novos`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </small>
              </span>
            </summary>
            {item.bills.map((bill) => {
              const app = sumMoney([
                bill.installments,
                bill.subscriptions,
                bill.purchases,
              ])
              return (
                <p
                  key={bill.month}
                  className={`bill-check${app > bill.bank ? ' over' : ''}`}
                >
                  Fatura de {monthName(bill.month).toLowerCase()}: no banco{' '}
                  <b>{formatMoney(bill.bank)}</b>. No app: parcelas{' '}
                  {formatMoney(bill.installments)}, assinaturas{' '}
                  {formatMoney(bill.subscriptions)} e compras{' '}
                  {formatMoney(bill.purchases)}, somando{' '}
                  <b>{formatMoney(app)}</b>
                  {app > bill.bank &&
                    ` (${formatMoney(cents(app - bill.bank))} a mais)`}
                  .
                </p>
              )
            })}
            {item.plans.length > 0 && (
              <>
                <h4>Parcelamentos novos</h4>
                <ul>
                  {item.plans.map((plan) => (
                    <li key={plan.id}>
                      <span>
                        {plan.description}
                        {other && plan.forOther && (
                          <span className="other-pill">{other}</span>
                        )}
                        <small>
                          {plan.totalInstallments}x · desde{' '}
                          {monthShort(plan.firstMonth)}
                        </small>
                      </span>
                      <b>{formatMoney(plan.installmentAmount)}</b>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {item.purchases.length > 0 && (
              <>
                <h4>Compras</h4>
                <ul>
                  {item.purchases.map((purchase) => (
                    <li key={purchase.id}>
                      <span>
                        {purchase.description}
                        {other && purchase.forOther && (
                          <span className="other-pill">{other}</span>
                        )}
                        <small>
                          {dayMonth(purchase.spentOn)}
                          {purchase.month &&
                            ` · fatura de ${monthShort(purchase.month)}`}
                        </small>
                      </span>
                      <b>{formatMoney(purchase.amount)}</b>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </details>
        )
      })}
    </>
  )
}
