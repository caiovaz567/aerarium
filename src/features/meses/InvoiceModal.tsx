import { useState } from 'react'
import { Link } from 'react-router'
import type { Card, Finance, InvoiceRow } from '../../data/finance'
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
import { monthLabel } from '../../domain/months'
import { CardArt } from '../../ui/CardArt'
import { MoneyField, TextField } from '../../ui/controls'
import { Modal } from '../../ui/Modal'
import { readMoney } from './forms'
import { visibleNote } from './monthView'

export interface InvoiceChanges {
  readonly otherAmount: Cents
  readonly estimated: boolean
  readonly note: string | null
  readonly paid: boolean
  /** Fase 13.3: the whole invoice at the bank, on cards someone else uses. */
  readonly bankTotal?: Cents | null
}

/** Invoice summary: what comes by itself, launched expenses and the rest. */
export function InvoiceModal({
  invoice,
  card,
  finance,
  onClose,
  onSave,
}: {
  readonly invoice: InvoiceRow
  readonly card: Card
  readonly finance: Finance
  readonly onClose: () => void
  readonly onSave: (changes: InvoiceChanges) => void
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

  // Fase 13.3, owner only: what was marked the other person's.
  const isOther = (forOther: boolean | undefined) =>
    Boolean(finance.otherPerson && forOther)
  const his = sumMoney([
    ...finance.plans
      .filter(
        (plan) => plan.cardId === invoice.cardId && isOther(plan.forOther),
      )
      .flatMap((plan) =>
        installmentSchedule(plan, finance.payments)
          .filter((item) => item.month === invoice.month)
          .map((item) => item.amount),
      ),
    ...finance.expenses
      .filter((item) => item.invoiceId === invoice.id && isOther(item.forOther))
      .map((item) => item.amount),
  ])
  // Outros gastos and the note: tucked away, the bank fills most of it.
  const [editing, setEditing] = useState(false)

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
  const minePart = cents(Math.max(0, shownTotal - his))

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
        {/* Just the numbers; everything in it is on the card's page. */}
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

        {shared && (
          <MoneyField
            label="Total da fatura no banco"
            value={bank}
            onChange={setBank}
            hint={`O seu e o do ${finance.otherPerson}, juntos.`}
          />
        )}

        {editing ? (
          <>
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
                {totalMode
                  ? 'Digitar os outros gastos'
                  : 'Sei o total da fatura'}
              </button>
            </div>
            <TextField
              label="Observação (opcional)"
              value={note}
              onChange={setNote}
              placeholder="Ex.: iPhone 2/12, Lucas me deve 365,67"
            />
          </>
        ) : (
          <button
            type="button"
            className="link-button self-start"
            onClick={() => setEditing(true)}
          >
            Editar outros gastos e observação
          </button>
        )}
        <p className="form-error" role="alert">
          {error}
        </p>
        <Link className="btn ghost" to={`/cartoes/${card.id}`}>
          Ver tudo desse cartão
        </Link>
      </div>
    </Modal>
  )
}
