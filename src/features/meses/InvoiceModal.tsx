import { chargedIn } from '../../domain/cardDates'
import { useState } from 'react'
import { Link } from 'react-router'
import type { Card, ExpenseRow, Finance, InvoiceRow } from '../../data/finance'
import { installmentSchedule } from '../../domain/installments'
import {
  bankFillsOther,
  invoiceTotals,
  setInvoiceTotal,
} from '../../domain/invoices'
import {
  cents,
  formatMoney,
  formatMoneyInput,
  parseMoney,
  sumMoney,
  type Cents,
} from '../../domain/money'
import { dayMonth, monthLabel } from '../../domain/months'
import { CardArt } from '../../ui/CardArt'
import { MoneyField, TextField } from '../../ui/controls'
import { CloseIcon } from '../../ui/icons'
import { Modal } from '../../ui/Modal'
import { readMoney } from './forms'
import { isFreshFromBank } from './outflowText'
import { visibleNote } from './monthView'

export interface InvoiceChanges {
  readonly otherAmount: Cents
  readonly estimated: boolean
  readonly note: string | null
  readonly paid: boolean
  /** Fase 13.3: the whole invoice at the bank, on cards someone else uses. */
  readonly bankTotal?: Cents | null
}

const count = (value: number, one: string, many: string) =>
  value ? `${value} ${value === 1 ? one : many}` : null

