import { describe, expect, it } from 'vitest'
import {
  CASH,
  paidFromBanks,
  paidFromName,
  bankColor,
  bankName,
  BANKS,
  cardBank,
  cardFinal,
  guessBank,
  isBankKey,
} from './banks'

describe('logo do banco', () => {
  it.each([
    ['Nubank Ultravioleta', 'nubank'],
    ['Smiles BB', 'bb'],
    ['Ourocard', 'bb'],
    ['Itaú Personnalité', 'itau'],
    ['Mercado Pago', 'mercadopago'],
    ['Cartão MP', 'mercadopago'],
    ['C6 Carbon', 'c6'],
    ['PicPay', 'picpay'],
    ['Santander Unique', 'santander'],
    ['Revolut', 'revolut'],
    ['Cartão da loja', null],
    ['Internet', null],
    ['Bebê', null],
  ])('"%s" → %s', (name, key) => expect(guessBank(name)).toBe(key))

  it('o banco escolhido ganha do palpite; "none" é sem logo', () => {
    expect(cardBank({ name: 'Nubank', bank: 'itau' })).toBe('itau')
    expect(cardBank({ name: 'Nubank', bank: 'none' })).toBeNull()
    expect(cardBank({ name: 'Nubank', bank: null })).toBe('nubank')
    expect(cardBank({ name: 'Nubank', bank: 'banco-sumido' })).toBe('nubank')
    expect(cardBank({ name: 'Nubank' })).toBe('nubank')
  })

  it('final do cartão: os 4 últimos números', () => {
    expect(cardFinal('**** 5580')).toBe('5580')
    expect(cardFinal('1234567890')).toBe('7890')
    expect(cardFinal('12')).toBeNull()
    expect(cardFinal(null)).toBeNull()
  })

  it('nomes e chaves', () => {
    expect(bankName('bb')).toBe('Banco do Brasil')
    expect(bankColor('nubank')).toBe('#820AD1')
    expect(isBankKey('nubank')).toBe(true)
    expect(isBankKey(null)).toBe(false)
    expect(new Set(BANKS.map((bank) => bank.key)).size).toBe(BANKS.length)
  })
})

describe('de onde saiu um Pix, boleto ou dinheiro', () => {
  it('nome do banco, "Dinheiro" ou nada', () => {
    expect(paidFromName('santander')).toBe('Santander')
    expect(paidFromName(CASH)).toBe('Dinheiro')
    expect(paidFromName(null)).toBeNull()
    expect(paidFromName('banco-que-sumiu')).toBeNull()
  })

  it('primeiro os bancos dos cartões, sem repetir; e o já escolhido', () => {
    const cards = [
      { name: 'Santander Unique' },
      { name: 'Nubank', bank: 'nubank' },
      { name: 'Santander Free' },
      { name: 'Sem logo', bank: 'none' },
    ]
    expect(paidFromBanks(cards, null)).toEqual(['santander', 'nubank'])
    expect(paidFromBanks(cards, 'caixa')).toEqual([
      'santander',
      'nubank',
      'caixa',
    ])
    expect(paidFromBanks(cards, CASH)).toEqual(['santander', 'nubank'])
  })
})
