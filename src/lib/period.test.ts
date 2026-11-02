import { describe, expect, it } from 'vitest'
import {
  allowedMonths,
  allowedYears,
  isAfterPeriod,
  isBeforePeriod,
  maxPeriod,
  parseHirePeriod,
} from './period'

const NOW = new Date(2026, 7, 15, 12, 0, 0)

describe('period', () => {
  it('parse une date d’embauche ISO', () => {
    expect(parseHirePeriod('2023-05-10')).toEqual({ year: 2023, month: 5 })
    expect(parseHirePeriod(null)).toBeNull()
    expect(parseHirePeriod('')).toBeNull()
    expect(parseHirePeriod('invalide')).toBeNull()
  })

  it('borne le futur à 3 ans à partir d’aujourd’hui', () => {
    expect(maxPeriod(NOW)).toEqual({ year: 2029, month: 8 })
    expect(isAfterPeriod({ year: 2029, month: 9 }, maxPeriod(NOW))).toBe(true)
    expect(isAfterPeriod({ year: 2029, month: 8 }, maxPeriod(NOW))).toBe(false)
    expect(isBeforePeriod({ year: 2023, month: 4 }, { year: 2023, month: 5 })).toBe(true)
  })

  it('propose les années depuis l’embauche jusqu’à +3 ans', () => {
    const years = allowedYears(2023, NOW)
    expect(years[0]).toBe(2023)
    expect(years[years.length - 1]).toBe(2029)
    expect(years).toContain(2026)
    expect(years).not.toContain(2022)
  })

  it('retombe sur l’année précédente sans date d’embauche', () => {
    expect(allowedYears(null, NOW)[0]).toBe(2025)
  })

  it('filtre les mois avant l’embauche et après la borne future', () => {
    const hire = parseHirePeriod('2023-05-10')
    expect(allowedMonths(2023, hire, NOW)[0]).toBe(5)
    expect(allowedMonths(2022, hire, NOW)).toEqual([])
    expect(allowedMonths(2029, hire, NOW).at(-1)).toBe(8)
    expect(allowedMonths(2030, hire, NOW)).toEqual([])
  })
})
