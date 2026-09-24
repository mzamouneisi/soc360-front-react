import { tr } from '../i18n/translate'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { authApi } from '../api/auth'
import { emailTemplatesApi, type EmailTemplateView } from '../api/emailTemplates'
import { i18nApi, type TranslatedEntry } from '../api/i18n'
import { ApiError } from '../api/client'
import { Card, Field, IconButton, Input, Select, Spinner, Button, Textarea } from '../components/ui'
import { PageHeader } from '../components/data'
import { dialog } from '../components/dialog'
import { languageLabel } from '../i18n/messages'
import { useI18n } from '../i18n'

const FONT_SIZES = [10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24]

const THEMES: { id: string; color: string }[] = [
  { id: 'ocean', color: '#3367f6' },
  { id: 'forest', color: '#2aa35a' },
  { id: 'sunset', color: '#f97316' },
  { id: 'lilac', color: '#8b5cf6' },
  { id: 'emerald', color: '#14b8a6' },
  { id: 'ruby', color: '#ef4444' },
  { id: 'amber', color: '#f59e0b' },
  { id: 'sky', color: '#0ea5e9' },
  { id: 'slate', color: '#64748b' },
  { id: 'rose', color: '#f43f5e' },
]

// Mémorise l'état de la section « Traductions de la société » à travers le rechargement
// du bundle i18n (qui remonte le composant) déclenché après un enregistrement/suppression.
const trUiMemory = { search: '', selectedKey: '', override: '', focus: false }

