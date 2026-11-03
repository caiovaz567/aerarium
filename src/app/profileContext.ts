import { createContext, use } from 'react'

// Whose spending Meses and Cartões show: yours, the other person's ("other") or
// that of someone in your list (their id). Remembered per device (a convenience).
export type Profile = string
export const PROFILE_KEY = 'aerarium.perfil'

export const ProfileContext = createContext<{
  readonly profile: Profile
  readonly setProfile: (profile: Profile) => void
}>({ profile: 'me', setProfile: () => {} })

/** The profile in effect: only someone who is still there. */
export function useProfile(
  finance:
    | {
        readonly otherPerson?: string | null
        readonly people?: readonly { readonly id: string }[]
      }
    | undefined,
) {
  const { profile, setProfile } = use(ProfileContext)
  const there =
    profile === 'other'
      ? Boolean(finance?.otherPerson)
      : Boolean(finance?.people?.some((item) => item.id === profile))
  return { profile: there ? profile : 'me', setProfile } as const
}
