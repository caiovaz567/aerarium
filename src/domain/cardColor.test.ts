import { describe, expect, it } from 'vitest'
import { autoColor, CARD_PALETTE, cardColor, inkFor } from './cardColor'

describe('cor do cartão', () => {
  it.each([
    ['NuBank', '#820AD1'],
    ['Nu', '#820AD1'],
    ['Itaú Platinum', '#EC7000'],
    ['Santander Unique', '#CC0000'],
    ['Mercado Pago', '#009EE3'],
    ['PicPay', '#11C76F'],
    ['Smiles BB', '#F26722'],
    ['Revolut', '#191C1F'],
    ['Banco Inter', '#FF7A00'],
    ['C6 Carbon', '#2B2B2B'],
    ['Bradesco', '#CC092F'],
    ['Caixa', '#005CA9'],
    ['Ourocard', '#F5C400'],
    ['BB', '#F5C400'],
    ['XP Visa', '#111111'],
    ['BTG', '#0B2D5B'],
    ['Neon', '#00A5D8'],
    ['Pan', '#00AEEF'],
    ['Will Bank', '#FFD500'],
    ['Next', '#00C96B'],
  ])('%s usa a cor do banco', (name, color) =>
    expect(autoColor(name)).toBe(color),
  )

  it('sem banco conhecido, usa a paleta de forma estável', () => {
    const color = autoColor('Cartão da padaria')
    expect(CARD_PALETTE).toContain(color)
    expect(autoColor('Cartão  da padaria')).toBe(color)
    expect(autoColor('Interlagos')).not.toBe('#FF7A00')
  })

  it('cor escolhida vence a automática', () => {
    expect(cardColor({ name: 'NuBank', color: '#123456' })).toBe('#123456')
    expect(cardColor({ name: 'NuBank', color: null })).toBe('#820AD1')
  })

  it('texto escuro só em cores claras', () => {
    expect(inkFor('#F5C400')).toBe('#161A26')
    expect(inkFor('#FFD500')).toBe('#161A26')
    expect(inkFor('#820AD1')).toBe('#FFFFFF')
    expect(inkFor('ruim')).toBe('#FFFFFF')
  })
})
