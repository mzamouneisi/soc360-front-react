import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { authApi } from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import { setFormatLocale } from '../lib/format'
import {
  LOCALES,
  MESSAGES,
  SUPPORTED_LANGUAGES,
  type Language,
} from './messages'

export type { Language }
export { LANGUAGE_LABELS, LOCALES, SUPPORTED_LANGUAGES } from './messages'

const STORAGE_KEY = 'soc360.language'

export interface I18nState {
  language: Language
  locale: string
  preference: Language | null
  t: (key: string, params?: Record<string, string | number>) => string
  setLanguage: (language: Language | null) => Promise<void>
}

function isSupported(value: string | null | undefined): value is Language {
  return value != null && (SUPPORTED_LANGUAGES as string[]).includes(value)
}

export function detectBrowserLanguage(): Language {
  if (typeof navigator === 'undefined') return 'fr'
  const candidates = [navigator.language, ...(navigator.languages ?? [])]
  for (const candidate of candidates) {
    const primary = candidate?.toLowerCase().split('-')[0]
    if (isSupported(primary)) return primary
  }
  return 'fr'
}

export function getStoredLanguage(): Language | null {
  if (typeof window === 'undefined') return null
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return isSupported(stored) ? stored : null
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  )
}

function translate(
  language: Language,
  key: string,
  params?: Record<string, string | number>,
): string {
  const template = MESSAGES[language][key] ?? MESSAGES.fr[key] ?? key
  return interpolate(template, params)
}

const fallback: I18nState = {
  language: 'fr',
  locale: LOCALES.fr,
  preference: null,
  t: (key, params) => translate('fr', key, params),
  setLanguage: async () => {},
}

const I18nContext = createContext<I18nState>(fallback)

export function I18nProvider({ children }: { children: ReactNode }) {
  const { user, refreshMe } = useAuth()
  const [override, setOverride] = useState<Language | null>(() => getStoredLanguage())

  const userLanguage = isSupported(user?.language) ? user.language : null
  const preference = userLanguage ?? override
  const language: Language = preference ?? detectBrowserLanguage()
  const locale = LOCALES[language]

  useEffect(() => {
    setFormatLocale(locale)
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language
    }
  }, [locale, language])

  const setLanguage = useCallback(
    async (next: Language | null) => {
      setOverride(next)
      if (typeof window !== 'undefined') {
        if (next) {
          window.localStorage.setItem(STORAGE_KEY, next)
        } else {
          window.localStorage.removeItem(STORAGE_KEY)
        }
      }
      if (user) {
        await authApi.updateLanguage(next ?? '')
        await refreshMe()
      }
    },
    [user, refreshMe],
  )

  const value = useMemo<I18nState>(
    () => ({
      language,
      locale,
      preference,
      t: (key, params) => translate(language, key, params),
      setLanguage,
    }),
    [language, locale, preference, setLanguage],
  )

  return (
    <I18nContext.Provider value={value}>
      <Fragment key={language}>{children}</Fragment>
    </I18nContext.Provider>
  )
}

export function useI18n(): I18nState {
  return useContext(I18nContext)
}
