import { useState, type ReactNode } from 'react'
import { PROFILE_KEY, ProfileContext, type Profile } from './profileContext'

function remembered(): Profile {
  try {
    return localStorage.getItem(PROFILE_KEY) === 'other' ? 'other' : 'me'
  } catch {
    return 'me'
  }
}

export function ProfileProvider({
  children,
}: {
  readonly children: ReactNode
}) {
  const [profile, set] = useState<Profile>(remembered)
  const setProfile = (next: Profile) => {
    set(next)
    try {
      localStorage.setItem(PROFILE_KEY, next)
    } catch {
      /* private mode: not remembered */
    }
  }
  return (
    <ProfileContext value={{ profile, setProfile }}>{children}</ProfileContext>
  )
}
