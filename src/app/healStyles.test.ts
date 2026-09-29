import { describe, expect, it, vi } from 'vitest'
import { healStyles } from './healStyles'

function fakeWindow(styled: boolean, tried = false) {
  const storage = new Map<string, string>(
    tried ? [['aerarium.estilo.recarregado', '1']] : [],
  )
  const unregister = vi.fn(() => Promise.resolve(true))
  const win = {
    getComputedStyle: () => ({
      getPropertyValue: () => (styled ? ' #0d0f15' : ''),
    }),
    document: {
      documentElement: {},
      querySelectorAll: () => [{ href: '/assets/index-abc.css' }],
    },
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
    fetch: vi.fn(() => Promise.reject(new Error('offline'))),
    navigator: {
      serviceWorker: {
        getRegistrations: () => Promise.resolve([{ unregister }]),
      },
    },
    caches: {
      keys: () => Promise.resolve(['workbox-precache']),
      delete: vi.fn(() => Promise.resolve(true)),
    },
    location: { reload: vi.fn() },
  }
  return { win, unregister }
}

describe('página sem estilo depois de publicar', () => {
  it('com estilo, não faz nada', async () => {
    const { win } = fakeWindow(true)
    expect(await healStyles(win as unknown as Window)).toBe(false)
    expect(win.location.reload).not.toHaveBeenCalled()
  })

  it('sem estilo: busca de novo, tira a cópia offline e recarrega uma vez', async () => {
    const { win, unregister } = fakeWindow(false)
    expect(await healStyles(win as unknown as Window)).toBe(true)
    expect(win.fetch).toHaveBeenCalledWith('/assets/index-abc.css', {
      cache: 'reload',
    })
    expect(unregister).toHaveBeenCalled()
    expect(win.caches.delete).toHaveBeenCalledWith('workbox-precache')
    expect(win.location.reload).toHaveBeenCalledOnce()
    // Once per session: no reload loop.
    expect(await healStyles(win as unknown as Window)).toBe(false)
    expect(win.location.reload).toHaveBeenCalledOnce()
  })

  it('já tentou nesta sessão, ou sem sessionStorage: não recarrega', async () => {
    const { win } = fakeWindow(false, true)
    expect(await healStyles(win as unknown as Window)).toBe(false)
    const blocked = fakeWindow(false).win
    blocked.sessionStorage.getItem = () => {
      throw new Error('private')
    }
    expect(await healStyles(blocked as unknown as Window)).toBe(false)
    expect(blocked.location.reload).not.toHaveBeenCalled()
  })
})
