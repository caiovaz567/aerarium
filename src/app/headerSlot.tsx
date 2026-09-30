import { useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { HeaderSlotContext, useWide } from './headerSlotContext'

/**
 * On a wide screen, what a page puts here goes up into the header's row (the
 * month and its arrows beside the theme buttons); elsewhere it stays in place.
 */
export function HeaderSlot({ children }: { readonly children: ReactNode }) {
  const slot = useContext(HeaderSlotContext)
  const wide = useWide()
  return wide && slot ? createPortal(children, slot) : children
}
