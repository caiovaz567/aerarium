import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UpdatePrompt } from './UpdatePrompt'

const pwa = vi.hoisted(() => ({
  needRefresh: false,
  update: vi.fn(async () => {}),
  registration: undefined as
    | ((url: string, registration: ServiceWorkerRegistration) => void)
    | undefined,
}))

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: (options: {
    onRegisteredSW?: (
      url: string,
      registration: ServiceWorkerRegistration,
    ) => void
  }) => {
    pwa.registration = options.onRegisteredSW
    return {
      needRefresh: [pwa.needRefresh, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: pwa.update,
    }
  },
}))

beforeEach(() => {
  pwa.needRefresh = false
})

describe('UpdatePrompt', () => {
  it('fica escondido enquanto não há versão nova', () => {
    render(<UpdatePrompt />)
    expect(screen.queryByText('Nova versão disponível.')).toBeNull()
  })

  it('avisa da versão nova e atualiza ao tocar', () => {
    pwa.needRefresh = true
    render(<UpdatePrompt />)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Nova versão disponível.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    expect(pwa.update).toHaveBeenCalledWith(true)
  })

  it('procura versão nova ao voltar pro app', () => {
    render(<UpdatePrompt />)
    const update = vi.fn(async () => {})
    pwa.registration!('/sw.js', {
      update,
    } as unknown as ServiceWorkerRegistration)
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(update).toHaveBeenCalledTimes(1)
  })
})
