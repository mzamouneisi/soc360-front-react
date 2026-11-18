import { describe, expect, it } from 'vitest'
import { DEFAULT_VAT_RATE, normalizeVatRate, socVatRate } from './vat'

describe('vat', () => {
  it('utilise la TVA de la société quand elle est valide', () => {
    expect(socVatRate({ vatRate: 5.5 })).toBe(5.5)
    expect(socVatRate({ vatRate: 0 })).toBe(0)
  })

  it('retombe sur 20 % sans société ou avec une valeur invalide', () => {
    expect(socVatRate(null)).toBe(DEFAULT_VAT_RATE)
    expect(socVatRate({})).toBe(DEFAULT_VAT_RATE)
    expect(socVatRate({ vatRate: -1 })).toBe(DEFAULT_VAT_RATE)
    expect(socVatRate({ vatRate: 101 })).toBe(DEFAULT_VAT_RATE)
  })

  it('normalise une saisie en conservant 0 et en refusant le hors bornes', () => {
    expect(normalizeVatRate('0')).toBe(0)
    expect(normalizeVatRate('8.5')).toBe(8.5)
    expect(normalizeVatRate('')).toBe(DEFAULT_VAT_RATE)
    expect(normalizeVatRate('101')).toBe(DEFAULT_VAT_RATE)
    expect(normalizeVatRate('abc')).toBe(DEFAULT_VAT_RATE)
  })
})
