import { describe, expect, it } from 'vitest'
import { cleanUsername, personNameProblem, usernameProblem } from './people'

describe('usuário', () => {
  it('guarda sem @, sem espaços e em minúsculas', () => {
    expect(cleanUsername('  @@Caio_1 ')).toBe('caio_1')
  })

  it('de 3 a 20 letras, sem acento, números e _', () => {
    expect(usernameProblem('caio_1')).toBeNull()
    expect(usernameProblem('abc')).toBeNull()
    expect(usernameProblem('a'.repeat(20))).toBeNull()
    expect(usernameProblem('ab')).toMatch(/3 a 20/)
    expect(usernameProblem('a'.repeat(21))).toMatch(/3 a 20/)
    expect(usernameProblem('joão')).toMatch(/sem acento/)
    expect(usernameProblem('caio silva')).toMatch(/sem acento/)
  })
})

describe('nome da pessoa', () => {
  it('precisa ter de 1 a 30 letras', () => {
    expect(personNameProblem(' Amigo ')).toBeNull()
    expect(personNameProblem('a'.repeat(30))).toBeNull()
    expect(personNameProblem('   ')).toMatch(/Coloca/)
    expect(personNameProblem('a'.repeat(31))).toMatch(/30/)
  })
})
