import { createContext, useContext } from 'react'

export interface ToastAction {
  readonly label: string
  readonly onClick: () => void
}

/** Same timing as v1: 6 s when there is something to undo, 2.2 s otherwise. */
export const TOAST_MS = { withAction: 6000, plain: 2200 }

export type ShowToast = (message: string, action?: ToastAction) => void

export const ToastContext = createContext<ShowToast | null>(null)

/** `toast('Excluído', { label: 'Desfazer', onClick: undo })` */
export function useToast(): ShowToast {
  const show = useContext(ToastContext)
  if (!show) throw new Error('useToast precisa do ToastProvider.')
  return show
}
