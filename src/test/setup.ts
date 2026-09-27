import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'

afterEach(cleanup)

// Every test starts the same way. Meses opens "Por tipo" (cards, installments,
// bills), which most tests were written for; the date view tests pick theirs.
beforeEach(() => {
  if (typeof localStorage === 'undefined') return
  localStorage.clear()
  localStorage.setItem('aerarium.meses.visao', 'tipo')
})

// jsdom lacks these browser APIs used by the layout.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof window !== 'undefined') window.scrollTo = () => {}
if (typeof window !== 'undefined')
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    }) as MediaQueryList
