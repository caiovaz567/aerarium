import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

export type AuthState =
  | { readonly status: 'loading' }
  | { readonly status: 'signed-out' }
  | {
      readonly status: 'signed-in'
      readonly session: Session
      /** Opened from a password reset link. */
      readonly recovery: boolean
    }

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const state = useContext(AuthContext)
  if (!state) throw new Error('useAuth precisa do AuthProvider.')
  return state
}
