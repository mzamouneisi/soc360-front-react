import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { translateMock } = vi.hoisted(() => ({ translateMock: vi.fn() }))

vi.mock('translate', () => ({ default: translateMock }))

import {
  dynamicTranslate,
  getDynamicVersion,
  setDynamicLanguage,
  subscribeDynamic,
} from './dynamicTranslate'

describe('dynamicTranslate', () => {
  beforeEach(() => {
    translateMock.mockReset()
    translateMock.mockImplementation(async (text: string) => `[${text}]`)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    setDynamicLanguage('fr')
  })

  it('retourne le texte source en français', () => {
    setDynamicLanguage('fr')
    expect(dynamicTranslate('Responsable société')).toBe('Responsable société')
  })

  it('traduit à la volée puis met en cache', async () => {
    setDynamicLanguage('en')
    expect(dynamicTranslate('Responsable société')).toBe('Responsable société')

    await vi.runOnlyPendingTimersAsync()

    expect(dynamicTranslate('Responsable société')).toBe('[Responsable société]')
    expect(translateMock).toHaveBeenCalledWith('Responsable société', {
      from: 'fr',
      to: 'en',
    })
  })

  it('notifie les abonnés après une traduction', async () => {
    setDynamicLanguage('ar')
    const listener = vi.fn()
    const unsubscribe = subscribeDynamic(listener)
    const before = getDynamicVersion()

    dynamicTranslate('Consultant')
    await vi.runOnlyPendingTimersAsync()

    expect(listener).toHaveBeenCalled()
    expect(getDynamicVersion()).toBeGreaterThan(before)
    unsubscribe()
  })
})
