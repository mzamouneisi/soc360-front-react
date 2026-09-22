import { tr } from '../i18n/translate'
import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { authApi } from '../api/auth'
import { ApiError } from '../api/client'
import { Card, Field, Input, Select, Spinner, Button } from '../components/ui'
import { PageHeader } from '../components/data'
import { languageLabel } from '../i18n/messages'
import { useI18n } from '../i18n'

const FONT_SIZES = [10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24]

const THEMES: { id: string; label: string; color: string }[] = [
  { id: 'ocean', label: 'Océan (bleu)', color: '#3367f6' },
  { id: 'forest', label: 'Forêt (vert)', color: '#2aa35a' },
  { id: 'sunset', label: 'Coucher de soleil (orange)', color: '#f97316' },
  { id: 'lilac', label: 'Lilas (violet)', color: '#8b5cf6' },
  { id: 'emerald', label: 'Émeraude (turquoise)', color: '#14b8a6' },
  { id: 'ruby', label: 'Rubis (rouge)', color: '#ef4444' },
  { id: 'amber', label: 'Ambre (or)', color: '#f59e0b' },
  { id: 'sky', label: 'Ciel (bleu clair)', color: '#0ea5e9' },
  { id: 'slate', label: 'Ardoise (gris)', color: '#64748b' },
  { id: 'rose', label: 'Rose (fuchsia)', color: '#f43f5e' },
]

export function Settings() {
  const { user, refreshMe } = useAuth()
  const { t, preference, languages, setLanguage } = useI18n()
  const [size, setSize] = useState<number>(user?.fontSize ?? 14)
  const [theme, setTheme] = useState<string>(user?.theme || 'ocean')
  const [headerColor, setHeaderColor] = useState<string>(user?.tableHeaderColor || '#f9fafb')
  const [borderColor, setBorderColor] = useState<string>(user?.tableBorderColor || '#e5e7eb')
  const [pageSize, setPageSize] = useState<number>(user?.pageSize ?? 5)
  const [btnSmallWidth, setBtnSmallWidth] = useState<number>(user?.buttonSmallWidth ?? 50)
  const [btnLargeWidth, setBtnLargeWidth] = useState<number>(user?.buttonLargeWidth ?? 100)
  const [btnSaveColor, setBtnSaveColor] = useState<string>(user?.buttonSaveColor || '#1d48eb')
  const [btnDeleteColor, setBtnDeleteColor] = useState<string>(user?.buttonDeleteColor || '#dc2626')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [languageSaving, setLanguageSaving] = useState(false)
  const [languageSaved, setLanguageSaved] = useState(false)
  const [languageError, setLanguageError] = useState<string | null>(null)

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
    (u.buttonDeleteColor || '#dc2626') !== btnDeleteColor

  async function handleLanguageChange(value: string) {
    setLanguageSaving(true)
    setLanguageSaved(false)
    setLanguageError(null)
    try {
      await setLanguage(value === 'browser' ? null : value)
      setLanguageSaved(true)
    } catch (err) {
      setLanguageError(err instanceof ApiError ? err.message : 'Erreur inattendue')
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
      await refreshMe()
      setSaved(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inattendue')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />
      <Card className="max-w-xl p-6">
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
                  {th.label}
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
              {THEMES.find((th) => th.id === theme)?.label}
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
            Nouvelle note de frais
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95"
            style={{ minWidth: `${btnLargeWidth}px`, backgroundColor: btnDeleteColor }}
          >
            Supprimer
          </button>
        </div>

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
