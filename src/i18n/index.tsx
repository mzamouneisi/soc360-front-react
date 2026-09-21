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
import { i18nApi } from '../api/i18n'
import { useAuth } from '../auth/AuthContext'
import { setFormatLocale } from '../lib/format'
import { setTranslationState } from './translate'
import {
  LOCALES,
  MESSAGES,
  SUPPORTED_LANGUAGES,
  isRtl,
  type Language,
} from './messages'

export type { Language }
export {
  LANGUAGE_LABELS,
  LOCALES,
  SUPPORTED_LANGUAGES,
  isRtl,
  languageLabel,
} from './messages'

const STORAGE_KEY = 'soc360.language'

export interface I18nState {
  language: Language
  locale: string
  rtl: boolean
  preference: Language | null
  languages: Language[]
  t: (key: string, params?: Record<string, string | number>) => string
  setLanguage: (language: Language | null) => Promise<void>
  refresh: () => Promise<void>
}

function isSupported(value: string | null | undefined): value is Language {
  return value != null && value.trim() !== ''
}

export function detectBrowserLanguage(): Language {
  if (typeof navigator === 'undefined') return 'fr'
  const candidates = [navigator.language, ...(navigator.languages ?? [])]
  for (const candidate of candidates) {
    const primary = candidate?.toLowerCase().split('-')[0]
    if (primary && (SUPPORTED_LANGUAGES as string[]).includes(primary)) return primary
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

function staticTranslate(
  language: Language,
  key: string,
  params?: Record<string, string | number>,
): string {
  const template = MESSAGES[language]?.[key] ?? MESSAGES.fr[key] ?? key
  return interpolate(template, params)
}

const fallback: I18nState = {
  language: 'fr',
  locale: LOCALES.fr,
  rtl: false,
  preference: null,
  languages: SUPPORTED_LANGUAGES,
  t: (key, params) => staticTranslate('fr', key, params),
  setLanguage: async () => {},
  refresh: async () => {},
}

const I18nContext = createContext<I18nState>(fallback)

export function I18nProvider({ children }: { children: ReactNode }) {
  const { user, refreshMe } = useAuth()
  const [override, setOverride] = useState<Language | null>(() => getStoredLanguage())
  const [remoteMessages, setRemoteMessages] = useState<Record<string, string>>({})
  const [remoteLanguages, setRemoteLanguages] = useState<Language[]>([])
  const [bundleVersion, setBundleVersion] = useState(0)

  const userLanguage = isSupported(user?.language) ? user.language : null
  const preference = userLanguage ?? override
  const language: Language = preference ?? detectBrowserLanguage()
  const locale = LOCALES[language] ?? language
  const rtl = isRtl(language)

  const loadBundle = useCallback(async () => {
    try {
      const bundle = await i18nApi.bundle(language)
      setRemoteMessages(bundle.messages ?? {})
      if (bundle.languages?.length) setRemoteLanguages(bundle.languages)
      setBundleVersion((version) => version + 1)
    } catch {
      setRemoteMessages({})
    }
  }, [language])

  useEffect(() => {
    setFormatLocale(locale)
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language
      document.documentElement.dir = rtl ? 'rtl' : 'ltr'
    }
  }, [locale, language, rtl])

  useEffect(() => {
    void loadBundle()
  }, [loadBundle])

  useEffect(() => {
    setTranslationState(language, remoteMessages)
  }, [language, remoteMessages])

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

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      interpolate(remoteMessages[key] ?? staticTranslate(language, key), params),
    [language, remoteMessages],
  )

  const value = useMemo<I18nState>(
    () => ({
      language,
      locale,
      rtl,
      preference,
      languages: remoteLanguages.length ? remoteLanguages : SUPPORTED_LANGUAGES,
      t,
      setLanguage,
      refresh: loadBundle,
    }),
    [language, locale, rtl, preference, remoteLanguages, t, setLanguage, loadBundle],
  )

  return (
    <I18nContext.Provider value={value}>
      <Fragment key={`${language}:${bundleVersion}`}>{children}</Fragment>
    </I18nContext.Provider>
  )
}

export function useI18n(): I18nState {
  return useContext(I18nContext)
}
