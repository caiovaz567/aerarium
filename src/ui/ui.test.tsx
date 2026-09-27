import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Modal } from './Modal'
import { PasswordField } from './PasswordField'
import { TOAST_MS, useToast } from './toastContext'
import { ToastProvider } from './ToastProvider'

function Trigger({ undo }: { undo?: () => void }) {
  const toast = useToast()
  return (
    <button
      type="button"
      onClick={() =>
        toast(
          'R$ 12,00 na fatura',
          undo ? { label: 'Desfazer', onClick: undo } : undefined,
        )
      }
    >
      mostrar
    </button>
  )
}

describe('aviso', () => {
  afterEach(() => vi.useRealTimers())

  it('mostra Desfazer, executa e some', () => {
    const undo = vi.fn()
    render(
      <ToastProvider>
        <Trigger undo={undo} />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('mostrar'))
    expect(screen.getByRole('status')).toHaveTextContent('R$ 12,00 na fatura')
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }))
    expect(undo).toHaveBeenCalledOnce()
    expect(screen.queryByText('R$ 12,00 na fatura')).not.toBeInTheDocument()
  })

  it('some sozinho: 6 s com Desfazer, 2,2 s sem', () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <Trigger undo={() => {}} />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('mostrar'))
    act(() => vi.advanceTimersByTime(TOAST_MS.withAction - 1))
    expect(screen.getByText('R$ 12,00 na fatura')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.queryByText('R$ 12,00 na fatura')).not.toBeInTheDocument()
  })

  it('aviso sem ação dura menos', () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('mostrar'))
    act(() => vi.advanceTimersByTime(TOAST_MS.plain))
    expect(screen.queryByText('R$ 12,00 na fatura')).not.toBeInTheDocument()
  })

  it('fora do provider, avisa o erro de uso', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Trigger />)).toThrow('ToastProvider')
  })
})

describe('modal', () => {
  it('fecha pelo fundo e mantém o Tab dentro', () => {
    const onClose = vi.fn()
    render(
      <Modal
        title="Editar"
        onClose={onClose}
        actions={
          <>
            <button type="button">Cancelar</button>
            <button type="button">Salvar</button>
          </>
        }
      >
        <p>corpo</p>
      </Modal>,
    )
    const [cancel, save] = screen.getAllByRole('button')
    save!.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(cancel).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(save).toHaveFocus()
    fireEvent.click(document.querySelector('.modal-scrim')!)
    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('PasswordField', () => {
  it('o olhinho mostra e esconde o que foi digitado', () => {
    render(
      <PasswordField
        label="Senha"
        value="segredo1"
        onChange={() => {}}
        autoComplete="current-password"
      />,
    )
    const input = screen.getByLabelText('Senha')
    expect(input).toHaveAttribute('type', 'password')
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(input).toHaveAttribute('type', 'text')
    const hide = screen.getByRole('button', { name: 'Esconder senha' })
    expect(hide).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(hide)
    expect(input).toHaveAttribute('type', 'password')
  })
})
