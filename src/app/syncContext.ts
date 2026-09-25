import { createContext, useContext, useSyncExternalStore } from 'react'
import type { SyncState, SyncTracker } from '../data/queryClient'

export const SyncContext = createContext<SyncTracker | null>(null)

export function useSyncState(): SyncState {
  const tracker = useContext(SyncContext)
  if (!tracker) throw new Error('useSyncState precisa do SyncContext.')
  return useSyncExternalStore(tracker.subscribe, tracker.getSnapshot)
}
