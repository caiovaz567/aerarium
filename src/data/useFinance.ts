import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { useAuth } from '../app/authContext'
import { dateInSaoPaulo, type ISODate } from '../domain/months'
import { useToast } from '../ui/toastContext'
import { financeKey, loadFinance, type Finance } from './finance'
import type { FinanceOp } from './financeOps'

export function useUserId(): string {
  const auth = useAuth()
  if (auth.status !== 'signed-in') throw new Error('Precisa estar conectado.')
  return auth.session.user.id
}

export function useFinance() {
  return useQuery({ queryKey: financeKey(useUserId()), queryFn: loadFinance })
}

export const today = (): ISODate => dateInSaoPaulo(new Date())

interface Pending {
  readonly op: FinanceOp
  readonly previous: Finance | undefined
}

/**
 * Runs a change. The screen updates in the same tap (so navigating to a new
 * month finds it), then the write goes out; on failure the screen goes back.
 * Changes run one after the other, so "Desfazer" lands after what it undoes.
 */
export function useFinanceOp() {
  const client = useQueryClient()
  const toast = useToast()
  const userId = useUserId()
  const key = useMemo(() => financeKey(userId), [userId])
  const { mutate } = useMutation({
    scope: { id: 'finance' },
    mutationFn: ({ op }: Pending) => op.run(),
    onError: (_error, { previous }) => {
      client.setQueryData(key, previous)
      toast('Não consegui salvar. Confere a internet e tenta de novo.')
    },
    onSettled: () => client.invalidateQueries({ queryKey: key }),
  })
  return useCallback(
    (op: FinanceOp) => {
      // A reload already on its way would overwrite the change on screen.
      void client.cancelQueries({ queryKey: key }, { revert: false })
      const previous = client.getQueryData<Finance>(key)
      if (previous) client.setQueryData(key, op.apply(previous))
      mutate({ op, previous })
    },
    [client, mutate, key],
  )
}
