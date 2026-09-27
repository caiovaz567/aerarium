import { useState } from 'react'
import { Link } from 'react-router'
import type { Card, ExpenseRow, Finance, InvoiceRow } from '../../data/finance'
import { installmentSchedule } from '../../domain/installments'
import { invoiceTotals, setInvoiceTotal } from '../../domain/invoices'
import {
  formatMoney,
  formatMoneyInput,
  parseMoney,
  sumMoney,
  type Cents,
} from '../../domain/money'
import { dayMonth, monthLabel } from '../../domain/months'
import { CardArt } from '../../ui/CardArt'
import { CheckField, MoneyField, TextField } from '../../ui/controls'
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
}

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
  onOpenSubscription,
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
  readonly onOpenSubscription: (id: string) => void
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
  const [paid, setPaid] = useState(invoice.paid)
  const [error, setError] = useState('')

  const installments = finance.plans
    .filter((plan) => plan.cardId === invoice.cardId)
    .flatMap((plan) =>
      installmentSchedule(plan, finance.payments)
        .filter((item) => item.month === invoice.month)
        .map((item) => ({ plan, item })),
    )
  const subscriptions = finance.subscriptions.filter(
    (item) => item.cardId === invoice.cardId && item.active,
  )
  const expenses = finance.expenses.filter(
    (item) => item.invoiceId === invoice.id,
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
    onSave({
      otherAmount,
      estimated: invoice.estimated && !typed,
      note: note.trim() || null,
      paid,
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
        <div className="invoice-top">
          <CardArt card={card} />
          <div>
            <b>{card.name}</b>
            <small>
              Fatura de {monthLabel(invoice.month)}
              {invoice.estimated && (
                <>
                  {' · '}
                  <span className="est">estimada</span>
                </>
              )}
            </small>
          </div>
        </div>

        {installments.length + subscriptions.length > 0 ? (
          <div className="invoice-sec">
            <small>Já entram sozinhas</small>
            <ul className="invoice-list">
              {installments.map(({ plan, item }) => (
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
              ))}
              {subscriptions.map((item) => (
                <li key={item.id} className="clickable">
                  <button
                    type="button"
                    onClick={() => onOpenSubscription(item.id)}
                  >
                    <i className="dot subscription" />
                    <span>
                      {item.name}
                      <small>assinatura · dia {item.chargeDay}</small>
                    </span>
                    <b>{formatMoney(item.amount)}</b>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="muted small">
            Nenhuma parcela ou assinatura nesse cartão este mês.
          </p>
        )}

        {expenses.length > 0 && (
          <div className="invoice-sec">
            <small>Gastos lançados</small>
            <ul className="invoice-list">
              {expenses.map((expense) => (
                <li key={expense.id} className="clickable">
                  <button type="button" onClick={() => onOpenExpense(expense)}>
                    <i className="dot other" />
                    <span>
                      {expense.description}
                      {isFreshFromBank(expense) && (
                        <span className="fresh-pill">novo</span>
                      )}
                      <small>{dayMonth(expense.spentOn)}</small>
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
              ))}
            </ul>
          </div>
        )}

        <div className="invoice-sec">
          <small>O resto da fatura</small>
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
            className="link"
            onClick={() => {
              setTotalMode(!totalMode)
              setError('')
            }}
          >
            {totalMode ? 'Digitar os outros gastos' : 'Sei o total da fatura'}
          </button>
        </div>

        <div className="invoice-sum">
          <span>Total da fatura</span>
          <b className={impossible ? 'bad' : ''}>{formatMoney(shownTotal)}</b>
        </div>
        {invoice.paid &&
          invoice.closedTotal !== null &&
          invoice.closedTotal !== parts.calculatedTotal && (
            <p className="muted small">
              Foi paga com {formatMoney(invoice.closedTotal)}. As partes hoje
              somam {formatMoney(parts.calculatedTotal)}.
            </p>
          )}

        <TextField
          label="Observação (opcional)"
          value={note}
          onChange={setNote}
          placeholder="Ex.: iPhone 2/12, Lucas me deve 365,67"
        />
        <CheckField label="Já paguei" checked={paid} onChange={setPaid} />
        <p className="form-error" role="alert">
          {error}
        </p>
        <Link className="btn ghost self-start" to={`/cartoes/${card.id}`}>
          Ver cartão
        </Link>
      </div>
    </Modal>
  )
}
