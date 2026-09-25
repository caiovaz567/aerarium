import type { Session } from '@supabase/supabase-js'
import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AuthContext, type AuthState } from '../app/authContext'
import { AppRoutes } from '../app/routes'
import { SyncContext } from '../app/syncContext'
import { financeKey, type Finance } from '../data/finance'
import { createQueryClient } from '../data/queryClient'
import { financeFixture } from './financeFixture'
import { ToastProvider } from '../ui/ToastProvider'

export const signedIn: AuthState = {
  status: 'signed-in',
  recovery: false,
  session: { user: { id: 'u1', email: 'teste@example.test' } } as Session,
}

/** The real routes with a fake session and fictitious data already loaded; no network. */
export function renderApp(
  path: string,
  auth: AuthState = signedIn,
  finance: Finance = financeFixture(),
) {
  const { client, sync } = createQueryClient()
  if (auth.status === 'signed-in')
    client.setQueryData(financeKey(auth.session.user.id), finance)
  return {
    client,
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
