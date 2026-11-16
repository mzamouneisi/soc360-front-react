import { describe, expect, it } from 'vitest'
import { filterRows, rowSearchText, searchableText } from './tableSearch'

describe('tableSearch', () => {
  it('extrait le texte des valeurs simples et imbriquées', () => {
    expect(searchableText({ name: 'Alice', role: { label: 'Manager' }, tags: ['a', 'b'] }))
      .toBe('Alice Manager a b')
  })

  it('ignore les valeurs nulles', () => {
    expect(rowSearchText({ name: null, age: 42 })).toBe('42')
  })

  it('filtre sans tenir compte de la casse et des espaces', () => {
    const rows = [{ name: 'Alice' }, { name: 'Bob' }]
    expect(filterRows(rows, '  ALI  ', (r) => r.name)).toEqual([{ name: 'Alice' }])
  })

  it('retourne toutes les lignes pour une recherche vide', () => {
    const rows = [{ name: 'Alice' }, { name: 'Bob' }]
    expect(filterRows(rows, '   ', (r) => r.name)).toEqual(rows)
  })
})
