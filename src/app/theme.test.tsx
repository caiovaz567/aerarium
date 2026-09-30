import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ThemeToggle } from './ThemeToggle'
import { applyTheme, nextTheme, readTheme } from './theme'

describe('tema claro, escuro ou do aparelho', () => {
  it('guarda a escolha e marca o <html>; automático deixa pro aparelho', () => {
    render(<ThemeToggle />)
    const group = screen.getByRole('group', { name: 'Tema' })
    expect(readTheme()).toBe('system')
    fireEvent.click(screen.getByRole('button', { name: 'Claro' }))
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(readTheme()).toBe('light')
    expect(
      group.querySelector('[aria-pressed="true"]')?.getAttribute('aria-label'),
    ).toBe('Claro')
    fireEvent.click(screen.getByRole('button', { name: 'Automático' }))
    expect(document.documentElement.dataset.theme).toBeUndefined()
    expect(readTheme()).toBe('system')
  })

  it('no celular, um botão só vai trocando', () => {
    render(<ThemeToggle />)
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Tema: automático. Tocar pra trocar',
      }),
    )
    expect(document.documentElement.dataset.theme).toBe('light')
    fireEvent.click(
      screen.getByRole('button', { name: 'Tema: claro. Tocar pra trocar' }),
    )
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(nextTheme('dark')).toBe('system')
    applyTheme('system')
  })
})
