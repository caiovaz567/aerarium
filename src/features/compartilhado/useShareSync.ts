import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import type { Finance } from '../../data/finance'
import { saveShareData, type ShareRow } from '../../data/shared'
import { useUserId } from '../../data/useFinance'
import { mySharesKey, useMyShares } from '../../data/useShared'
import { canonical, shareData } from './snapshot'

/**
 * The owner's app keeps each person's copy (shares.data) up to date: a moment
 * after anything changes, a copy that is different is saved, in that person's
 * row only. Nothing happens for anyone who does not share.
 */
export function useShareSync(finance: Finance | undefined) {
  const userId = useUserId()
  const client = useQueryClient()
  const owner = Boolean(finance?.otherPerson || finance?.people?.length)
  const shares = useMyShares(owner)
  const changed = useMemo(
    () =>
      finance && owner
        ? (shares.data ?? []).flatMap((row) => {
            const data = shareData(finance, row.personId)
            return canonical(row.data) === canonical(data)
              ? []
              : [{ viewerId: row.viewerId, data }]
          })
        : [],
    [finance, owner, shares.data],
  )
  useEffect(() => {
    if (!changed.length) return
    const timer = window.setTimeout(() => {
      for (const { viewerId, data } of changed)
        saveShareData(userId, viewerId, data)
          .then(() =>
            client.setQueryData<ShareRow[]>(mySharesKey(userId), (rows) =>
              rows?.map((row) =>
                row.viewerId === viewerId ? { ...row, data } : row,
              ),
            ),
          )
          .catch(() => {
            /* offline: the next change or visit tries again */
          })
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [changed, userId, client])
}
