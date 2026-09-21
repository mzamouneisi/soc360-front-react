import { beforeEach, describe, expect, it, vi } from 'vitest'

const { translateMock } = vi.hoisted(() => ({ translateMock: vi.fn() }))

vi.mock('translate', () => ({ default: translateMock }))

import { translateTexts } from './translate'

describe('translateTexts', () => {
  beforeEach(() => {
    translateMock.mockReset()
  })

  it('traduit chaque texte et indexe le résultat par clé', async () => {
    translateMock.mockImplementation(async (text: string) => `[${text}]`)

    const result = await translateTexts(
      [
        { key: 'a', text: 'Bonjour' },
        { key: 'b', text: 'Au revoir' },
      ],
      'fr',
      'en',
    )

    expect(result).toEqual({ a: '[Bonjour]', b: '[Au revoir]' })
    expect(translateMock).toHaveBeenCalledWith('Bonjour', { from: 'fr', to: 'en' })
  })

  it('ignore les traductions en échec ou vides', async () => {
    translateMock.mockImplementation(async (text: string) => {
      if (text === 'bad') throw new Error('boom')
      if (text === 'empty') return '   '
      return 'ok'
    })

    const result = await translateTexts(
      [
        { key: 'a', text: 'good' },
        { key: 'b', text: 'bad' },
        { key: 'c', text: 'empty' },
      ],
      'fr',
      'es',
    )

    expect(result).toEqual({ a: 'ok' })
  })
})
