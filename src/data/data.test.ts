import { MutationObserver } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { authErrorFromUrl, authMessage } from './auth'
import { createQueryClient, optimistic, SyncTracker } from './queryClient'

describe('estado de sincronização', () => {
  it('salvando enquanto grava; não salvou até o próximo sucesso', () => {
    const sync = new SyncTracker()
    const seen: string[] = []
    sync.subscribe(() => seen.push(sync.getSnapshot()))
    expect(sync.getSnapshot()).toBe('ok')
    sync.started()
    sync.started()
    sync.finished(true)
    expect(sync.getSnapshot()).toBe('saving')
    sync.finished(false)
    expect(sync.getSnapshot()).toBe('error')
    sync.started()
    sync.finished(true)
    expect(seen).toEqual([
      'saving',
      'saving',
      'saving',
      'error',
      'saving',
      'ok',
    ])
  })
})

describe('atualização otimista', () => {
  const key = ['itens']

  function setup(fail: boolean) {
    const { client, sync } = createQueryClient()
    client.setQueryData(key, ['a'])
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    const observer = new MutationObserver(client, {
      mutationFn: async () => {
        await gate
        if (fail) throw new Error('offline')
      },
      ...optimistic<string[], string>(client, key, (current, item) => [
        ...(current ?? []),
        item,
      ]),
    })
    return { client, sync, observer, release }
  }

  it('mostra na hora e mantém quando o servidor aceita', async () => {
    const { client, sync, observer, release } = setup(false)
    const done = observer.mutate('b')
    await vi.waitFor(() => expect(client.getQueryData(key)).toEqual(['a', 'b']))
    expect(sync.getSnapshot()).toBe('saving')
    release()
    await done
    expect(client.getQueryData(key)).toEqual(['a', 'b'])
    expect(sync.getSnapshot()).toBe('ok')
  })

  it('volta atrás quando o servidor falha', async () => {
    const { client, sync, observer, release } = setup(true)
    const done = observer.mutate('b').catch(() => {})
    await vi.waitFor(() => expect(client.getQueryData(key)).toEqual(['a', 'b']))
    release()
    await done
    expect(client.getQueryData(key)).toEqual(['a'])
    expect(sync.getSnapshot()).toBe('error')
  })
})

describe('mensagens de login', () => {
  it('lê o erro que o servidor manda de volta na URL', () => {
    expect(authErrorFromUrl('http://x/config')).toBeNull()
    expect(
      authErrorFromUrl(
        'http://x/config?error=server_error&error_code=identity_already_exists',
      ),
    ).toBe('Essa conta Google já está ligada a outra conta do Aerarium.')
    expect(
      authErrorFromUrl(
        'http://x/config#error=x&error_code=manual_linking_disabled',
      ),
    ).toBe('Conectar outra forma de entrar está desligado.')
  })

  it('traduz códigos conhecidos, falta de rede e o resto', () => {
    expect(authMessage({ code: 'invalid_credentials', status: 400 })).toBe(
      'E-mail ou senha errados.',
    )
    expect(authMessage({ code: undefined, status: 0 })).toBe(
      'Não consegui falar com o servidor. Confere a internet.',
    )
    expect(authMessage({ code: 'desconhecido', status: 500 })).toBe(
      'Algo deu errado. Tenta de novo.',
    )
  })
})
