import { api } from './client'

export interface I18nBundle {
  defaultLanguage: string
  languages: string[]
  language: string
  messages: Record<string, string>
}

export interface LanguageEntry {
  id: number
  key: string
  translations: Record<string, string | null>
}

export interface AdminBundle {
  languages: string[]
  entries: LanguageEntry[]
}

export interface TranslationEntryPayload {
  key: string
  translations: Record<string, string | null>
}

export interface ExportPayload {
  version?: number
  languages?: string[]
  entries: TranslationEntryPayload[]
}

export interface ImportResponse {
  inserted: number
  updated: number
  skipped: number
}

export interface AutofillResponse {
  language: string
  source: string
  translated: number
  copied: number
}

export const i18nApi = {
  bundle: (lang?: string) =>
    api.get<I18nBundle>('/public/i18n', { lang }),
  adminBundle: () => api.get<AdminBundle>('/admin/i18n'),
  saveEntry: (key: string, translations: Record<string, string | null>) =>
    api.put<LanguageEntry>(`/admin/i18n/${encodeURIComponent(key)}`, { key, translations }),
  createEntry: (key: string, translations: Record<string, string | null>) =>
    api.post<LanguageEntry>('/admin/i18n', { key, translations }),
  removeEntry: (id: number) => api.delete<void>(`/admin/i18n/${id}`),
  addLanguage: (code: string) =>
    api.post<string[]>('/admin/i18n/languages', { code }),
  removeLanguage: (code: string) =>
    api.delete<string[]>(`/admin/i18n/languages/${encodeURIComponent(code)}`),
  autofillLanguage: (code: string, source = 'fr') =>
    api.post<AutofillResponse>(
      `/admin/i18n/languages/${encodeURIComponent(code)}/autofill`,
      { source },
    ),
  exportAll: () => api.get<ExportPayload>('/admin/i18n/export'),
  importAll: (payload: ExportPayload) =>
    api.post<ImportResponse>('/admin/i18n/import', payload),
}
