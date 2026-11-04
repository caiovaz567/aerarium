import { useFinance } from '../../data/useFinance'
import { PeopleSection } from './PeopleSection'

/** Everything about other people, reached from the "+" of the switch. */
export function PeoplePage() {
  const finance = useFinance().data
  return (
    <div className="settings">
      <h2 className="settings-title">Pessoas</h2>
      <PeopleSection finance={finance} />
    </div>
  )
}
