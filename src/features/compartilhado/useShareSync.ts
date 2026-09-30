import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import type { Finance } from '../../data/finance'
import { saveShareData, type ShareRow } from '../../data/shared'
import { useUserId } from '../../data/useFinance'
import { mySharesKey, useMyShares } from '../../data/useShared'
import { canonical, shareData } from './snapshot'

/**
 * The owner's app keeps the other person's copy (shares.data) up to date: a
 * moment after anything changes, when the copy is different, it is saved.
 * Nothing happens for anyone who does not share.
 */
export function useShareSync(finance: Finance | undefined) {
  const userId = useUserId()
  const client = useQueryClient()
  const owner = Boolean(finance?.otherPerson)
  const shares = useMyShares(owner)
  const data = useMemo(
    () => (finance && owner ? shareData(finance) : null),
    [finance, owner],
  )
  useEffect(() => {
    if (!data || !shares.data?.length) return
    const wanted = canonical(data)
    if (shares.data.every((row) => canonical(row.data) === wanted)) return
    const timer = window.setTimeout(() => {
      saveShareData(userId, data)
        .then(() =>
          client.setQueryData<ShareRow[]>(mySharesKey(userId), (rows) =>
            rows?.map((row) => ({ ...row, data })),
          ),
        )
        .catch(() => {
          /* offline: the next change or visit tries again */
        })
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [data, shares.data, userId, client])
}
