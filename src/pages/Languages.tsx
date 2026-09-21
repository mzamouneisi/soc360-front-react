import { useCallback, useEffect, useState } from 'react'
import { i18nApi, type AdminBundle, type ExportPayload, type LanguageEntry } from '../api/i18n'
import { ApiError } from '../api/client'
import { useI18n } from '../i18n'
import { languageLabel } from '../i18n/messages'
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

  const [newCode, setNewCode] = useState('')
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
    if (!newCode.trim()) return
    setError(null)
    setMessage(null)
    try {
      await i18nApi.addLanguage(newCode.trim().toLowerCase())
      setNewCode('')
      setMessage('Langue ajoutée.')
      await load()
      await refreshI18n()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Échec de l’ajout de la langue')
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

  const languages = bundle?.languages ?? []

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
              className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700"
            >
              <span className="font-semibold uppercase">{lang}</span>
              <span className="text-gray-500">{languageLabel(lang)}</span>
            </span>
          ))}
          <Field label="Nouvelle langue (code ISO)">
            <div className="flex items-center gap-2">
              <Input
                className="w-32"
                value={newCode}
                maxLength={8}
                placeholder="es"
                onChange={(e) => setNewCode(e.target.value)}
              />
              <InlineButton onClick={() => void addLanguage()} disabled={!newCode.trim()}>
                Ajouter
              </InlineButton>
            </div>
          </Field>
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
