import { createContext, useSyncExternalStore } from 'react'

/** A wide screen: side column, and pages in columns. */
const WIDE = '(min-width: 1100px)'

function subscribe(onChange: () => void) {
  const query = window.matchMedia(WIDE)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

export function useWide() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(WIDE).matches)
}

export const HeaderSlotContext = createContext<HTMLElement | null>(null)
