import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../app/authContext'
import {
  askBankUpdate,
  bankOps,
  bankStatus,
  fetchBank,
  importSummary,
  planSync,
  syncFrom,
  type BankData,
} from '../../data/bank'
import { financeKey, type Finance } from '../../data/finance'
import { today, useFinanceOp } from '../../data/useFinance'
import type { ImportResult } from '../../domain/bank'
import type { ShowToast } from '../../ui/toastContext'
import { saveItems } from './bankItems'
import { billNotices } from './billNotice'

/** Asked once per session; only the app's owner gets true. */
let status: Promise<boolean> | null = null
const LAST = 'aerarium.banco.ultima'

export function lastSync(): Date | null {
  try {
    const saved = localStorage.getItem(LAST)
    return saved ? new Date(saved) : null
  } catch {
    return null
  }
}
function markSynced() {
  try {
    localStorage.setItem(LAST, new Date().toISOString())
  } catch {
    /* private mode: synced again next time */
  }
}

/** Whether this account has Open Finance (null while asking). */
export function useBankEnabled(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  useEffect(() => {
    status ??= bankStatus().catch(() => false)
    let alive = true
    void status.then((value) => alive && setEnabled(value))
    return () => {
      alive = false
    }
  }, [])
  return enabled
}

export interface SyncOutcome {
  readonly data: BankData
  readonly result: ImportResult
  /** First import ever: the person sees a preview before anything is saved. */
  readonly first: boolean
  /** What the import was planned against. */
  readonly finance: Finance
}

/**
 * Fetches the bank, adds bank cards seen for the first time and plans the
 * import against the latest data. Saving is a separate step (`save`).
 */
export function useBankSync() {
  const client = useQueryClient()
  const run = useFinanceOp()
  const auth = useAuth()
  const userId = auth.status === 'signed-in' ? auth.session.user.id : ''

  const fetchPlan = useCallback(async (): Promise<SyncOutcome> => {
    const data = await fetchBank(syncFrom(today()))
    saveItems(data.items ?? [])
    let finance = client.getQueryData<Finance>(financeKey(userId))!
    const add = bankOps.addAccounts(finance, data)
    if (add) {
      run(add)
      finance = add.apply(finance)
    }
    const limits = bankOps.updateLimits(finance, data)
    if (limits) {
      run(limits)
      finance = limits.apply(finance)
    }
    const days = bankOps.fillCardDays(finance, data)
    if (days) {
      run(days)
      finance = days.apply(finance)
    }
    markSynced()
    return {
      data,
      result: planSync(finance, data, today()),
      first: finance.bankRecords.length === 0,
      finance,
    }
  }, [client, run, userId])

  const save = useCallback(
    (result: ImportResult) => {
      // Bank totals come without records: they count as something to save.
      if (
        result.records.length ||
        result.bankTotals.length ||
        result.invoiceTotals.length ||
        result.moves.length
      )
        run(bankOps.apply(result))
    },
    [run],
  )

  return { fetchPlan, save }
}

/** How often an open app looks at the bank by itself (it updates daily). */
export const AUTO_SYNC_MS = 6 * 60 * 60 * 1000
/** After asking the bank for a look, how long until its answer is there. */
const ASK_WAIT_MS = 2 * 60 * 1000

/** "3 compras novas, 1 parcelamento e 2 que você já tinha lançado". */
export function importMessage(result: ImportResult): string {
  const summary = importSummary(result)
  const parts = [
    summary.expenses &&
      `${summary.expenses} ${summary.expenses === 1 ? 'compra nova' : 'compras novas'}`,
    summary.plans &&
      `${summary.plans} ${summary.plans === 1 ? 'parcelamento novo' : 'parcelamentos novos'}`,
    summary.matched && `${summary.matched} que você já tinha lançado`,
    summary.subscriptions &&
      `${summary.subscriptions} ${summary.subscriptions === 1 ? 'cobrança de assinatura' : 'cobranças de assinaturas'}`,
    summary.bills &&
      `${summary.bills} ${summary.bills === 1 ? 'fatura fechada' : 'faturas fechadas'}`,
  ].filter((part): part is string => Boolean(part))
  if (!parts.length) return 'Nada novo no banco.'
  const last = parts.pop()!
  return `${parts.length ? `${parts.join(', ')} e ` : ''}${last}.`
}

/**
 * On opening the app (owner only): after the first import, look at the bank
 * by itself when the last look is older than AUTO_SYNC_MS, save straight away
 * (the user's choice) and say what came in.
 */
export function useBankAutoSync(
  finance: Finance | undefined,
  toast: ShowToast,
) {
  const enabled = useBankEnabled()
  const { fetchPlan, save } = useBankSync()
  const navigate = useNavigate()
  const started = useRef(false)
  const again = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!enabled || !finance || started.current) return
    // The first import is done by hand, with a preview.
    if (!finance.bankRecords.length) return
    const last = lastSync()
    if (last && Date.now() - last.getTime() < AUTO_SYNC_MS) return
    started.current = true
    const look = () =>
      fetchPlan()
        .then(({ result, finance: before }) => {
          save(result)
          // A closed bill is told on its own, with a way to see it.
          const bills = billNotices(bankOps.apply(result).apply(before), result)
          if (bills.length) {
            const { cardId, month } = bills[0]!
            toast(bills.map((item) => item.message).join(' '), {
              label: 'Ver',
              onClick: () => navigate(`/cartoes?mes=${month}&cartao=${cardId}`),
            })
          } else if (
            result.expenses.length ||
            result.plans.length ||
            result.notices.length
          )
            toast([importMessage(result), ...result.notices].join(' '))
        })
        .catch(() => {
          /* offline or bank down: tried again next time */
        })
    // Pluggy looks at the bank once a day: ask for a look now, take what
    // there is, and look again once the bank has had time to answer.
    void askBankUpdate()
      .catch(() => false)
      .then((asked) => {
        void look()
        if (asked) again.current = window.setTimeout(look, ASK_WAIT_MS)
      })
  }, [enabled, finance, fetchPlan, save, toast, navigate])
  useEffect(() => () => window.clearTimeout(again.current), [])
}
