import type { InvoiceRow } from '../../data/finance'
import { ops } from '../../data/financeOps'
import { today, useFinanceOp } from '../../data/useFinance'
import { useToast } from '../../ui/toastContext'
import type { InvoiceChanges } from './InvoiceModal'

/** Saves what the invoice window changed (Meses and Cartões). */
export function useSaveInvoice() {
  const run = useFinanceOp()
  const toast = useToast()
  return (
    invoice: InvoiceRow,
    { paid, bankTotal, ...changes }: InvoiceChanges,
  ) => {
    run(ops.updateInvoice(invoice, changes))
    if (bankTotal !== undefined && bankTotal !== (invoice.bankTotal ?? null))
      run(ops.setBankTotal(invoice, bankTotal))
    if (paid !== invoice.paid) run(ops.invoicePaid(invoice, paid, today()))
    toast('Salvo')
  }
}
