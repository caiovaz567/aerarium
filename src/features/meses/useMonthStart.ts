import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { currentMonth, monthPath } from '../../app/paths'
import type { Finance } from '../../data/finance'
import { ops } from '../../data/financeOps'
import { useFinanceOp } from '../../data/useFinance'
import { monthBalance } from '../../domain/balance'
import { formatMoney } from '../../domain/money'
import {
  addMonths,
  monthLabel,
  monthName,
  type Month,
} from '../../domain/months'
import { monthToStart } from '../../domain/newMonth'
import type { ShowToast } from '../../ui/toastContext'
import { buildNewMonth } from './monthView'

const STARTED_KEY = 'aerarium.mesIniciado'

/** The last month started by itself on this device: never twice. */
function lastStarted(): string | null {
  try {
    return localStorage.getItem(STARTED_KEY)
  } catch {
    return null
  }
}
function rememberStarted(value: Month) {
  try {
    localStorage.setItem(STARTED_KEY, value)
  } catch {
    /* private mode: the session still remembers it */
  }
}

/** Today's month, again when the app comes back (an installed app resumes). */
function useToday(): Month {
  const [today, setToday] = useState(currentMonth)
  useEffect(() => {
    const check = () => {
      if (document.visibilityState === 'visible') setToday(currentMonth())
    }
    document.addEventListener('visibilitychange', check)
    return () => document.removeEventListener('visibilitychange', check)
  }, [])
  return today
}

/**
 * A new month starts by itself (01/10/2026, for everyone): the first time the
 * app is open in it, the month is created like "Criar" does by default
 * (bills and incomes copied, the rest carried over) and opened, with Desfazer.
 * Once per month: a month deleted afterwards is not created again. With the
 * month already there, opening the app on the one that ended goes to it.
 */
export function useMonthStart(finance: Finance | undefined, toast: ShowToast) {
  const run = useFinanceOp()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const today = useToday()
  const started = useRef(new Set<Month>())
  const opened = useRef<Month | null>(null)
  useEffect(() => {
    if (!finance) return
    const refs = finance.months.map((item) => item.ref)
    // Seen already: deleting it later is the person's choice, kept.
    if (refs.includes(today)) started.current.add(today)
    // The app opens (or the month turns) on the month that just ended, as
    // where it was left: show today's. Once, so going back there stays.
    if (refs.includes(today) && opened.current !== today) {
      opened.current = today
      if (pathname === monthPath(addMonths(today, -1)))
        navigate(monthPath(today), { replace: true })
    }
    const next = monthToStart(refs, today)
    if (
      !next ||
      started.current.has(next.target) ||
      lastStarted() === next.target
    )
      return
    started.current.add(next.target)
    opened.current = next.target
    rememberStarted(next.target)
    const left = monthBalance(next.previous, finance).available
    const snapshot = buildNewMonth(finance, next.target, next.previous, {
      copy: true,
      carryover: true,
    })
    run(ops.createMonth(snapshot))
    toast(
      `${monthLabel(next.target)} começou: copiei ${monthName(next.previous).toLowerCase()} e levei a sobra de ${formatMoney(left)}`,
      {
        label: 'Desfazer',
        onClick: () => run(ops.removeMonth(snapshot)),
      },
    )
    // Looking at the month that ended (or opening the app): show the new one.
    if (pathname === '/' || pathname === monthPath(next.previous))
      navigate(monthPath(next.target), { replace: true })
  }, [finance, today, run, toast, navigate, pathname])
}
