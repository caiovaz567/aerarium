import { describe, expect, it } from 'vitest'
import { pixKeyKind, pixKeyText, pixKeyValue } from './pix'

describe('chave Pix', () => {
  it('CPF e CNPJ com pontos pra ler, só números pra copiar', () => {
    expect(pixKeyText(' 12345678901 ')).toBe('123.456.789-01')
    expect(pixKeyValue('123.456.789-01')).toBe('12345678901')
    expect(pixKeyKind('123.456.789-01')).toBe('CPF')
    expect(pixKeyText('12345678000190')).toBe('12.345.678/0001-90')
    expect(pixKeyKind('12.345.678/0001-90')).toBe('CNPJ')
  })

  it('e-mail, telefone e chave aleatória ficam como foram digitados', () => {
    expect(pixKeyText('pai@example.test')).toBe('pai@example.test')
    expect(pixKeyValue(' pai@example.test ')).toBe('pai@example.test')
    expect(pixKeyKind('pai@example.test')).toBe('Chave')
    expect(pixKeyText('+55 21 99999-0000')).toBe('+55 21 99999-0000')
    expect(pixKeyText('123')).toBe('123')
    expect(pixKeyKind('123')).toBe('Chave')
  })
})
