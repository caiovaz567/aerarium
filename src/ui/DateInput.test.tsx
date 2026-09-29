import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { brazilianDate } from '../domain/months'
import { DateInput } from './DateInput'

describe('datas sempre dia/mês/ano e 24 horas', () => {
  it('escreve do jeito brasileiro', () => {
    expect(brazilianDate('2026-09-29')).toBe('29/09/2026')
    expect(brazilianDate('2026-09-29T14:42')).toBe('29/09/2026 14:42')
    expect(brazilianDate('2026-09-29T02:05:30')).toBe('29/09/2026 02:05')
    expect(brazilianDate('')).toBe('')
  })

  it('mostra a data em cima do seletor do aparelho e abre ele ao tocar', () => {
    const onChange = vi.fn()
    const { container, rerender } = render(
      <DateInput
        id="quando"
        type="datetime-local"
        value="2026-09-29T14:42"
        onChange={onChange}
      />,
    )
    expect(container.querySelector('.date-text')).toHaveTextContent(
      '29/09/2026 14:42',
    )
    const input = container.querySelector('input')!
    const showPicker = vi.fn()
    input.showPicker = showPicker
    fireEvent.click(input)
    expect(showPicker).toHaveBeenCalled()
    input.showPicker = () => {
      throw new Error('not allowed')
    }
    fireEvent.click(input)
    fireEvent.change(input, { target: { value: '2026-10-01T08:00' } })
    expect(onChange).toHaveBeenCalledWith('2026-10-01T08:00')
    rerender(<DateInput id="quando" value="" onChange={onChange} />)
    expect(screen.getByText('Sem data')).toHaveClass('empty')
  })
})
