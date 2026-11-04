import { Link } from 'react-router'
import type { SharedView } from '../../data/shared'
import { useSharedWithMe } from '../../data/useShared'
import { ChevronRightIcon, PeopleIcon } from '../../ui/icons'
import { sharedLine } from './sharedFinance'

/**
 * In Meses, for someone whose cards are shared with this account: "Cartões do
 * Caio", what is left to pay this month, and the way in, one per owner. Nothing
 * otherwise.
 */
export function SharedEntry() {
  const query = useSharedWithMe(false)
  const views = query.data ?? []
  return views.map((view) => (
    <OneEntry
      key={view.ownerId}
      view={view}
      to={
        views.length > 1
          ? `/compartilhado?de=${view.ownerId}`
          : '/compartilhado'
      }
    />
  ))
}

function OneEntry({
  view,
  to,
}: {
  readonly view: SharedView
  readonly to: string
}) {
  return (
    <Link className="shared-entry" to={to}>
      <span className="settings-icon accent" aria-hidden="true">
        <PeopleIcon />
      </span>
      <span className="shared-entry-text">
        <b>Cartões do {view.ownerName}</b>
        <small>{sharedLine(view)}</small>
      </span>
      <ChevronRightIcon />
    </Link>
  )
}
