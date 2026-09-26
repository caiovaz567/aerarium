import type { Session, User } from '@supabase/supabase-js'
import { act, fireEvent, screen } from '@testing-library/react'
import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from '../../app/ErrorBoundary'
import {
  ACCOUNT_TABLES,
  buildExport,
  confirmsDelete,
  exportFileName,
  type AccountTables,
} from '../../data/account'
import { renderApp } from '../../test/renderApp'

const account = vi.hoisted(() => ({
  deleteMyAccount: vi.fn(async () => {}),
  downloadMyData: vi.fn(async () => {}),
}))
vi.mock('../../data/account', async (original) => ({
  ...(await original<typeof import('../../data/account')>()),
  ...account,
}))

const user = {
  id: 'u1',
  email: 'teste@example.test',
  created_at: '2026-09-24T12:00:00Z',
  identities: [{ provider: 'email', identity_data: {} }],
} as unknown as User

const openSettings = () =>
  renderApp('/config', {
    status: 'signed-in',
    recovery: false,
    session: { user } as Session,
  })

beforeEach(() => {
  account.deleteMyAccount.mockReset().mockResolvedValue(undefined)
  account.downloadMyData.mockReset().mockResolvedValue(undefined)
})

describe('baixar meus dados', () => {
  it('o arquivo tem a conta e todas as tabelas, como estão guardadas', () => {
    const tables = Object.fromEntries(
      ACCOUNT_TABLES.map((table) => [table, []]),
    ) as unknown as AccountTables
    tables.cards = [{ id: 'c1', name: 'Nubank', color: null }]
    const data = buildExport(user, tables, new Date('2026-09-25T02:30:00Z'))
    expect(data.account).toEqual({
      id: 'u1',
      email: 'teste@example.test',
      createdAt: '2026-09-24T12:00:00Z',
      signIn: ['email'],
    })
    expect(Object.keys(data)).toEqual([
      'app',
      'exportedAt',
      'account',
      ...ACCOUNT_TABLES,
    ])
    expect(data.cards).toEqual([{ id: 'c1', name: 'Nubank', color: null }])
  })

  it('o nome do arquivo usa a data de São Paulo', () => {
    // 02:30 UTC on the 25th is still the 24th in São Paulo.
    expect(exportFileName(new Date('2026-09-25T02:30:00Z'))).toBe(
      'Aerarium_dados_2026-09-24.json',
    )
  })

  it('o botão baixa e avisa', async () => {
    openSettings()
    fireEvent.click(screen.getByRole('button', { name: 'Baixar meus dados' }))
    expect(account.downloadMyData).toHaveBeenCalledWith(user)
    expect(
      await screen.findByText('Seus dados foram baixados'),
    ).toBeInTheDocument()
  })

  it('sem internet, explica', async () => {
    account.downloadMyData.mockRejectedValue(new Error('offline'))
    openSettings()
    fireEvent.click(screen.getByRole('button', { name: 'Baixar meus dados' }))
    expect(
      await screen.findByText(
        'Não consegui baixar seus dados. Confere a internet.',
      ),
    ).toBeInTheDocument()
  })

  it('ajustes levam pra política de privacidade', () => {
    openSettings()
    expect(
      screen.getByRole('link', { name: 'Política de privacidade' }),
    ).toHaveAttribute('href', '/privacidade')
  })
})

describe('apagar minha conta', () => {
  it('APAGAR confirma, em maiúscula ou não', () => {
    expect(confirmsDelete('APAGAR')).toBe(true)
    expect(confirmsDelete(' Apagar ')).toBe(true)
    expect(confirmsDelete('apagar')).toBe(true)
    expect(confirmsDelete('APAGA')).toBe(false)
    expect(confirmsDelete('')).toBe(false)
  })

  const openModal = () => {
    openSettings()
    fireEvent.click(
      screen.getByRole('button', { name: 'Apagar minha conta e meus dados' }),
    )
    return screen.getByRole('dialog', { name: 'Apagar sua conta?' })
  }

  it('só libera depois de digitar APAGAR', () => {
    openModal()
    const confirm = screen.getByRole('button', { name: 'Apagar tudo' })
    expect(confirm).toBeDisabled()
    const field = screen.getByLabelText('Digite APAGAR pra confirmar')
    fireEvent.change(field, { target: { value: 'apag' } })
    expect(confirm).toBeDisabled()
    fireEvent.change(field, { target: { value: 'Apagar' } })
    expect(confirm).toBeEnabled()
  })

  it('cancelar fecha sem apagar', () => {
    openModal()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(account.deleteMyAccount).not.toHaveBeenCalled()
  })

  it('apaga, avisa e sai dos ajustes', async () => {
    openModal()
    fireEvent.change(screen.getByLabelText('Digite APAGAR pra confirmar'), {
      target: { value: 'APAGAR' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Apagar tudo' }))
    expect(account.deleteMyAccount).toHaveBeenCalledTimes(1)
    expect(
      await screen.findByText('Sua conta e seus dados foram apagados.'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Ajustes' }),
    ).not.toBeInTheDocument()
  })

  it('se falhar, explica e continua no modal', async () => {
    account.deleteMyAccount.mockRejectedValue(
      new Error(
        'Não consegui apagar a conta. Confere a internet e tenta de novo.',
      ),
    )
    openModal()
    fireEvent.change(screen.getByLabelText('Digite APAGAR pra confirmar'), {
      target: { value: 'APAGAR' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Apagar tudo' }))
    expect(
      await screen.findByText(
        'Não consegui apagar a conta. Confere a internet e tenta de novo.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('privacidade', () => {
  it('abre sem login e volta pro app', () => {
    renderApp('/privacidade', { status: 'signed-out' })
    expect(
      screen.getByRole('heading', { name: 'Privacidade' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/servidor em São Paulo/)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Voltar pro app' }),
    ).toHaveAttribute('href', '/')
  })

  it('o login tem o link', () => {
    renderApp('/login', { status: 'signed-out' })
    expect(screen.getByRole('link', { name: 'Privacidade' })).toHaveAttribute(
      'href',
      '/privacidade',
    )
  })
})

describe('sem internet e erros', () => {
  const setOnline = (online: boolean) => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => online,
    })
    window.dispatchEvent(new Event(online ? 'online' : 'offline'))
  }
  afterEach(() => setOnline(true))

  it('o cabeçalho diz "Sem internet" e volta ao normal', () => {
    renderApp('/meses/2026-09')
    act(() => setOnline(false))
    expect(screen.getByText('Sem internet')).toHaveAttribute(
      'data-state',
      'offline',
    )
    act(() => setOnline(true))
    expect(screen.getByText('Salvo')).toBeInTheDocument()
  })

  it('uma tela que quebra mostra como sair, não uma página em branco', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    function Broken(): never {
      throw new Error('quebrou')
    }
    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Algo deu errado')
    expect(screen.getByRole('button', { name: 'Recarregar' })).toBeVisible()
    error.mockRestore()
  })
})
