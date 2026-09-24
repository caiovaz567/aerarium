import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { App } from './App'

test('abre a fundação com marca, conteúdo e atalho acessível', () => {
  render(<App />)
  expect(screen.getByRole('banner')).toContainElement(
    screen.getByRole('heading', { name: 'Aerarium', level: 1 }),
  )
  expect(screen.getByRole('main')).toContainElement(
    screen.getByRole('heading', {
      name: 'Suas finanças, mês a mês.',
      level: 2,
    }),
  )
  expect(
    screen.getByRole('link', { name: 'Ir para o conteúdo' }),
  ).toHaveAttribute('href', '#conteudo')
})
