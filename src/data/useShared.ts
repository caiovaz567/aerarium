import { useQuery } from '@tanstack/react-query'
import { loadMyShares, loadSharedWithMe } from './shared'
import { useUserId } from './useFinance'

// What the owner changes shows up for the other person when they open the
// app, come back to it, or within a minute while the shared screen is open.
const EVERY_MINUTE = 60_000

export const sharedKey = (userId: string) => ['shared', userId] as const

/**
 * The other person: the owners who share their cards with them. `live`
 * (the shared screen) also looks again every minute; elsewhere only on
 * coming back to the app.
 */
export function useSharedWithMe(live = true) {
  const userId = useUserId()
  return useQuery({
    queryKey: sharedKey(userId),
    queryFn: () => loadSharedWithMe(userId),
    refetchOnWindowFocus: true,
    refetchInterval: live ? EVERY_MINUTE : false,
  })
}

export const mySharesKey = (userId: string) => ['my-shares', userId] as const

/** The owner: whom they share with. */
export function useMyShares(enabled = true) {
  const userId = useUserId()
  return useQuery({
    queryKey: mySharesKey(userId),
    queryFn: () => loadMyShares(userId),
    enabled,
  })
}
