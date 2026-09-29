import { createContext, use } from 'react'

// Fase 13.3, only for the owner with someone else using the cards: whose
// spending Meses shows. Remembered per device (a convenience).
export type Profile = 'me' | 'other'
export const PROFILE_KEY = 'aerarium.perfil'

export const ProfileContext = createContext<{
  readonly profile: Profile
  readonly setProfile: (profile: Profile) => void
}>({ profile: 'me', setProfile: () => {} })

/** The profile in effect: "other" only while someone else is set. */
export function useProfile(otherPerson: string | null | undefined) {
  const { profile, setProfile } = use(ProfileContext)
  return { profile: otherPerson ? profile : 'me', setProfile } as const
}
