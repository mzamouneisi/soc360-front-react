import { describe, expect, it } from 'vitest'
import { isValidPhone } from './validation'

describe('isValidPhone', () => {
  it('accepte les numéros valides', () => {
    expect(isValidPhone('0102030405')).toBe(true)
    expect(isValidPhone('01 02 03 04 05')).toBe(true)
    expect(isValidPhone('01.02.03.04.05')).toBe(true)
    expect(isValidPhone('+33 1 23 45 67 89')).toBe(true)
    expect(isValidPhone('(01) 23 45 67 89')).toBe(true)
  })

  it('accepte un champ vide', () => {
    expect(isValidPhone('')).toBe(true)
    expect(isValidPhone(null)).toBe(true)
    expect(isValidPhone(undefined)).toBe(true)
  })

  it('refuse les numéros invalides', () => {
    expect(isValidPhone('abc')).toBe(false)
    expect(isValidPhone('------')).toBe(false)
    expect(isValidPhone('12345')).toBe(false)
    expect(isValidPhone('1234567890123456')).toBe(false)
    expect(isValidPhone('++331234')).toBe(false)
    expect(isValidPhone('01/02/03')).toBe(false)
  })
})
