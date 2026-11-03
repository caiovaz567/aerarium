import { useFinance } from '../../data/useFinance'
import { PeopleSection } from './PeopleSection'

/** Who uses your cards and who added you, reached from the "+" of the switch. */
export function PeoplePage() {
  const finance = useFinance().data
  return (
    <div className="settings">
      <h2 className="settings-title">Pessoas</h2>
      <PeopleSection otherPerson={finance?.otherPerson} />
    </div>
  )
}
