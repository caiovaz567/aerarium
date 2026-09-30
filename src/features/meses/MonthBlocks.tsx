import { CASH, isBankKey, paidFromName } from '../../domain/banks'
import { BankLogo } from '../../ui/BankLogo'
import { WalletIcon } from '../../ui/icons'
import type { BillRow, IncomeRow } from '../../data/finance'
import { formatMoney, type Cents } from '../../domain/money'
import { monthName } from '../../domain/months'
import type { Category } from '../../domain/categories'
import { CardArt } from '../../ui/CardArt'
import { CategoryBadge } from '../../ui/CategoryBadge'
import { CheckButton, TrashButton } from '../../ui/controls'
import type { CardOutflow, CarryHint, LooseOutflow } from './monthView'

const EMPTY = 'Toca no + pra lançar.'

/**
 * A bill's tile: the bank it was paid from (its logo, like the cards), cash,
 * or its category when that was not said.
 */
function BillTile({
  paidFrom,
  category,
}: {
  readonly paidFrom?: string | null
  readonly category: Category | null
}) {
  if (isBankKey(paidFrom)) return <BankLogo bank={paidFrom} className="xs" />
  if (paidFrom === CASH)
    return (
      <span className="cat-badge none" aria-hidden="true">
        <WalletIcon />
      </span>
    )
  return <CategoryBadge category={category} />
}

export function IncomesBlock({
  incomes,
  total,
  carryHint,
  onEdit,
  onDelete,
  onUseCarry,
}: {
  readonly incomes: readonly IncomeRow[]
  readonly total: Cents
  readonly carryHint: CarryHint | null
  readonly onEdit: (income: IncomeRow) => void
  readonly onDelete: (income: IncomeRow) => void
  readonly onUseCarry: (hint: CarryHint) => void
}) {
  return (
    <section className="block" aria-labelledby="entradas">
      <div className="block-head">
        <h2 id="entradas">Entradas</h2>
        <span className="sum pos">{formatMoney(total)}</span>
      </div>
      <ul className="rows">
        {incomes.map((income) => (
          <li className="row" key={income.id}>
            <button
              type="button"
              className="row-main"
              onClick={() => onEdit(income)}
            >
              <span className="desc">{income.description}</span>
              <span className={`val${income.amount ? '' : ' zero'}`}>
                {formatMoney(income.amount)}
              </span>
            </button>
            <TrashButton
              label={income.description}
              onClick={() => onDelete(income)}
            />
          </li>
        ))}
      </ul>
      {carryHint && (
        <div className="hint">
          <span>
            {monthName(carryHint.previous)} fechou com{' '}
            <b>{formatMoney(carryHint.available)}</b>.
          </span>
          <button type="button" onClick={() => onUseCarry(carryHint)}>
            Usar esse valor
          </button>
        </div>
      )}
      {!incomes.length && (
        <p className="empty-hint">Nenhuma entrada ainda. {EMPTY}</p>
      )}
    </section>
  )
}

export function GroupHead({ title, total }: { title: string; total: Cents }) {
  return (
    <div className="grp-h">
      <span>{title}</span>
      <b>{formatMoney(total)}</b>
    </div>
  )
}

