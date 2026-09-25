import { useState } from 'react'
import { today, useFinance } from '../../data/useFinance'
import { DownloadIcon } from '../../ui/icons'
import { useToast } from '../../ui/toastContext'
import { downloadExcel } from './workbook'

/** Header button that downloads everything as Aerarium_AAAA-MM-DD.xlsx. */
export function ExcelButton() {
  const finance = useFinance().data
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      className="excel-button"
      aria-label="Baixar tudo em Excel"
      disabled={!finance || busy}
      onClick={async () => {
        if (!finance) return
        setBusy(true)
        try {
          await downloadExcel(finance, today())
          toast('Excel baixado')
        } catch {
          toast('Não consegui montar o Excel. Tenta de novo.')
        } finally {
          setBusy(false)
        }
      }}
    >
      <DownloadIcon />
      Excel
    </button>
  )
}
