import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../data/supabase'
import { AuthContext, type AuthState } from './authContext'
import { localAccount } from './localAccount'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })
  const queryClient = useQueryClient()

  useEffect(() => {
    const auth = supabase().auth
    let recovery = false
    // onAuthStateChange also reports the initial session (INITIAL_SESSION).
    const { data } = auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') recovery = true
      if (event === 'USER_UPDATED') recovery = false
      if (event === 'SIGNED_OUT') {
        recovery = false
        // Never show one person's cached data to the next.
        queryClient.clear()
      }
      // npm run local: the demo account signs in by itself when the app
      // opens (not after "Sair"); the screen keeps loading meanwhile.
      const local = localAccount(import.meta.env)
      if (event === 'INITIAL_SESSION' && !session && local) {
        void auth.signInWithPassword(local).then(({ error }) => {
          if (error) setState({ status: 'signed-out' })
        })
        return
      }
      setState(
        session
          ? { status: 'signed-in', session, recovery }
          : { status: 'signed-out' },
      )
    })
    return () => data.subscription.unsubscribe()
  }, [queryClient])

  return <AuthContext value={state}>{children}</AuthContext>
}
