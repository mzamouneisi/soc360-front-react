import { useCallback, useEffect, useMemo, useState } from 'react'
import { i18nApi, type AdminBundle, type ExportPayload, type LanguageEntry } from '../api/i18n'
import { ApiError } from '../api/client'
import { useI18n } from '../i18n'
import { languageLabel } from '../i18n/messages'
import { filterKnownLanguages, findKnownLanguage } from '../i18n/languages'
import { translateTexts } from '../lib/translate'
import { Button, Card, Field, InlineButton, Input, Spinner } from '../components/ui'
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader } from '../components/data'

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
  const [bundle, setBundle] = useState<AdminBundle | null>(null)
  const [drafts, setDrafts] = useState<Record<number, Record<string, string>>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

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
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les traductions')
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
      setMessage(`« ${entry.key} » enregistrée.`)
      await refreshI18n()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Échec de l’enregistrement')
    } finally {
      setSaving(null)
    }
  }

  async function deleteRow(entry: LanguageEntry) {
    if (!window.confirm(`Supprimer la clé « ${entry.key} » ?`)) return
    setError(null)
    setMessage(null)
    try {
      await i18nApi.removeEntry(entry.id)
      await load()
      await refreshI18n()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Échec de la suppression')
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
      setMessage('Langue ajoutée.')
      await load()
      await refreshI18n()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Échec de l’ajout de la langue')
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
        setMessage(`La langue « ${code} » est déjà entièrement remplie.`)
        return
      }

      const translated = await translateTexts(pending, 'fr', code)
      const entries = Object.entries(translated).map(([key, value]) => ({
        key,
        translations: { [code]: value },
      }))
      if (entries.length === 0) {
        setMessage('Aucune traduction n’a pu être récupérée pour cette langue.')
        return
      }

      const result = await i18nApi.importAll({ entries })
      setMessage(
        `Langue « ${code} » : ${result.inserted + result.updated} clé(s) traduite(s) via le service de traduction, ${pending.length - entries.length} échec(s).`,
      )
      await load()
      await refreshI18n()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Échec du remplissage automatique')
    } finally {
      setAutofilling(null)
    }
  }

  async function removeLanguage(code: string) {
    if (!window.confirm(`Supprimer la langue « ${code} » et toutes ses traductions ?`)) return
    setError(null)
    setMessage(null)
    try {
      await i18nApi.removeLanguage(code)
      setMessage(`Langue « ${code} » supprimée.`)
      await load()
      await refreshI18n()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Échec de la suppression de la langue')
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
      setMessage('Clé ajoutée.')
      await load()
      await refreshI18n()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Échec de l’ajout de la clé')
    }
  }

  async function exportJson() {
    setError(null)
    try {
      const payload = await i18nApi.exportAll()
      downloadJson(payload, `soc360-langues-${new Date().toISOString().slice(0, 10)}.json`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Échec de l’export')
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
        `Import terminé : ${result.inserted} ajout(s), ${result.updated} mise(s) à jour, ${result.skipped} ignoré(s).`,
      )
      await load()
      await refreshI18n()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Fichier JSON invalide')
    }
  }

  const languages = useMemo(() => bundle?.languages ?? [], [bundle])
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
        title="Langues et traductions"
        subtitle="Table des chaînes traduites (administration)"
        actions={<InlineButton onClick={() => load()} disabled={loading}>{t('common.refresh')}</InlineButton>}
      />

      {error && <ErrorBlock message={error} />}
      {message && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {message}
        </div>
      )}

      <Card className="mb-6 p-6">
        <h3 className="text-sm font-semibold text-gray-900">Langues disponibles</h3>
        <p className="mt-1 text-sm text-gray-500">
          Ajouter une langue crée une nouvelle colonne dans la table des traductions.
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
                  aria-label={`Supprimer la langue ${lang}`}
                  title="Supprimer la langue"
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
          <Field label="Filtrer les langues">
            <Input
              className="w-56"
              value={languageFilter}
              placeholder="ex. esp, german, ar…"
              onChange={(e) => setLanguageFilter(e.target.value)}
            />
          </Field>
          <Field label="Langues connues">
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
              Ajouter la langue
            </InlineButton>
            <span className="text-xs text-gray-500">
              {selectedCode
                ? `Sélection : ${selectedCode} — ${findKnownLanguage(selectedCode)?.label ?? languageLabel(selectedCode)}`
                : `${knownOptions.length} langue(s) disponible(s)`}
            </span>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-brand-100 bg-brand-50/40 p-4">
          <h4 className="text-sm font-semibold text-gray-900">
            Remplir les traductions d'une langue
          </h4>
          <p className="mt-1 text-sm text-gray-500">
            Remplit les cellules vides de la langue choisie à partir du français (traduction via
            l'API si configurée, sinon recopie de la valeur française).
          </p>
          <div className="mt-3 flex flex-wrap items-start">
            <select
              aria-label="Langue à remplir"
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
              Remplir les traductions
            </Button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <InlineButton onClick={() => void exportJson()}>Exporter JSON</InlineButton>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
            Importer JSON
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
        <h3 className="text-sm font-semibold text-gray-900">Ajouter une clé</h3>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <Field label="Clé">
            <Input
              className="w-64"
              value={newKey}
              placeholder="mon.nouvelle.cle"
              onChange={(e) => setNewKey(e.target.value)}
            />
          </Field>
          {languages.map((lang) => (
            <Field key={lang} label={languageLabel(lang)}>
              <Input
                className="w-56"
                value={newTranslations[lang] ?? ''}
                onChange={(e) =>
                  setNewTranslations((tr) => ({ ...tr, [lang]: e.target.value }))
                }
              />
            </Field>
          ))}
          <Button className="w-auto" onClick={() => void addEntry()} disabled={!newKey.trim()}>
            Ajouter la clé
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-sm font-semibold text-gray-900">Chaînes traduites</h3>
        {loading && <LoadingBlock />}
        {!loading && (bundle?.entries.length ?? 0) === 0 && (
          <div className="mt-4">
            <EmptyState title="Aucune traduction" description="Ajoutez une clé pour commencer." />
          </div>
        )}
        {!loading && (bundle?.entries.length ?? 0) > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead style={{ backgroundColor: 'var(--table-header)' }}>
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                    Clé
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
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {bundle?.entries.map((entry) => (
                  <tr key={entry.id} className="even:bg-gray-50">
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
                        className="mr-1.5"
                        onClick={() => void saveRow(entry)}
                        disabled={saving === entry.id}
                      >
                        {saving === entry.id ? <Spinner className="h-4 w-4" /> : null}
                        Enregistrer
                      </InlineButton>
                      <InlineButton onClick={() => void deleteRow(entry)}>Supprimer</InlineButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
