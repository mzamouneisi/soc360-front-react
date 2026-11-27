import { describe, expect, it } from 'vitest'
import { COUNTRY_NAMES, findCountrySuggestions } from './countries'

describe('countries', () => {
  it('fournit une liste de pays en français', () => {
    expect(COUNTRY_NAMES.length).toBeGreaterThan(100)
    expect(COUNTRY_NAMES).toContain('France')
  })

  it('propose les pays commençant par la saisie', () => {
    expect(findCountrySuggestions('fra')).toContain('France')
    expect(findCountrySuggestions('bel')).toEqual(expect.arrayContaining(['Belgique']))
    expect(findCountrySuggestions('zzz')).toEqual([])
  })

  it('ignore la casse et les accents', () => {
    expect(findCountrySuggestions('FRANCE')).toContain('France')
    expect(findCountrySuggestions('etats')).toContain('États-Unis')
  })

  it('propose une liste par défaut quand la saisie est vide', () => {
    const suggestions = findCountrySuggestions('')
    expect(suggestions.length).toBeGreaterThan(0)
    expect(suggestions.length).toBeLessThanOrEqual(8)
  })
})
