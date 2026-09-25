import {
  MutationCache,
  QueryClient,
  type QueryKey,
} from '@tanstack/react-query'

export type SyncState = 'ok' | 'saving' | 'error'

/** Header status: saving while any write runs; error until the next write succeeds. */
export class SyncTracker {
  private pending = 0
  private failed = false
  private listeners = new Set<() => void>()

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  getSnapshot = (): SyncState =>
    this.pending > 0 ? 'saving' : this.failed ? 'error' : 'ok'

  started() {
    this.pending++
    this.emit()
  }
  finished(ok: boolean) {
    this.pending = Math.max(0, this.pending - 1)
    this.failed = !ok
    this.emit()
  }
  private emit() {
    for (const listener of this.listeners) listener()
  }
}

export function createQueryClient(sync = new SyncTracker()) {
  const client = new QueryClient({
    mutationCache: new MutationCache({
      onMutate: () => sync.started(),
      onSuccess: () => sync.finished(true),
      onError: () => sync.finished(false),
    }),
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1 },
      mutations: { retry: 0 },
    },
  })
  return { client, sync }
}

/**
 * Optimistic update for one cached query: apply on mutate, roll back on error,
 * refetch when settled. Business rules for `apply` live in src/domain.
 */
export function optimistic<TData, TVariables>(
  client: QueryClient,
  queryKey: QueryKey,
  apply: (current: TData | undefined, variables: TVariables) => TData,
) {
  return {
    onMutate: async (variables: TVariables) => {
      await client.cancelQueries({ queryKey })
      const previous = client.getQueryData<TData>(queryKey)
      client.setQueryData<TData>(queryKey, (current) =>
        apply(current, variables),
      )
      return { previous }
    },
    onError: (
      _error: unknown,
      _variables: TVariables,
      result: { previous: TData | undefined } | undefined,
    ) => {
      client.setQueryData(queryKey, result?.previous)
    },
    onSettled: () => client.invalidateQueries({ queryKey }),
  }
}
