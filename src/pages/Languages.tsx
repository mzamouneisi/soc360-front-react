import { tr } from '../i18n/translate'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { i18nApi, type AdminBundle, type ExportPayload, type LanguageEntry } from '../api/i18n'
import { ApiError } from '../api/client'
import { useI18n } from '../i18n'
import { languageLabel } from '../i18n/messages'
import { filterKnownLanguages, findKnownLanguage } from '../i18n/languages'
import { translateTexts } from '../lib/translate'
import { useAuth } from '../auth/AuthContext'
import { Button, Card, Field, InlineButton, Input, Spinner } from '../components/ui'
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader, Pagination } from '../components/data'
import { dialog } from '../components/dialog'

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function Languages() {
  const { t, refresh: refreshI18n } = useI18n()
  const { user } = useAuth()
  const [bundle, setBundle] = useState<AdminBundle | null>(null)
  const [drafts, setDrafts] = useState<Record<number, Record<string, string>>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const [languageFilter, setLanguageFilter] = useState('')
  const [selectedCode, setSelectedCode] = useState('')
  const [autofilling, setAutofilling] = useState<string | null>(null)
  const [fillLanguage, setFillLanguage] = useState('')
  const [newKey, setNewKey] = useState('')
  const [newTranslations, setNewTranslations] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await i18nApi.adminBundle()
      setBundle(data)
      const next: Record<number, Record<string, string>> = {}
      data.entries.forEach((entry) => {
        next[entry.id] = translationsOf(entry)
      })
      setDrafts(next)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tr('languages.errorLoad'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function translationsOf(entry: LanguageEntry): Record<string, string> {
    const out: Record<string, string> = {}
    Object.entries(entry.translations).forEach(([lang, value]) => {
      out[lang] = value ?? ''
    })
    return out
  }

  function setDraft(id: number, lang: string, value: string) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], [lang]: value } }))
  }

  async function saveRow(entry: LanguageEntry) {
    setSaving(entry.id)
    setError(null)
    setMessage(null)
    try {
      await i18nApi.saveEntry(entry.key, drafts[entry.id] ?? {})
      setMessage(tr('languages.keySaved', { key: entry.key }))
      await refreshI18n()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tr('languages.errorSave'))
    } finally {
      setSaving(null)
    }
  }

  async function deleteRow(entry: LanguageEntry) {
    if (!(await dialog.confirm(tr('languages.confirmDeleteKey', { key: entry.key }), { variant: 'warning', danger: true, okLabel: 'Supprimer' }))) return
    setError(null)
    setMessage(null)
    try {
      await i18nApi.removeEntry(entry.id)
      await load()
      await refreshI18n()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tr('languages.errorDelete'))
    }
  }

  async function addLanguage() {
    if (!selectedCode.trim()) return
    setError(null)
    setMessage(null)
    try {
      await i18nApi.addLanguage(selectedCode.trim().toLowerCase())
      setFillLanguage(selectedCode.trim().toLowerCase())
      setSelectedCode('')
      setLanguageFilter('')
      setMessage(tr('languages.added'))
      await load()
      await refreshI18n()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tr('languages.errorAddLanguage'))
    }
  }

  async function autofillLanguage(code: string) {
    if (!code) return
    setAutofilling(code)
    setError(null)
    setMessage(null)
    try {
      const [source, admin] = await Promise.all([
        i18nApi.bundle('fr'),
        i18nApi.adminBundle(),
      ])
      const existing = new Map(admin.entries.map((entry) => [entry.key, entry]))
      const pending = Object.entries(source.messages)
        .filter(
          ([key, text]) =>
            text &&
            !(existing.get(key)?.translations?.[code] ?? '').toString().trim(),
        )
        .map(([key, text]) => ({ key, text }))

      if (pending.length === 0) {
        setMessage(tr('languages.alreadyFilled', { code }))
        return
      }

      const translated = await translateTexts(pending, 'fr', code)
      const entries = Object.entries(translated).map(([key, value]) => ({
        key,
        translations: { [code]: value },
      }))
      if (entries.length === 0) {
        setMessage(tr('languages.noTranslation'))
        return
      }

      const result = await i18nApi.importAll({ entries })
      setMessage(
        tr('languages.autofillResult', {
          code,
          translated: result.inserted + result.updated,
          failed: pending.length - entries.length,
        }),
      )
      await load()
      await refreshI18n()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tr('languages.errorAutofill'))
    } finally {
      setAutofilling(null)
    }
  }

  async function removeLanguage(code: string) {
    if (!(await dialog.confirm(tr('languages.confirmDeleteLanguage', { code }), { variant: 'warning', danger: true, okLabel: 'Supprimer' }))) return
    setError(null)
    setMessage(null)
    try {
      await i18nApi.removeLanguage(code)
      setMessage(tr('languages.deleted', { code }))
      await load()
      await refreshI18n()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tr('languages.errorDeleteLanguage'))
    }
  }

  async function addEntry() {
    if (!newKey.trim()) return
    setError(null)
    setMessage(null)
    try {
      await i18nApi.createEntry(newKey.trim(), newTranslations)
      setNewKey('')
      setNewTranslations({})
      setMessage(tr('languages.keyAdded'))
      await load()
      await refreshI18n()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tr('languages.errorAddKey'))
    }
  }

  async function exportJson() {
    setError(null)
    try {
      const payload = await i18nApi.exportAll()
      downloadJson(payload, `soc360-langues-${new Date().toISOString().slice(0, 10)}.json`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tr('languages.errorExport'))
    }
  }

  async function importJson(file: File) {
    setError(null)
    setMessage(null)
    try {
      const text = await file.text()
      const payload = JSON.parse(text) as ExportPayload
      const result = await i18nApi.importAll(payload)
      setMessage(
        tr('languages.importResult', {
          inserted: result.inserted,
          updated: result.updated,
          skipped: result.skipped,
        }),
      )
      await load()
      await refreshI18n()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tr('languages.errorInvalidJson'))
    }
  }

  const languages = useMemo(() => bundle?.languages ?? [], [bundle])
  const entryCount = bundle?.entries.length ?? 0
  const pageSize = user?.pageSize ?? 5
  const filteredEntries = useMemo(() => {
    const normalize = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
    const query = normalize(search.trim())
    const entries = bundle?.entries ?? []
    if (!query) return entries
    return entries.filter((entry) => {
      if (normalize(entry.key).includes(query)) return true
      const row = drafts[entry.id] ?? {}
      return languages.some((lang) => normalize(row[lang] ?? '').includes(query))
    })
  }, [bundle, search, drafts, languages])

  useEffect(() => {
    setPage(0)
  }, [search, pageSize])

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / pageSize))
  const safePage = Math.min(page, totalPages - 1)
  const visibleEntries = filteredEntries.slice(
    safePage * pageSize,
    safePage * pageSize + pageSize,
  )
  const knownOptions = useMemo(
    () => filterKnownLanguages(languageFilter).filter((language) => !languages.includes(language.code)),
    [languageFilter, languages],
  )
  const fillTarget = languages.includes(fillLanguage)
    ? fillLanguage
    : (languages.find((language) => language !== 'fr') ?? '')

  return (
    <div>
      <PageHeader
        title={tr('Languages.langues.et.traductions')}
        subtitle={tr('Languages.table.des.chaines.traduites.administration')}
        actions={<InlineButton variant="primary" onClick={() => load()} disabled={loading}>{t('common.refresh')}</InlineButton>}
      />

      {error && <ErrorBlock message={error} />}
      {message && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {message}
        </div>
      )}

      <Card className="mb-6 p-6">
        <h3 className="text-sm font-semibold text-gray-900">{tr('Languages.langues.disponibles')}</h3>
        <p className="mt-1 text-sm text-gray-500">
          {tr('Languages.ajouter.une.langue.cree.une.nouvelle.colonne.dans.la.table.d')}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {languages.map((lang) => (
            <span
              key={lang}
              className="inline-flex items-center gap-1 rounded-full bg-gray-100 py-1 pl-3 pr-1 text-sm text-gray-700"
            >
              <span className="font-semibold uppercase">{lang}</span>
              <span className="text-gray-500">{languageLabel(lang)}</span>
              {lang !== 'fr' && (
                <button
                  type="button"
                  aria-label={tr('languages.deleteAria', { lang })}
                  title={tr('Languages.supprimer.la.langue')}
                  onClick={() => void removeLanguage(lang)}
                  className="ml-1 flex h-5 w-5 items-center justify-center rounded-full text-gray-400 transition hover:bg-red-100 hover:text-red-600"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12Z" />
                  </svg>
                </button>
              )}
            </span>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-start gap-4">
          <Field label={tr('Languages.filtrer.les.langues')}>
            <Input
              className="w-56"
              value={languageFilter}
              placeholder={tr('Languages.ex.esp.german.ar')}
              onChange={(e) => setLanguageFilter(e.target.value)}
            />
          </Field>
          <Field label={tr('Languages.langues.connues')}>
            <select
              size={5}
              value={selectedCode}
              onChange={(e) => setSelectedCode(e.target.value)}
              className="w-64 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            >
              {knownOptions.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.code} — {language.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex flex-col gap-2 pt-6">
            <InlineButton onClick={() => void addLanguage()} disabled={!selectedCode}>
              {tr('Languages.ajouter.la.langue')}
            </InlineButton>
            <span className="text-xs text-gray-500">
              {selectedCode
                ? tr('languages.selection', {
                    code: selectedCode,
                    label:
                      findKnownLanguage(selectedCode)?.label ??
                      languageLabel(selectedCode),
                  })
                : tr('languages.availableCount', { count: knownOptions.length })}
            </span>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-brand-100 bg-brand-50/40 p-4">
          <h4 className="text-sm font-semibold text-gray-900">
            {tr('Languages.remplir.les.traductions.d.une.langue')}
          </h4>
          <p className="mt-1 text-sm text-gray-500">
            {tr('Languages.remplit.les.cellules.vides.de.la.langue.choisie.a.partir.du.')}
          </p>
          <div className="mt-3 flex flex-wrap items-start">
            <select
              aria-label={tr('Languages.langue.a.remplir')}
              value={fillTarget}
              onChange={(e) => setFillLanguage(e.target.value)}
              className="w-64 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            >
              {languages
                .filter((language) => language !== 'fr')
                .map((language) => (
                  <option key={language} value={language}>
                    {language} — {languageLabel(language)}
                  </option>
                ))}
            </select>
            <Button
              className="!ml-5 !w-64"
              onClick={() => void autofillLanguage(fillTarget)}
              disabled={!fillTarget || autofilling === fillTarget}
            >
              {autofilling === fillTarget ? (
                <Spinner className="border-white border-t-transparent" />
              ) : null}
              {tr('Languages.remplir.les.traductions')}
            </Button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <InlineButton onClick={() => void exportJson()}>{tr('Languages.exporter.json')}</InlineButton>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
            {tr('Languages.importer.json')}
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void importJson(file)
                e.target.value = ''
              }}
            />
          </label>
        </div>
      </Card>

      <Card className="mb-6 p-6">
        <h3 className="text-sm font-semibold text-gray-900">{tr('Languages.ajouter.une.cle')}</h3>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <Field label={tr('Languages.cle')}>
            <Input
              className="w-64"
              value={newKey}
              placeholder={tr('Languages.mon.nouvelle.cle')}
              onChange={(e) => setNewKey(e.target.value)}
            />
          </Field>
          {languages.map((lang) => (
            <Field key={lang} label={languageLabel(lang)}>
              <Input
                className="w-56"
                value={newTranslations[lang] ?? ''}
                onChange={(e) =>
                  setNewTranslations((prev) => ({ ...prev, [lang]: e.target.value }))
                }
              />
            </Field>
          ))}
          <Button className="w-auto" onClick={() => void addEntry()} disabled={!newKey.trim()}>
            {tr('Languages.ajouter.la.cle')}
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-baseline gap-2">
          <h3 className="text-sm font-semibold text-gray-900">{tr('Languages.chaines.traduites')}</h3>
          <span className="text-sm font-semibold text-gray-500">{entryCount}</span>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Field label={tr('languages.searchRows')}>
            <Input
              className="max-w-full"
              style={{ width: '54rem' }}
              value={search}
              placeholder={tr('languages.searchPlaceholder')}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
          {search.trim() && (
            <span className="pb-2 text-sm text-gray-500">
              {filteredEntries.length} / {entryCount}
            </span>
          )}
        </div>
        {loading && <LoadingBlock />}
        {!loading && entryCount === 0 && (
          <div className="mt-4">
            <EmptyState title={tr('Languages.aucune.traduction')} description={tr('Languages.ajoutez.une.cle.pour.commencer')} />
          </div>
        )}
        {!loading && entryCount > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead style={{ backgroundColor: 'var(--table-header)' }}>
                <tr>
                  <th className="px-3 py-2 text-right text-xs font-bold uppercase tracking-wide text-gray-500">
                    #
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                    {tr('Languages.cle')}
                  </th>
                  {languages.map((lang) => (
                    <th
                      key={lang}
                      className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-gray-500"
                    >
                      {lang.toUpperCase()} · {languageLabel(lang)}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right text-xs font-bold uppercase tracking-wide text-gray-500">
                    {tr('Languages.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {visibleEntries.map((entry, index) => (
                  <tr key={entry.id} className="even:bg-gray-50">
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-xs text-gray-500">
                      {safePage * pageSize + index + 1}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-gray-700">
                      {entry.key}
                    </td>
                    {languages.map((lang) => (
                      <td key={lang} className="px-3 py-2">
                        <Input
                          className="w-64"
                          value={drafts[entry.id]?.[lang] ?? ''}
                          onChange={(e) => setDraft(entry.id, lang, e.target.value)}
                        />
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <InlineButton
                        variant="primary"
                        className="mr-1.5"
                        onClick={() => void saveRow(entry)}
                        disabled={saving === entry.id}
                      >
                        {saving === entry.id ? <Spinner className="h-4 w-4" /> : null}
                        {tr('Languages.enregistrer')}
                      </InlineButton>
                      <InlineButton variant="danger" onClick={() => void deleteRow(entry)}>{tr('Languages.supprimer')}</InlineButton>
                    </td>
                  </tr>
                ))}
                {visibleEntries.length === 0 && (
                  <tr>
                    <td
                      colSpan={languages.length + 3}
                      className="px-3 py-6 text-center text-sm text-gray-400"
                    >
                      {tr('common.noElements')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {!loading && entryCount > 0 && (
          <Pagination
            page={safePage}
            totalPages={totalPages}
            total={filteredEntries.length}
            onChange={setPage}
          />
        )}
      </Card>
    </div>
  )
}
