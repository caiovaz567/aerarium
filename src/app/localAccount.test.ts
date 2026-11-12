import { describe, expect, it } from 'vitest'
import { localAccount } from './localAccount'

const account = {
  VITE_LOCAL_EMAIL: 'demo@example.test',
  VITE_LOCAL_PASSWORD: 'local',
}

describe('entrar sozinho no app local', () => {
  it('só com npm run local, e com a conta definida', () => {
    expect(localAccount({ MODE: 'offline', ...account })).toEqual({
      email: 'demo@example.test',
      password: 'local',
    })
    expect(localAccount({ MODE: 'offline' })).toBeNull()
  })

  it('nunca no app publicado nem no desenvolvimento comum', () => {
    expect(localAccount({ MODE: 'production', ...account })).toBeNull()
    expect(localAccount({ MODE: 'development', ...account })).toBeNull()
  })
})
