import { useProfile } from '../../app/profileContext'

/**
 * Fase 13.3: Eu | Pai at the top of Meses, only when someone else uses the
 * cards. Full width with finger-sized buttons (the header was too cramped).
 */
export function ProfileSwitch({ other }: { readonly other: string }) {
  const { profile, setProfile } = useProfile(other)
  return (
    <div
      className="segmented profile-switch"
      role="group"
      aria-label="Ver gastos de"
    >
      <button
        type="button"
        aria-pressed={profile === 'me'}
        onClick={() => setProfile('me')}
      >
        Eu
      </button>
      <button
        type="button"
        aria-pressed={profile === 'other'}
        onClick={() => setProfile('other')}
      >
        {other}
      </button>
    </div>
  )
}
