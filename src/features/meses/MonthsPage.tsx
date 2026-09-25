import { Link, Navigate, useParams } from 'react-router'
import { currentMonth, monthPath } from '../../app/paths'
import { addMonths, month, monthName, type Month } from '../../domain/months'
import { ChevronLeftIcon, ChevronRightIcon } from '../../ui/icons'
import { EmptyState } from '../../ui/EmptyState'
import { StickyBar } from '../../ui/StickyBar'

function parseMonth(value: string | undefined): Month | null {
  try {
    return value ? month(value) : null
  } catch {
    return null
  }
}

export function MonthsPage() {
  const { ym } = useParams()
  const selected = parseMonth(ym)
  if (!selected) return <Navigate to={monthPath(currentMonth())} replace />
  return (
    <>
      <h2 className="visually-hidden">Meses</h2>
      <StickyBar className="monthbar">
        <Link
          className="icon-button"
          to={monthPath(addMonths(selected, -1))}
          aria-label="Mês anterior"
        >
          <ChevronLeftIcon />
        </Link>
        <p className="monthname">
          {monthName(selected)}
          <small>{selected.slice(0, 4)}</small>
        </p>
        <Link
          className="icon-button"
          to={monthPath(addMonths(selected, 1))}
          aria-label="Próximo mês"
        >
          <ChevronRightIcon />
        </Link>
      </StickyBar>
      <EmptyState title="Em construção">
        Entradas, saídas e faturas de {monthName(selected).toLowerCase()} chegam
        aqui na próxima etapa.
      </EmptyState>
    </>
  )
}
