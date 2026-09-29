import { useState } from 'react'
import type { InvoiceRow } from '../../data/finance'
import { ops } from '../../data/financeOps'
import { useFinanceOp } from '../../data/useFinance'
import { formatMoneyInput } from '../../domain/money'
import { MoneyField } from '../../ui/controls'
import { Modal } from '../../ui/Modal'
import { useToast } from '../../ui/toastContext'
import { readMoney } from '../meses/forms'

/**
 * Fase 13.3 (owner only): the whole invoice at the bank, typed from the card
 * page. The other person's part is it minus the owner's part.
 */
export function BankTotalModal({
  invoice,
  other,
  onClose,
}: {
  readonly invoice: InvoiceRow
  readonly other: string
  readonly onClose: () => void
}) {
  const run = useFinanceOp()
  const toast = useToast()
  const [value, setValue] = useState(
    invoice.bankTotal == null ? '' : formatMoneyInput(invoice.bankTotal),
  )
  const [error, setError] = useState('')
  const save = () => {
    if (!value.trim()) {
      run(ops.setBankTotal(invoice, null))
      onClose()
      return
    }
    const read = readMoney(value)
    if ('error' in read) return setError(read.error)
    run(ops.setBankTotal(invoice, read.amount))
    onClose()
    toast('Salvo')
  }
  return (
    <Modal
      title="Total da fatura no banco"
      onClose={onClose}
      actions={
        <>
          <span className="spacer" />
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
        <MoneyField
          label="Total da fatura no banco"
          value={value}
          onChange={setValue}
          hint={`O total com o que é seu e o que é do ${other}, como aparece no app do banco.`}
          autoFocus
        />
        <p className="form-error" role="alert">
          {error}
        </p>
      </div>
    </Modal>
  )
}
