import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { AuthProvider } from '../auth/AuthContext'
import { I18nProvider, useI18n } from './index'
import { MESSAGES } from './messages'

function bundleResponse(messages: Record<string, string>) {
  return {
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({
        defaultLanguage: 'fr',
        languages: ['fr', 'en', 'ar'],
        language: 'fr',
        messages,
      }),
  }
}

function Probe() {
  const { t, language, preference, setLanguage } = useI18n()
  return (
    <div>
      <span data-testid="language">{language}</span>
      <span data-testid="preference">{preference ?? 'browser'}</span>
      <span data-testid="label">{t('login.submit')}</span>
      <button onClick={() => void setLanguage('en')}>switch-en</button>
      <button onClick={() => void setLanguage(null)}>switch-auto</button>
    </div>
  )
}

function renderProbe() {
  return render(
    <AuthProvider>
      <I18nProvider>
        <Probe />
      </I18nProvider>
    </AuthProvider>,
  )
}

describe('i18n messages', () => {
  it('expose les mêmes clés en français et en anglais', () => {
    expect(Object.keys(MESSAGES.en).sort()).toEqual(Object.keys(MESSAGES.fr).sort())
  })
})

describe('I18nProvider', () => {
  let originalLanguage: string
  let originalLanguages: readonly string[]

  beforeEach(() => {
    window.localStorage.clear()
    originalLanguage = navigator.language
    originalLanguages = navigator.languages
    vi.stubGlobal('fetch', vi.fn(async () => bundleResponse({})))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    Object.defineProperty(navigator, 'language', {
      configurable: true,
      value: originalLanguage,
    })
    Object.defineProperty(navigator, 'languages', {
      configurable: true,
      value: originalLanguages,
    })
  })

  function setBrowserLanguage(value: string) {
    Object.defineProperty(navigator, 'language', { configurable: true, value })
    Object.defineProperty(navigator, 'languages', { configurable: true, value: [value] })
  }

  it('utilise la langue du navigateur par défaut', () => {
    setBrowserLanguage('en-US')
    renderProbe()
    expect(screen.getByTestId('language').textContent).toBe('en')
    expect(screen.getByTestId('label').textContent).toBe('Sign in')
    expect(screen.getByTestId('preference').textContent).toBe('browser')
  })

  it('retombe sur le français pour une langue non supportée', () => {
    setBrowserLanguage('de-DE')
    renderProbe()
    expect(screen.getByTestId('language').textContent).toBe('fr')
    expect(screen.getByTestId('label').textContent).toBe('Se connecter')
  })

  it('permet de changer la langue et la mémorise', async () => {
    setBrowserLanguage('fr-FR')
    renderProbe()
    expect(screen.getByTestId('label').textContent).toBe('Se connecter')

    await act(async () => {
      screen.getByText('switch-en').click()
    })

    expect(screen.getByTestId('label').textContent).toBe('Sign in')
    expect(screen.getByTestId('preference').textContent).toBe('en')
    expect(window.localStorage.getItem('soc360.language')).toBe('en')
  })

  it('reprend une langue mémorisée avant le navigateur', () => {
    window.localStorage.setItem('soc360.language', 'en')
    setBrowserLanguage('fr-FR')
    renderProbe()
    expect(screen.getByTestId('language').textContent).toBe('en')
  })

  it('charge les traductions distantes et les priorise', async () => {
    setBrowserLanguage('fr-FR')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => bundleResponse({ 'login.submit': 'Connexion distante' })),
    )
    renderProbe()
    await waitFor(() =>
      expect(screen.getByTestId('label').textContent).toBe('Connexion distante'),
    )
  })
})
