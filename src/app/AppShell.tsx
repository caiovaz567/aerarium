import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useMatch } from 'react-router'
import { useFinance } from '../data/useFinance'
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

const SYNC_TEXT = { ok: 'Salvo', saving: 'Salvando…', error: 'Não salvou' }

function SyncStatus() {
  const state = useSyncState()
  return (
    <span className="sync" data-state={state} role="status">
      {SYNC_TEXT[state]}
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

export function AppShell() {
  const [launching, setLaunching] = useState(false)
  const finance = useFinance()
  const toast = useToast()
  const inMonths = useMatch('/meses/:ym')
  const openLaunch = () => {
    // Like v1: nothing to put things in yet.
    if (finance.data && !finance.data.months.length)
      return toast('Crie um mês primeiro, na aba Meses.')
    // Opens right away; the form shows up as soon as the data arrives.
    setLaunching(true)
  }
  return (
    <>
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
        <Outlet />
      </main>
      {launching && finance.data && (
        <LaunchModal
          finance={finance.data}
          openMonth={parseMonth(inMonths?.params.ym)}
          onClose={() => setLaunching(false)}
        />
      )}
    </>
  )
}