/** Invoice summary: what comes by itself, launched expenses and the rest. */
export function InvoiceModal({
  invoice,
  card,
  finance,
  onClose,
  onSave,
  onRemoveExpense,
  onOpenExpense,
  onOpenPlan,
}: {
  readonly invoice: InvoiceRow
  readonly card: Card
  readonly finance: Finance
  readonly onClose: () => void
  readonly onSave: (changes: InvoiceChanges) => void
  readonly onRemoveExpense: (expense: ExpenseRow) => void
  /** Fase 11: edit a launched expense (description, value, category). */
  readonly onOpenExpense: (expense: ExpenseRow) => void
  /** Tapping an item opens it. */
  readonly onOpenPlan: (id: string) => void
}) {
  const parts = invoiceTotals(invoice, finance)
  const fixed = sumMoney([
    parts.installmentsAmount,
    parts.subscriptionsAmount,
    parts.expensesAmount,
  ])
  const [other, setOther] = useState(formatMoneyInput(invoice.otherAmount))
  const [totalMode, setTotalMode] = useState(false)
  const [total, setTotal] = useState(
    formatMoneyInput(sumMoney([fixed, invoice.otherAmount])),
  )
  const [note, setNote] = useState(visibleNote(invoice.note, card) ?? '')
  const [error, setError] = useState('')
  // Fase 13.3, owner only: in old months the bank total gives the other
  // person the rest of the invoice.
  const shared = bankFillsOther(invoice.month, finance)
  const [bank, setBank] = useState(
    invoice.bankTotal == null ? '' : formatMoneyInput(invoice.bankTotal),
  )

  const installments = finance.plans
    .filter((plan) => plan.cardId === invoice.cardId)
    .flatMap((plan) =>
      installmentSchedule(plan, finance.payments)
        .filter((item) => item.month === invoice.month)
        .map((item) => ({ plan, item })),
    )
  const subscriptions = finance.subscriptions.filter(
    (item) => item.cardId === invoice.cardId && chargedIn(item, invoice.month),
  )
  const expenses = finance.expenses.filter(
    (item) => item.invoiceId === invoice.id,
  )

  // Fase 13.3, owner only: what the other person bought is listed apart.
  const isOther = (forOther: boolean | undefined) =>
    Boolean(finance.otherPerson && forOther)
  const mineInstallments = installments.filter(
    ({ plan }) => !isOther(plan.forOther),
  )
  const otherInstallments = installments.filter(({ plan }) =>
    isOther(plan.forOther),
  )
  const automatic = sumMoney([
    ...mineInstallments.map(({ item }) => item.amount),
    ...subscriptions.map((item) => item.amount),
  ])
  const mineExpenses = expenses.filter((item) => !isOther(item.forOther))
  const otherExpenses = expenses.filter((item) => isOther(item.forOther))

  const installmentRow = ({ plan, item }: (typeof installments)[number]) => (
    <li key={plan.id} className="clickable">
      <button type="button" onClick={() => onOpenPlan(plan.id)}>
        <i className="dot installment" />
        <span>
          {plan.description}
          <small>
            {item.paidOn
              ? `paga em ${dayMonth(item.paidOn)}`
              : `parcela ${item.number}/${item.totalInstallments}`}
          </small>
        </span>
        <b>{formatMoney(item.amount)}</b>
      </button>
    </li>
  )
  const expenseRow = (expense: (typeof expenses)[number]) => (
    <li key={expense.id} className="clickable">
      <button type="button" onClick={() => onOpenExpense(expense)}>
        <i className="dot other" />
        <span>
          {expense.description}
          {isFreshFromBank(expense) && <span className="fresh-pill">novo</span>}
          <small>
            {[expense.note, dayMonth(expense.spentOn)]
              .filter(Boolean)
              .join(' · ')}
          </small>
        </span>
        <b>{formatMoney(expense.amount)}</b>
      </button>
      <button
        type="button"
        className="remove"
        aria-label={`Remover ${expense.description}`}
        onClick={() => onRemoveExpense(expense)}
      >
        <CloseIcon />
      </button>
    </li>
  )

  const safe = (text: string) => {
    try {
      return parseMoney(text)
    } catch {
      return null
    }
  }
  const typedTotal = totalMode ? safe(total) : null
  const typedOther = safe(other) ?? 0
  const shownTotal = typedTotal ?? sumMoney([fixed, typedOther as Cents])
  const impossible = typedTotal !== null && typedTotal < fixed
  // Yours: the total minus what was marked the other person's.
  const minePart = cents(
    Math.max(
      0,
      shownTotal -
        sumMoney([
          ...otherInstallments.map(({ item }) => item.amount),
          ...otherExpenses.map((item) => item.amount),
        ]),
    ),
  )

  // The other person's part, following the bank total as it is typed.
  const otherShare = shared
    ? invoiceTotals({ ...invoice, bankTotal: safe(bank) }, finance).otherShare
    : parts.otherShare

  const save = () => {
    let otherAmount: Cents
    if (totalMode) {
      const read = readMoney(total)
      if ('error' in read) return setError(read.error)
      try {
        otherAmount = setInvoiceTotal(invoice, read.amount, finance).otherAmount
      } catch (reason) {
        return setError((reason as Error).message)
      }
    } else {
      const read = other.trim() ? readMoney(other) : { amount: 0 as Cents }
      if ('error' in read) return setError(read.error)
      otherAmount = read.amount
    }
    const typed = totalMode || otherAmount !== invoice.otherAmount
    let bankTotal: Cents | null = null
    if (shared && bank.trim()) {
      const read = readMoney(bank)
      if ('error' in read) return setError(read.error)
      bankTotal = read.amount
    }
    onSave({
      otherAmount,
      estimated: invoice.estimated && !typed,
      note: note.trim() || null,
      paid: invoice.paid,
      ...(shared && { bankTotal }),
    })
  }

  return (
    <Modal
      title={`Fatura ${card.name}`}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn primary" onClick={save}>
            Salvar
          </button>
        </>
      }
    >
      <div className="invoice">
        {/* The total first; the card's name is already the title. */}
        <div className="invoice-top">
          <CardArt card={card} />
          <div>
            <b>{monthLabel(invoice.month)}</b>
            {invoice.estimated && <span className="est">estimada</span>}
          </div>
        </div>
        <div className="invoice-sum">
          <span>Total da fatura</span>
          <b className={impossible ? 'bad' : ''}>{formatMoney(shownTotal)}</b>
        </div>
        {finance.otherPerson && otherShare > 0 && (
          <p className="invoice-split">
            <span>
              Sua parte <b>{formatMoney(minePart)}</b>
            </span>
            <span>
              {finance.otherPerson} <b>{formatMoney(otherShare)}</b>
            </span>
          </p>
        )}
        {invoice.paid &&
          invoice.closedTotal !== null &&
          invoice.closedTotal !== parts.calculatedTotal && (
            <p className="muted small">
              Foi paga com {formatMoney(invoice.closedTotal)}. As partes hoje
              somam {formatMoney(parts.calculatedTotal)}.
            </p>
          )}

        {/* What makes it up, in one list: what comes by itself (listed on
            the card's page), then what was launched. */}
        {mineInstallments.length + subscriptions.length + mineExpenses.length >
          0 && (
          <ul className="invoice-list">
            {mineInstallments.length + subscriptions.length > 0 && (
              <li>
                <Link className="invoice-auto" to={`/cartoes/${card.id}`}>
                  <i className="dot installment" />
                  <span>
                    {[
                      count(mineInstallments.length, 'parcela', 'parcelas'),
                      count(subscriptions.length, 'assinatura', 'assinaturas'),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    <small>Entram sozinhas · ver no cartão</small>
                  </span>
                  <b>{formatMoney(automatic)}</b>
                </Link>
              </li>
            )}
            {mineExpenses.map(expenseRow)}
          </ul>
        )}

        {otherInstallments.length + otherExpenses.length > 0 && (
          <div className="invoice-sec">
            <small>Do {finance.otherPerson}</small>
            <ul className="invoice-list">
              {otherInstallments.map(installmentRow)}
              {otherExpenses.map(expenseRow)}
            </ul>
          </div>
        )}

        <div className="invoice-sec">
          {totalMode ? (
            <MoneyField
              label="Total da fatura"
              value={total}
              onChange={setTotal}
              hint="Os outros gastos são calculados a partir dele."
              autoFocus
            />
          ) : (
            <MoneyField
              label="Outros gastos"
              value={other}
              onChange={setOther}
            />
          )}
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setTotalMode(!totalMode)
              setError('')
            }}
          >
            {totalMode ? 'Digitar os outros gastos' : 'Sei o total da fatura'}
          </button>
        </div>

        {shared && (
          <MoneyField
            label="Total da fatura no banco"
            value={bank}
            onChange={setBank}
            hint={`O seu e o do ${finance.otherPerson}, juntos.`}
          />
        )}

        <TextField
          label="Observação (opcional)"
          value={note}
          onChange={setNote}
          placeholder="Ex.: iPhone 2/12, Lucas me deve 365,67"
        />
        <p className="form-error" role="alert">
          {error}
        </p>
      </div>
    </Modal>
  )
}
