import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  findCityByPostalCode,
  findPostalCodeByCity,
  findStreetSuggestions,
  frenchAddressExists,
  isFranceCountry,
  splitStreetNumber,
} from './frenchAddress'

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubFetch(features: unknown[]) {
  return vi.fn(async () => ({ ok: true, json: async () => ({ features }) }))
}

describe('frenchAddress', () => {
  it('détecte la France', () => {
    expect(isFranceCountry('France')).toBe(true)
    expect(isFranceCountry('FR')).toBe(true)
    expect(isFranceCountry('')).toBe(true)
    expect(isFranceCountry(null)).toBe(true)
    expect(isFranceCountry('Belgique')).toBe(false)
  })

  it('trouve la ville depuis le code postal', async () => {
    const fetchMock = stubFetch([{ properties: { city: 'Paris', postcode: '75001' } }])
    vi.stubGlobal('fetch', fetchMock)

    expect(await findCityByPostalCode('75001')).toBe('Paris')
    expect(fetchMock).toHaveBeenCalled()
  })

  it('trouve le code postal depuis la ville', async () => {
    vi.stubGlobal('fetch', stubFetch([{ properties: { city: 'Lyon', postcode: '69001' } }]))

    expect(await findPostalCodeByCity('Lyon')).toBe('69001')
  })

  it('propose des rues sans doublon', async () => {
    vi.stubGlobal('fetch', stubFetch([
      { properties: { street: 'Rue de Paris' } },
      { properties: { street: 'Rue de Paris' } },
      { properties: { name: 'Rue de Lyon' } },
    ]))

    expect(await findStreetSuggestions('Rue de', '75001', 'Paris')).toEqual([
      'Rue de Paris',
      'Rue de Lyon',
    ])
  })

  it('ne garde que les rues commençant par la saisie', async () => {
    vi.stubGlobal('fetch', stubFetch([
      { properties: { street: 'Rue de Paris' } },
      { properties: { street: 'Avenue de Paris' } },
    ]))

    expect(await findStreetSuggestions('Rue de', '75001', 'Paris')).toEqual(['Rue de Paris'])
  })

  it('ignore les accents pour le début de la saisie', async () => {
    vi.stubGlobal('fetch', stubFetch([{ properties: { street: 'Rue de l’Église' } }]))

    expect(await findStreetSuggestions('rue de l’eglise', '75001', 'Paris')).toEqual(['Rue de l’Église'])
  })

  it('sépare un numéro de voie du nom de rue', () => {
    expect(splitStreetNumber('12 rue de Paris')).toEqual({ number: '12', street: 'rue de Paris' })
    expect(splitStreetNumber('12 bis rue de Paris')).toEqual({ number: '12 bis', street: 'rue de Paris' })
    expect(splitStreetNumber('rue de Paris')).toEqual({ number: null, street: 'rue de Paris' })
  })

  it('propose des rues même si la saisie commence par un numéro', async () => {
    vi.stubGlobal('fetch', stubFetch([{ properties: { street: 'Rue de Paris' } }]))

    expect(await findStreetSuggestions('12 rue de', '75001', 'Paris')).toEqual(['12 Rue de Paris'])
  })

  it('vérifie une adresse saisie avec un numéro', async () => {
    vi.stubGlobal('fetch', stubFetch([
      { properties: { street: 'Rue de Paris', city: 'Paris', postcode: '75001' } },
    ]))

    expect(await frenchAddressExists('12 rue de Paris', '75001', 'Paris')).toBe(true)
  })

  it('échoue silencieusement si le service est indisponible', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('down')
    }))

    expect(await findCityByPostalCode('75001')).toBeNull()
    expect(await findStreetSuggestions('Rue de')).toEqual([])
  })

  it('confirme une adresse existante', async () => {
    vi.stubGlobal('fetch', stubFetch([
      { properties: { street: 'Rue de Paris', city: 'Paris', postcode: '75001' } },
    ]))

    expect(await frenchAddressExists('Rue de Paris', '75001', 'Paris')).toBe(true)
  })

  it('refuse une adresse inconnue', async () => {
    vi.stubGlobal('fetch', stubFetch([
      { properties: { street: 'Rue de Rivoli', city: 'Paris', postcode: '75001' } },
    ]))

    expect(await frenchAddressExists('Rue Inexistante', '75001', 'Paris')).toBe(false)
  })

  it('refuse une adresse si le service est indisponible', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('down')
    }))

    expect(await frenchAddressExists('Rue de Paris', '75001', 'Paris')).toBe(false)
  })
})
