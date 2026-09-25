import type { Session } from '@supabase/supabase-js'
import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AuthContext, type AuthState } from '../app/authContext'
import { AppRoutes } from '../app/routes'
import { SyncContext } from '../app/syncContext'
import { createQueryClient } from '../data/queryClient'
import { ToastProvider } from '../ui/ToastProvider'

export const signedIn: AuthState = {
  status: 'signed-in',
  recovery: false,
  session: { user: { email: 'teste@example.test' } } as Session,
}

/** The real routes with a fake session; no network. */
export function renderApp(path: string, auth: AuthState = signedIn) {
  const { client, sync } = createQueryClient()
  return {
    sync,
    ...render(
      <QueryClientProvider client={client}>
        <SyncContext value={sync}>
          <AuthContext value={auth}>
            <ToastProvider>
              <MemoryRouter initialEntries={[path]}>
                <AppRoutes />
              </MemoryRouter>
            </ToastProvider>
          </AuthContext>
        </SyncContext>
      </QueryClientProvider>,
    ),
  }
}
