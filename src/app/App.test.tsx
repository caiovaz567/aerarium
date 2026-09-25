import { act, fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../test/renderApp'
import { currentMonth } from './paths'
import { monthName } from '../domain/months'

describe('rotas protegidas', () => {
  it('sem sessão, qualquer tela leva pro login', () => {
    renderApp('/cartoes', { status: 'signed-out' })
    expect(
      screen.getByRole('heading', { name: 'Suas finanças, mês a mês.' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Entrar com Google' }),
    ).toBeInTheDocument()
  })

  it('enquanto confere a sessão, não mostra nem login nem app', () => {
    renderApp('/cartoes', { status: 'loading' })
    expect(screen.getByLabelText('Carregando')).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('com sessão, a raiz abre o mês atual', () => {
    renderApp('/')
    expect(screen.getByText(monthName(currentMonth()))).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Meses/ })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('com sessão, o login leva pro mês atual', () => {
    renderApp('/login')
    expect(screen.getByRole('navigation', { name: 'Seções' })).toBeVisible()
  })

  it('mês inválido volta pro mês atual', () => {
    renderApp('/meses/2026-13')
    expect(screen.getByText(monthName(currentMonth()))).toBeInTheDocument()
  })
})

describe('esqueleto', () => {
  it('cabeçalho com marca, estado salvo e configurações', () => {
    const { sync } = renderApp('/meses/2026-09')
    const banner = screen.getByRole('banner')
    expect(banner).toContainElement(
      screen.getByRole('heading', { name: 'Aerarium', level: 1 }),
    )
    expect(screen.getByText('Salvo')).toHaveAttribute('data-state', 'ok')
    act(() => sync.started())
    expect(screen.getByText('Salvando…')).toBeInTheDocument()
    act(() => sync.finished(false))
    expect(screen.getByText('Não salvou')).toHaveAttribute(
      'data-state',
      'error',
    )
    expect(screen.getByRole('link', { name: 'Configurações' })).toHaveAttribute(
      'href',
      '/config',
    )
  })

  it('três abas e navegação entre elas', () => {
    renderApp('/meses/2026-09')
    const tabs = ['Meses', 'Cartões', 'Assinaturas']
    for (const name of tabs)
      expect(screen.getByRole('link', { name })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'Cartões' }))
    expect(screen.getByRole('link', { name: 'Cartões' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(
      screen.getByRole('heading', { name: 'Cartões', level: 2 }),
    ).toBeInTheDocument()
  })

  it('barra de meses anda pra frente e pra trás, virando o ano', () => {
    renderApp('/meses/2026-12')
    fireEvent.click(screen.getByRole('link', { name: 'Próximo mês' }))
    expect(screen.getByText('Janeiro')).toBeInTheDocument()
    expect(screen.getByText('2027')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'Mês anterior' }))
    expect(screen.getByText('Dezembro')).toBeInTheDocument()
  })

  it('botão de lançar abre o modal; Esc fecha e devolve o foco', () => {
    renderApp('/meses/2026-09')
    const add = screen.getByRole('button', { name: 'Lançar gasto ou entrada' })
    add.focus()
    fireEvent.click(add)
    const dialog = screen.getByRole('dialog', { name: 'Lançar' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(document.body).toHaveClass('locked')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.body).not.toHaveClass('locked')
    expect(add).toHaveFocus()
  })

  it('configurações mostram a conta e o botão de sair', () => {
    renderApp('/config')
    expect(screen.getByText('teste@example.test')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument()
  })

  it('cartão inexistente oferece voltar', () => {
    renderApp('/cartoes/qualquer')
    expect(
      screen.getByRole('link', { name: 'Voltar pros cartões' }),
    ).toHaveAttribute('href', '/cartoes')
  })
})

describe('login sem servidor', () => {
  const open = () => renderApp('/login', { status: 'signed-out' })
  const submit = () =>
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

  it('pede e-mail e senha com pelo menos 6 caracteres', () => {
    open()
    submit()
    expect(screen.getByRole('alert')).toHaveTextContent('Coloca seu e-mail.')
    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: 'a@b.c' },
    })
    fireEvent.change(screen.getByLabelText('Senha'), {
      target: { value: '123' },
    })
    submit()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'A senha precisa de pelo menos 6 caracteres.',
    )
  })

  it('alterna entre entrar, criar conta e esqueci a senha', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(screen.getByText('Pelo menos 6 caracteres.')).toBeInTheDocument()
    expect(screen.getByLabelText('Senha')).toHaveAttribute(
      'autocomplete',
      'new-password',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Já tenho conta' }))
    fireEvent.click(screen.getByRole('button', { name: 'Esqueci a senha' }))
    expect(screen.queryByLabelText('Senha')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Entrar com Google' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Mandar link' }),
    ).toBeInTheDocument()
  })

  it('link de senha vencido explica o que fazer', () => {
    renderApp('/redefinir-senha', { status: 'signed-out' })
    expect(
      screen.getByRole('heading', { name: 'Esse link não vale mais.' }),
    ).toBeInTheDocument()
  })
})
