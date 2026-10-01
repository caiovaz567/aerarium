import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

afterEach(cleanup)

// Every test starts the same way, on 15/09/2026 (the fixtures' current
// month), whatever today's date is. A test can still set another one.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-15T12:00:00-03:00'))
})
afterEach(() => {
  vi.useRealTimers()
})
beforeEach(() => {
  if (typeof localStorage === 'undefined') return
  localStorage.clear()
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
