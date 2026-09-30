import { Link } from 'react-router'
import { currentMonth } from '../../app/paths'
import { useSharedWithMe } from '../../data/useShared'
import { formatMoney } from '../../domain/money'
import { monthName } from '../../domain/months'
import { ChevronRightIcon, PeopleIcon } from '../../ui/icons'
import { sharedDefaultMonth, sharedFinance, sharedMonth } from './sharedFinance'

/**
 * In Meses, for someone whose cards are shared with this account: "Cartões do
 * Caio", what is left to pay this month, and the way in. Nothing otherwise.
 */
export function SharedEntry() {
  const query = useSharedWithMe(false)
  const view = query.data?.[0]
  if (!view) return null
  const finance = sharedFinance(view)
  const ref = sharedDefaultMonth(finance, currentMonth())
  const due = ref ? sharedMonth(view, finance, ref).due : null
  return (
    <Link className="shared-entry" to="/compartilhado">
      <span className="settings-icon accent" aria-hidden="true">
        <PeopleIcon />
      </span>
      <span className="shared-entry-text">
        <b>Cartões do {view.ownerName}</b>
        <small>
          {ref && due !== null
            ? `${monthName(ref)}: falta pagar ${formatMoney(due)}`
            : 'Nada por enquanto'}
        </small>
      </span>
      <ChevronRightIcon />
    </Link>
  )
}
