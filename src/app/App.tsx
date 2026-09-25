import { QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { BrowserRouter } from 'react-router'
import { createQueryClient } from '../data/queryClient'
import { ToastProvider } from '../ui/ToastProvider'
import { AuthProvider } from './AuthProvider'
import { AppRoutes } from './routes'
import { SyncContext } from './syncContext'
import { UpdatePrompt } from './UpdatePrompt'

export function App() {
  const [{ client, sync }] = useState(createQueryClient)
  return (
    <QueryClientProvider client={client}>
      <SyncContext value={sync}>
        <AuthProvider>
          <ToastProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
            <UpdatePrompt />
          </ToastProvider>
        </AuthProvider>
      </SyncContext>
    </QueryClientProvider>
  )
}
