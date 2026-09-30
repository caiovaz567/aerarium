import { useState } from 'react'
import type { Card, Finance, InvoiceRow } from '../../data/finance'
import { invoiceTotals, setInvoiceTotal } from '../../domain/invoices'
import {
  formatMoney,
  formatMoneyInput,
  sumMoney,
  type Cents,
} from '../../domain/money'
import { monthName } from '../../domain/months'
import { MoneyField, TextField } from '../../ui/controls'
import { Modal } from '../../ui/Modal'
import { readMoney } from '../meses/forms'
import { visibleNote } from '../meses/monthView'

export interface OtherChanges {
  readonly otherAmount: Cents
  readonly estimated: boolean
  readonly note: string | null
}

/**
 * "Outros gastos" of an invoice: what it has beyond the purchases,
 * installments and subscriptions, typed as such or from the invoice total,
 * and the invoice's note. Everything else is on the Cartões screen.
 */
export function OtherModal({
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
  readonly onSave: (changes: OtherChanges) => void
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
    })
  }

  return (
    <Modal
      title={`Outros gastos · ${card.name}`}
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
      <div className="modal-form">
        <p className="muted">
          O que a fatura de {monthName(invoice.month).toLowerCase()} tem além
          das compras, parcelas e assinaturas ({formatMoney(fixed)}).
        </p>
        {totalMode ? (
          <MoneyField
            label="Total da fatura"
            value={total}
            onChange={setTotal}
            hint="Os outros gastos são calculados a partir dele."
            autoFocus
          />
        ) : (
          <MoneyField label="Outros gastos" value={other} onChange={setOther} />
        )}
        <button
          type="button"
          className="link-button self-start"
          onClick={() => {
            setTotalMode(!totalMode)
            setError('')
          }}
        >
          {totalMode ? 'Digitar os outros gastos' : 'Sei o total da fatura'}
        </button>
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
        <p className="form-error" role="alert">
          {error}
        </p>
      </div>
    </Modal>
  )
}