/** Saídas "Por tipo": cards, loose installments and bills. */
export function OutflowsByType({
  view,
  categories,
  onInvoice,
  onInvoicePaid,
  onInvoiceDelete,
  onLoosePaid,
  onLooseOpen,
  onBill,
  onBillPaid,
  onBillDelete,
}: {
  readonly view: {
    readonly cards: readonly CardOutflow[]
    readonly loose: readonly LooseOutflow[]
    readonly bills: readonly BillRow[]
    readonly paidCount: number
    readonly outflowCount: number
    readonly subtotals: { cards: Cents; loose: Cents; bills: Cents }
    readonly balance: { readonly outflows: Cents; readonly unpaid: Cents }
  }
  readonly categories: readonly Category[]
  readonly onInvoice: (item: CardOutflow) => void
  readonly onInvoicePaid: (item: CardOutflow, paid: boolean) => void
  readonly onInvoiceDelete: (item: CardOutflow) => void
  readonly onLoosePaid: (item: LooseOutflow, paid: boolean) => void
  readonly onLooseOpen: (item: LooseOutflow) => void
  readonly onBill: (bill: BillRow) => void
  readonly onBillPaid: (bill: BillRow, paid: boolean) => void
  readonly onBillDelete: (bill: BillRow) => void
}) {
  const { cards, loose, bills } = view
  const category = (id: string | null | undefined) =>
    categories.find((item) => item.id === id) ?? null
  return (
    <div aria-label="Por tipo" role="group">
      {cards.length > 0 && (
        <>
          <GroupHead title="Cartões" total={view.subtotals.cards} />
          <ul className="rows">
            {cards.map((item) => (
              <li
                className={`row${item.invoice.paid ? ' paid' : ''}`}
                key={item.invoice.id}
              >
                <CheckButton
                  checked={item.invoice.paid}
                  label={`fatura ${item.card.name}`}
                  onChange={(paid) => onInvoicePaid(item, paid)}
                />
                <button
                  type="button"
                  className="row-main card-row"
                  onClick={() => onInvoice(item)}
                >
                  <CardArt card={item.card} size="xs" />
                  <span className="card-body">
                    <span className="card-name">{item.card.name}</span>
                    <span className={`val${item.total ? '' : ' zero'}`}>
                      {formatMoney(item.total)}
                    </span>
                    {(item.invoice.estimated ||
                      item.note ||
                      item.parts.length > 0) && (
                      <span className="card-sub">
                        {item.invoice.estimated && (
                          <span className="est">estimada</span>
                        )}
                        {item.note && <span className="note">{item.note}</span>}
                        {item.note && item.parts.length > 0 && ' · '}
                        {item.parts.map((part, index) => (
                          <span key={part}>
                            {index > 0 && ' · '}
                            <span className="part">{part}</span>
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                </button>
                <TrashButton
                  label={`fatura ${item.card.name}`}
                  onClick={() => onInvoiceDelete(item)}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {loose.length > 0 && (
        <>
          <GroupHead title="Parcelas" total={view.subtotals.loose} />
          <ul className="rows">
            {loose.map((item) => (
              <li
                className={`row${item.paid ? ' paid' : ''}`}
                key={item.plan.id}
              >
                <CheckButton
                  checked={item.paid}
                  label={item.plan.description}
                  onChange={(paid) => onLoosePaid(item, paid)}
                />
                <button
                  type="button"
                  className="row-main"
                  onClick={() => onLooseOpen(item)}
                >
                  <CategoryBadge category={category(item.plan.categoryId)} />
                  <span className="desc">
                    {item.plan.description}
                    <span className="sub">
                      {[
                        `${item.number}/${item.totalInstallments}`,
                        item.remaining ? `faltam ${item.remaining}` : 'quitado',
                        item.plan.note,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <span className="val">{formatMoney(item.amount)}</span>
                </button>
                <span className="trash-space" />
              </li>
            ))}
          </ul>
        </>
      )}

      {bills.length > 0 && (
        <>
          {(cards.length > 0 || loose.length > 0) && (
            <GroupHead title="Contas e outros" total={view.subtotals.bills} />
          )}
          <ul className="rows">
            {bills.map((bill) => (
              <li className={`row${bill.paid ? ' paid' : ''}`} key={bill.id}>
                <CheckButton
                  checked={bill.paid}
                  label={bill.description}
                  onChange={(paid) => onBillPaid(bill, paid)}
                />
                <button
                  type="button"
                  className="row-main"
                  onClick={() => onBill(bill)}
                >
                  <BillTile
                    paidFrom={bill.paidFrom}
                    category={category(bill.categoryId)}
                  />
                  <span className="desc">
                    {bill.description}
                    {paidFromName(bill.paidFrom) && (
                      <span className="sub">
                        {[
                          paidFromName(bill.paidFrom),
                          category(bill.categoryId)?.name,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    )}
                  </span>
                  <span className={`val${bill.amount ? '' : ' zero'}`}>
                    {formatMoney(bill.amount)}
                  </span>
                </button>
                <TrashButton
                  label={bill.description}
                  onClick={() => onBillDelete(bill)}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {view.outflowCount === 0 && (
        <p className="empty-hint">Nenhuma saída ainda. {EMPTY}</p>
      )}
    </div>
  )
}
