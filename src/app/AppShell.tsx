import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useMatch } from 'react-router'
import { categoryOps } from '../data/categoryOps'
import { useBankAutoSync } from '../features/banco/useBank'
import { pendingReview } from '../features/banco/review'
import { ReviewModal } from '../features/banco/ReviewModal'
import type { Finance } from '../data/finance'
import { useFinance, useFinanceOp } from '../data/useFinance'
import { EditorProvider } from '../features/editar/EditorProvider'
import { ExcelButton } from '../features/exportar/ExcelButton'
import { LaunchModal } from '../features/lancar/LaunchModal'
import { useToast } from '../ui/toastContext'
import { parseMonth } from './paths'
import { Brand } from '../ui/Brand'
import {
  CalendarIcon,
  CardIcon,
  GearIcon,
  PlusIcon,
  RepeatIcon,
} from '../ui/icons'
import { useSyncState } from './syncContext'
import { useOnline } from './useOnline'

const SYNC_TEXT = { ok: 'Salvo', saving: 'Salvando…', error: 'Não salvou' }

function SyncStatus() {
  const state = useSyncState()
  const online = useOnline()
  // Offline, nothing can be saved: say that instead of a stale "Salvo".
  const shown = online ? state : 'offline'
  return (
    <span className="sync" data-state={shown} role="status">
      {online ? SYNC_TEXT[state] : 'Sem internet'}
    </span>
  )
}

function Header() {
  const header = useRef<HTMLElement>(null)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const node = header.current!
    // Sticky bars sit right below the header, whatever its height.
    const measure = () =>
      document.documentElement.style.setProperty(
        '--top-h',
        `${node.offsetHeight}px`,
      )
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return (
    <header ref={header} className={`app-header${scrolled ? ' scrolled' : ''}`}>
      <div className="app-header-inner">
        <Brand />
        <SyncStatus />
        <ExcelButton />
        {/* On phones, Ajustes lives in the bottom bar instead. */}
        <Link
          className="icon-button header-config"
          to="/config"
          aria-label="Ajustes"
        >
          <GearIcon />
        </Link>
      </div>
    </header>
  )
}

/**
 * Fase 11: the first time there are no categories, create the default list and
 * apply the name suggestion once to what already exists. Once per session.
 */
function useCategorySetup(finance: Finance | undefined) {
  const run = useFinanceOp()
  const started = useRef(false)
  useEffect(() => {
    if (!finance || finance.categories.length || started.current) return
    started.current = true
    run(categoryOps.setup(finance))
  }, [finance, run])
}

/**
 * Fase 13.3: when purchases from the bank wait to be checked, "Chegou do
 * banco" opens by itself once per session; a banner in Meses reopens it.
 */
function useReview(finance: Finance | undefined) {
  const pending = finance ? pendingReview(finance).length : 0
  const [open, setOpen] = useState(false)
  const shown = useRef(false)
  useEffect(() => {
    if (!pending || shown.current) return
    shown.current = true
    setOpen(true)
  }, [pending])
  return { pending, open: open && pending > 0, setOpen }
}

export function AppShell() {
  const [launching, setLaunching] = useState(false)
  const finance = useFinance()
  useCategorySetup(finance.data)
  const toast = useToast()
  useBankAutoSync(finance.data, toast)
  const review = useReview(finance.data)
  const inMonths = useMatch('/meses/:ym')
  const openLaunch = () => {
    // Like v1: nothing to put things in yet.
    if (finance.data && !finance.data.months.length)
      return toast('Crie um mês primeiro, na aba Meses.')
    // Opens right away; the form shows up as soon as the data arrives.
    setLaunching(true)
  }
  return (
    <EditorProvider>
      <a className="skip-link" href="#conteudo">
        Ir para o conteúdo
      </a>
      <Header />
      <nav className="tabs" aria-label="Seções">
        <NavLink className="tab" to="/meses">
          <CalendarIcon />
          Meses
        </NavLink>
        <NavLink className="tab" to="/cartoes">
          <CardIcon />
          Cartões
        </NavLink>
        <button
          type="button"
          className="tab-add"
          aria-label="Lançar gasto ou entrada"
          onClick={openLaunch}
        >
          <PlusIcon />
          <span>Lançar</span>
        </button>
        <NavLink className="tab" to="/assinaturas">
          <RepeatIcon />
          Assinaturas
        </NavLink>
        <NavLink className="tab tab-config" to="/config">
          <GearIcon />
          Ajustes
        </NavLink>
      </nav>
      <main id="conteudo" className="app-content" tabIndex={-1}>
        {review.pending > 0 && inMonths && (
          <button
            type="button"
            className="review-banner"
            onClick={() => review.setOpen(true)}
          >
            <b>
              {review.pending === 1
                ? '1 compra nova do banco'
                : `${review.pending} compras novas do banco`}
            </b>
            <span>Conferir</span>
          </button>
        )}
        <Outlet />
      </main>
      {review.open && finance.data && (
        <ReviewModal
          finance={finance.data}
          onClose={() => review.setOpen(false)}
        />
      )}
      {launching && finance.data && (
        <LaunchModal
          finance={finance.data}
          openMonth={parseMonth(inMonths?.params.ym)}
          onClose={() => setLaunching(false)}
        />
      )}
    </EditorProvider>
  )
}