export function Settings() {
  const { user, refreshMe } = useAuth()
  const { t, preference, languages, setLanguage, language, refresh } = useI18n()
  const [size, setSize] = useState<number>(user?.fontSize ?? 14)
  const [theme, setTheme] = useState<string>(user?.theme || 'ocean')
  const [headerColor, setHeaderColor] = useState<string>(user?.tableHeaderColor || '#f9fafb')
  const [borderColor, setBorderColor] = useState<string>(user?.tableBorderColor || '#e5e7eb')
  const [pageSize, setPageSize] = useState<number>(user?.pageSize ?? 5)
  const [btnSmallWidth, setBtnSmallWidth] = useState<number>(user?.buttonSmallWidth ?? 50)
  const [btnLargeWidth, setBtnLargeWidth] = useState<number>(user?.buttonLargeWidth ?? 100)
  const [btnSaveColor, setBtnSaveColor] = useState<string>(user?.buttonSaveColor || '#1d48eb')
  const [btnDeleteColor, setBtnDeleteColor] = useState<string>(user?.buttonDeleteColor || '#dc2626')
  const [bgColor, setBgColor] = useState<string>(user?.backgroundColor || '#bae6fd')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [languageSaving, setLanguageSaving] = useState(false)
  const [languageSaved, setLanguageSaved] = useState(false)
  const [languageError, setLanguageError] = useState<string | null>(null)

  const canEditTemplates = user?.role === 'ADMIN' || user?.role === 'RESPONSIBLE_SOC'
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplateView[]>([])
  const [templateKey, setTemplateKey] = useState('')
  const [templateSubject, setTemplateSubject] = useState('')
  const [templateBody, setTemplateBody] = useState('')
  const [templateLoading, setTemplateLoading] = useState(false)
  const [templateSaving, setTemplateSaving] = useState(false)
  const [templateError, setTemplateError] = useState<string | null>(null)
  const [templateSaved, setTemplateSaved] = useState(false)
  const selectedTemplate = emailTemplates.find((item) => item.key === templateKey) ?? null

  const [trEntries, setTrEntries] = useState<TranslatedEntry[]>([])
  const [trSearch, setTrSearch] = useState(() => trUiMemory.search)
  const [trSelectedKey, setTrSelectedKey] = useState(() => trUiMemory.selectedKey)
  const [trOverride, setTrOverride] = useState(() => trUiMemory.override)
  const [trLoading, setTrLoading] = useState(false)
  const [trSaving, setTrSaving] = useState(false)
  const [trError, setTrError] = useState<string | null>(null)
  const [trMessage, setTrMessage] = useState<string | null>(null)
  const trOverrideBoxRef = useRef<HTMLDivElement | null>(null)
  const trSelected = trEntries.find((entry) => entry.key === trSelectedKey) ?? null
  const trFiltered = trEntries.filter((entry) => {
    const q = trSearch.trim().toLowerCase()
    if (!q) return true
    return (
      entry.key.toLowerCase().includes(q) ||
      entry.value.toLowerCase().includes(q) ||
      (entry.override ?? '').toLowerCase().includes(q)
    )
  })

  useEffect(() => {
    if (!canEditTemplates) return
    let cancelled = false
    setTemplateLoading(true)
    emailTemplatesApi
      .list()
      .then((list) => {
        if (cancelled) return
        setEmailTemplates(list)
        setTemplateKey((current) => current || list[0]?.key || '')
      })
      .catch(() => {
        if (!cancelled) setTemplateError(t('settings.emailTemplates.loadError'))
      })
      .finally(() => {
        if (!cancelled) setTemplateLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [canEditTemplates, t])

  useEffect(() => {
    if (!selectedTemplate) return
    setTemplateSubject(selectedTemplate.subject)
    setTemplateBody(selectedTemplate.body)
    setTemplateSaved(false)
    setTemplateError(null)
  }, [selectedTemplate])

  useEffect(() => {
    if (!canEditTemplates) return
    let cancelled = false
    setTrLoading(true)
    i18nApi
      .companyEntries(language)
      .then((list) => {
        if (!cancelled) setTrEntries(list)
      })
      .catch(() => {
        if (!cancelled) setTrError(t('settings.companyTranslations.loadError'))
      })
      .finally(() => {
        if (!cancelled) setTrLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [canEditTemplates, language, t])

  useEffect(() => {
    if (!trSelected) return
    setTrOverride(trSelected.override ?? '')
    setTrMessage(null)
    setTrError(null)
  }, [trSelected])

  useEffect(() => {
    trUiMemory.search = trSearch
  }, [trSearch])

  useEffect(() => {
    trUiMemory.selectedKey = trSelectedKey
  }, [trSelectedKey])

  useEffect(() => {
    trUiMemory.override = trOverride
  }, [trOverride])

  useEffect(() => {
    if (!trUiMemory.focus || trLoading || !trSelected) return
    const input = trOverrideBoxRef.current?.querySelector('input')
    input?.focus()
    trUiMemory.focus = false
  }, [trLoading, trSelected])

  if (!user) return null
  const u = user

  const changed =
    size !== (u.fontSize ?? 14) ||
    (u.theme || 'ocean') !== theme ||
    (u.tableHeaderColor || '#f9fafb') !== headerColor ||
    (u.tableBorderColor || '#e5e7eb') !== borderColor ||
    (u.pageSize ?? 5) !== pageSize ||
    (u.buttonSmallWidth ?? 50) !== btnSmallWidth ||
    (u.buttonLargeWidth ?? 100) !== btnLargeWidth ||
    (u.buttonSaveColor || '#1d48eb') !== btnSaveColor ||
    (u.buttonDeleteColor || '#dc2626') !== btnDeleteColor ||
    (u.backgroundColor || '#bae6fd') !== bgColor

  async function handleLanguageChange(value: string) {
    setLanguageSaving(true)
    setLanguageSaved(false)
    setLanguageError(null)
    try {
      await setLanguage(value === 'browser' ? null : value)
      setLanguageSaved(true)
    } catch (err) {
      setLanguageError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    } finally {
      setLanguageSaving(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      if (size !== (u.fontSize ?? 14)) {
        await authApi.updateFontSize(size)
      }
      if ((u.theme || 'ocean') !== theme) {
        await authApi.updateTheme(theme)
      }
      if ((u.tableHeaderColor || '#f9fafb') !== headerColor ||
          (u.tableBorderColor || '#e5e7eb') !== borderColor) {
        await authApi.updateTableColors(headerColor, borderColor)
      }
      if ((u.pageSize ?? 5) !== pageSize) {
        await authApi.updatePageSize(pageSize)
      }
      if ((u.buttonSmallWidth ?? 50) !== btnSmallWidth ||
          (u.buttonLargeWidth ?? 100) !== btnLargeWidth ||
          (u.buttonSaveColor || '#1d48eb') !== btnSaveColor ||
          (u.buttonDeleteColor || '#dc2626') !== btnDeleteColor) {
        await authApi.updateButtonSettings({
          buttonSmallWidth: btnSmallWidth,
          buttonLargeWidth: btnLargeWidth,
          buttonSaveColor: btnSaveColor,
          buttonDeleteColor: btnDeleteColor,
        })
      }
      if ((u.backgroundColor || '#bae6fd') !== bgColor) {
        await authApi.updateBackgroundColor(bgColor)
      }
      await refreshMe()
      setSaved(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    } finally {
      setSaving(false)
    }
  }

  async function handleTemplateSave() {
    if (!templateKey) return
    setTemplateSaving(true)
    setTemplateError(null)
    setTemplateSaved(false)
    try {
      const updated = await emailTemplatesApi.save(templateKey, {
        subject: templateSubject,
        body: templateBody,
      })
      setEmailTemplates((prev) => prev.map((item) => (item.key === updated.key ? updated : item)))
      setTemplateSaved(true)
    } catch (err) {
      setTemplateError(err instanceof ApiError ? err.message : t('settings.emailTemplates.error'))
    } finally {
      setTemplateSaving(false)
    }
  }

  async function handleTemplateReset() {
    if (!templateKey) return
    setTemplateSaving(true)
    setTemplateError(null)
    setTemplateSaved(false)
    try {
      await emailTemplatesApi.reset(templateKey)
      const list = await emailTemplatesApi.list()
      setEmailTemplates(list)
    } catch (err) {
      setTemplateError(err instanceof ApiError ? err.message : t('settings.emailTemplates.error'))
    } finally {
      setTemplateSaving(false)
    }
  }

  async function handleTrCopy() {
    if (!trSelected) return
    if (trOverride.trim() !== '') {
      const confirmed = await dialog.confirm(t('settings.companyTranslations.confirmOverwrite'), {
        variant: 'question',
      })
      if (!confirmed) return
    }
    setTrOverride(trSelected.value)
  }

  async function handleTrSave() {
    if (!trSelectedKey || !trOverride.trim()) return
    setTrSaving(true)
    setTrError(null)
    setTrMessage(null)
    try {
      await i18nApi.saveCompanyOverride({ lang: language, key: trSelectedKey, value: trOverride })
      setTrEntries((prev) =>
        prev.map((entry) => (entry.key === trSelectedKey ? { ...entry, override: trOverride } : entry)),
      )
      setTrMessage(t('settings.companyTranslations.saved'))
      trUiMemory.search = trSearch
      trUiMemory.selectedKey = trSelectedKey
      trUiMemory.override = trOverride
      trUiMemory.focus = true
      await refresh()
    } catch (err) {
      setTrError(err instanceof ApiError ? err.message : t('settings.companyTranslations.error'))
    } finally {
      setTrSaving(false)
    }
  }

  async function handleTrDelete() {
    if (!trSelectedKey) return
    setTrSaving(true)
    setTrError(null)
    setTrMessage(null)
    try {
      await i18nApi.deleteCompanyOverride(language, trSelectedKey)
      setTrEntries((prev) =>
        prev.map((entry) => (entry.key === trSelectedKey ? { ...entry, override: null } : entry)),
      )
      setTrOverride('')
      setTrMessage(t('settings.companyTranslations.deleted'))
      trUiMemory.search = trSearch
      trUiMemory.selectedKey = trSelectedKey
      trUiMemory.override = ''
      trUiMemory.focus = true
      await refresh()
    } catch (err) {
      setTrError(err instanceof ApiError ? err.message : t('settings.companyTranslations.error'))
    } finally {
      setTrSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />
      <Card className="w-[90%] p-6">
        <h3 className="text-sm font-semibold text-gray-900">{t('settings.language.title')}</h3>
        <p className="mt-1 text-sm text-gray-500">{t('settings.language.description')}</p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <Field label={t('settings.language.field')}>
            <Select
              className="w-56"
              value={preference ?? 'browser'}
              onChange={(e) => void handleLanguageChange(e.target.value)}
              disabled={languageSaving}
            >
              <option value="browser">{t('settings.language.browser')}</option>
              {languages.map((lang) => (
                <option key={lang} value={lang}>
                  {languageLabel(lang)}
                </option>
              ))}
            </Select>
          </Field>
          {languageSaving && <Spinner />}
        </div>
        {languageError && <p className="mt-3 text-sm text-red-600">{languageError}</p>}
        {languageSaved && (
          <p className="mt-3 text-sm text-green-600">{t('settings.language.saved')}</p>
        )}

        <h3 className="mt-8 text-sm font-semibold text-gray-900">{t('settings.fontSize.title')}</h3>
        <p className="mt-1 text-sm text-gray-500">{t('settings.fontSize.description')}</p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <Field label={t('settings.fontSize.field')}>
            <Select
              className="w-28"
              value={String(size)}
              onChange={(e) => {
                setSize(Number(e.target.value))
                setSaved(false)
              }}
            >
              {FONT_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s} {tr('Settings.px')}
                </option>
              ))}
            </Select>
          </Field>
          <div
            className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800"
            style={{ fontSize: `${size}px` }}
          >
            {t('settings.fontSize.preview')}
          </div>
        </div>

        <h3 className="mt-8 text-sm font-semibold text-gray-900">{t('settings.theme.title')}</h3>
        <p className="mt-1 text-sm text-gray-500">{t('settings.theme.description')}</p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <Field label={t('settings.theme.field')}>
            <Select
              className="w-56"
              value={theme}
              onChange={(e) => {
                setTheme(e.target.value)
                setSaved(false)
              }}
            >
              {THEMES.map((th) => (
                <option key={th.id} value={th.id}>
                  {t(`settings.theme.${th.id}`)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-center gap-2 pb-1">
            <span
              className="inline-block h-5 w-5 rounded-full"
              style={{ backgroundColor: THEMES.find((th) => th.id === theme)?.color }}
            />
            <span className="text-sm text-gray-500">
              {t(`settings.theme.${theme}`)}
            </span>
          </div>
        </div>
        <div
          className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800"
          style={{ backgroundColor: 'var(--brand-50)', color: 'var(--brand-800)' }}
        >
          {t('settings.theme.preview')}
        </div>

        <h3 className="mt-8 text-sm font-semibold text-gray-900">{t('settings.pageSize.title')}</h3>
        <p className="mt-1 text-sm text-gray-500">{t('settings.pageSize.description')}</p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <Field label={t('settings.pageSize.field')}>
            <Select
              className="w-28"
              value={String(pageSize)}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setSaved(false)
              }}
            >
              {[5, 10, 15, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <h3 className="mt-8 text-sm font-semibold text-gray-900">{t('settings.colors.title')}</h3>
        <p className="mt-1 text-sm text-gray-500">{t('settings.colors.description')}</p>
        <div className="mt-4 flex flex-wrap items-end gap-6">
          <Field label={t('settings.colors.header')}>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={headerColor}
                onChange={(e) => {
                  setHeaderColor(e.target.value)
                  setSaved(false)
                }}
                className="h-9 w-12 cursor-pointer rounded border border-gray-300 bg-white p-1"
              />
              <span className="text-sm text-gray-500">{headerColor}</span>
            </div>
          </Field>
          <Field label={t('settings.colors.border')}>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={borderColor}
                onChange={(e) => {
                  setBorderColor(e.target.value)
                  setSaved(false)
                }}
                className="h-9 w-12 cursor-pointer rounded border border-gray-300 bg-white p-1"
              />
              <span className="text-sm text-gray-500">{borderColor}</span>
            </div>
          </Field>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border" style={{ borderColor: borderColor }}>
          <table className="min-w-full divide-y" style={{ borderColor: borderColor }}>
            <thead style={{ backgroundColor: headerColor }}>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                  {t('settings.example')}
                </th>
                <th className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                  {t('settings.preview')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y bg-white">
              <tr>
                <td className="px-4 py-2 text-sm text-gray-700">{t('settings.row')} 1</td>
                <td className="px-4 py-2 text-sm text-gray-700">{t('settings.content')}</td>
              </tr>
              <tr className="even:bg-gray-50">
                <td className="px-4 py-2 text-sm text-gray-700">{t('settings.row')} 2</td>
                <td className="px-4 py-2 text-sm text-gray-700">{t('settings.content')}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="mt-8 text-sm font-semibold text-gray-900">{t('settings.buttons.title')}</h3>
        <p className="mt-1 text-sm text-gray-500">{t('settings.buttons.description')}</p>
        <div className="mt-4 flex flex-wrap items-end gap-6">
          <Field label={t('settings.buttons.smallWidth')}>
            <Input
              type="number"
              min={20}
              max={400}
              className="w-28"
              value={btnSmallWidth}
              onChange={(e) => {
                setBtnSmallWidth(Number(e.target.value) || 0)
                setSaved(false)
              }}
            />
          </Field>
          <Field label={t('settings.buttons.largeWidth')}>
            <Input
              type="number"
              min={20}
              max={400}
              className="w-28"
              value={btnLargeWidth}
              onChange={(e) => {
                setBtnLargeWidth(Number(e.target.value) || 0)
                setSaved(false)
              }}
            />
          </Field>
          <Field label={t('settings.buttons.saveColor')}>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={btnSaveColor}
                onChange={(e) => {
                  setBtnSaveColor(e.target.value)
                  setSaved(false)
                }}
                className="h-9 w-12 cursor-pointer rounded border border-gray-300 bg-white p-1"
              />
              <span className="text-sm text-gray-500">{btnSaveColor}</span>
            </div>
          </Field>
          <Field label={t('settings.buttons.deleteColor')}>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={btnDeleteColor}
                onChange={(e) => {
                  setBtnDeleteColor(e.target.value)
                  setSaved(false)
                }}
                className="h-9 w-12 cursor-pointer rounded border border-gray-300 bg-white p-1"
              />
              <span className="text-sm text-gray-500">{btnDeleteColor}</span>
            </div>
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <span className="text-sm text-gray-500">{t('settings.buttons.preview')} :</span>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95"
            style={{ minWidth: `${btnSmallWidth}px`, backgroundColor: btnSaveColor }}
          >
            OK
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95"
            style={{ minWidth: `${btnLargeWidth}px`, backgroundColor: btnSaveColor }}
          >
            {tr('NoteFraisList.nouvelle.note.de.frais')}
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95"
            style={{ minWidth: `${btnLargeWidth}px`, backgroundColor: btnDeleteColor }}
          >
            {tr('common.delete')}
          </button>
        </div>

        <h3 className="mt-8 text-sm font-semibold text-gray-900">{t('settings.background.title')}</h3>
        <p className="mt-1 text-sm text-gray-500">{t('settings.background.description')}</p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <Field label={t('settings.background.color')}>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={bgColor}
                onChange={(e) => {
                  setBgColor(e.target.value)
                  setSaved(false)
                }}
                className="h-9 w-12 cursor-pointer rounded border border-gray-300 bg-white p-1"
              />
              <span className="text-sm text-gray-500">{bgColor}</span>
            </div>
          </Field>
          <div
            className="min-w-48 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700"
            style={{
              background: `linear-gradient(135deg, ${bgColor} 0%, color-mix(in srgb, ${bgColor} 45%, white) 55%, #ffffff 100%)`,
            }}
          >
            {t('settings.background.preview')}
          </div>
        </div>

        {canEditTemplates && (
          <>
            <h3 className="mt-8 text-sm font-semibold text-gray-900">{t('settings.emailTemplates.title')}</h3>
            <p className="mt-1 text-sm text-gray-500">{t('settings.emailTemplates.description')}</p>
            {templateLoading ? (
              <div className="mt-4">
                <Spinner />
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <Field label={t('settings.emailTemplates.template')}>
                  <Select value={templateKey} onChange={(e) => setTemplateKey(e.target.value)}>
                    {emailTemplates.map((item) => (
                      <option key={item.key} value={item.key}>
                        {tr(`settings.emailTemplate.${item.key}`)}
                      </option>
                    ))}
                  </Select>
                </Field>
                {selectedTemplate && (
                  <>
                    <p className="text-xs text-gray-500">
                      {t('settings.emailTemplates.variables')} :{' '}
                      <span className="font-mono">{selectedTemplate.variables.map((v) => `{{${v}}}`).join(', ')}</span>
                      {selectedTemplate.custom ? ` · ${t('settings.emailTemplates.custom')}` : ''}
                    </p>
                    <Field label={t('settings.emailTemplates.subject')}>
                      <Input value={templateSubject} onChange={(e) => setTemplateSubject(e.target.value)} />
                    </Field>
                    <Field label={t('settings.emailTemplates.body')}>
                      <Textarea
                        rows={10}
                        className="font-mono text-xs"
                        value={templateBody}
                        onChange={(e) => setTemplateBody(e.target.value)}
                      />
                    </Field>
                    <div className="flex flex-wrap items-center gap-3">
                      <IconButton
                        icon="save"
                        label={t('common.save')}
                        variant="primary"
                        onClick={() => void handleTemplateSave()}
                        disabled={templateSaving}
                        loading={templateSaving}
                      />
                      <IconButton
                        icon="refresh"
                        label={t('settings.emailTemplates.reset')}
                        onClick={() => void handleTemplateReset()}
                        disabled={templateSaving}
                      />
                      {templateSaved && (
                        <span className="text-sm text-green-600">{t('settings.emailTemplates.saved')}</span>
                      )}
                      {templateError && <span className="text-sm text-red-600">{templateError}</span>}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {canEditTemplates && (
          <>
            <h3 className="mt-8 text-sm font-semibold text-gray-900">{t('settings.companyTranslations.title')}</h3>
            <p className="mt-1 text-sm text-gray-500">
              {t('settings.companyTranslations.description', { lang: languageLabel(language) })}
            </p>
            {trLoading ? (
              <div className="mt-4">
                <Spinner />
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Input
                    value={trSearch}
                    onChange={(e) => setTrSearch(e.target.value)}
                    placeholder={t('settings.companyTranslations.search')}
                  />
                  <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-200">
                    {trFiltered.length === 0 ? (
                      <p className="px-3 py-4 text-center text-sm text-gray-400">
                        {t('settings.companyTranslations.empty')}
                      </p>
                    ) : (
                      <ul className="divide-y divide-gray-100">
                        {trFiltered.map((entry) => (
                          <li key={entry.key}>
                            <button
                              type="button"
                              onClick={() => setTrSelectedKey(entry.key)}
                              className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm transition hover:bg-gray-50 ${
                                trSelectedKey === entry.key ? 'bg-brand-50' : ''
                              }`}
                            >
                              <span className="font-mono text-xs text-gray-400">{entry.key}</span>
                              <span className="text-gray-900">{entry.override ?? entry.value}</span>
                              {entry.override && (
                                <span className="text-xs text-brand-600">
                                  {t('settings.companyTranslations.overridden')}
                                </span>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  <Field label={t('settings.companyTranslations.override')}>
                    <div ref={trOverrideBoxRef}>
                      <Input
                        value={trOverride}
                        onChange={(e) => setTrOverride(e.target.value)}
                        disabled={!trSelected}
                      />
                    </div>
                  </Field>
                  <div className="flex flex-wrap items-center gap-2">
                    <IconButton
                      icon="copy"
                      label={t('settings.companyTranslations.copy')}
                      onClick={() => void handleTrCopy()}
                      disabled={!trSelected}
                    />
                    <IconButton
                      icon="save"
                      label={t('settings.companyTranslations.save')}
                      variant="primary"
                      onClick={() => void handleTrSave()}
                      disabled={!trSelected || trSaving || !trOverride.trim()}
                      loading={trSaving}
                    />
                    <IconButton
                      icon="delete"
                      label={t('settings.companyTranslations.delete')}
                      variant="danger"
                      onClick={() => void handleTrDelete()}
                      disabled={!trSelected || trSaving || !trSelected.override}
                    />
                  </div>
                  {trMessage && <p className="text-sm text-green-600">{trMessage}</p>}
                  {trError && <p className="text-sm text-red-600">{trError}</p>}
                </div>
              </div>
            )}
          </>
        )}

        <Button
          className="mt-6 w-auto"
          onClick={() => void handleSave()}
          disabled={saving || !changed}
        >
          {saving ? <Spinner className="border-white border-t-transparent" /> : null}
          {t('common.save')}
        </Button>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {saved && <p className="mt-3 text-sm text-green-600">{t('settings.saved')}</p>}
      </Card>
    </div>
  )
}
