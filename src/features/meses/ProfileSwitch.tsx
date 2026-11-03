import { Link } from 'react-router'
import { useProfile } from '../../app/profileContext'
import type { Finance } from '../../data/finance'
import { PlusIcon } from '../../ui/icons'

/**
 * Eu | Pai | Vini at the top, only when someone else uses the cards. Finger-sized
 * buttons; with many people the row scrolls sideways.
 */
export function ProfileSwitch({ finance }: { readonly finance: Finance }) {
  const { profile, setProfile } = useProfile(finance)
  const options: [string, string][] = [
    ['me', 'Eu'],
    ...(finance.otherPerson
      ? ([['other', finance.otherPerson]] as [string, string][])
      : []),
    ...(finance.people ?? []).map((item): [string, string] => [
      item.id,
      item.name,
    ]),
  ]
  if (options.length < 2) return null
  return (
    <div
      className="segmented profile-switch"
      role="group"
      aria-label="Ver gastos de"
    >
      {options.map(([key, label]) => (
        <button
          type="button"
          key={key}
          aria-pressed={profile === key}
          onClick={() => setProfile(key)}
        >
          {label}
        </button>
      ))}
      <Link className="profile-add" to="/pessoas" aria-label="Pessoas">
        <PlusIcon />
      </Link>
    </div>
  )
}
