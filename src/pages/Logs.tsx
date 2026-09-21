import { tr } from '../i18n/translate'
import { useState } from 'react'
import { logsApi } from '../api/logs'
import { useAsync } from '../lib/useAsync'
import { InlineButton, Input, Select } from '../components/ui'
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader } from '../components/data'

const PRESETS = [
  { label: '50 lignes', value: 50 },
  { label: '100 lignes', value: 100 },
  { label: '200 lignes', value: 200 },
  { label: '500 lignes', value: 500 },
  { label: '1000 lignes', value: 1000 },
  { label: '2000 lignes', value: 2000 },
]

export function Logs() {
  const [lines, setLines] = useState(100)
  const [query, setQuery] = useState(100)
  const [filter, setFilter] = useState('')
  const [copied, setCopied] = useState(false)
  const { data, loading, error, reload } = useAsync(() => logsApi.tail(query), [query])

  async function copyText(text: string) {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={tr('Logs.logs.du.serveur')}
        subtitle={tr('Logs.dernieres.lignes.du.fichier.de.log.du.backend.administration')}
        actions={
          <InlineButton onClick={reload} disabled={loading}>
            Actualiser
          </InlineButton>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <Select
          className="w-auto min-w-40"
          value={lines}
          onChange={(e) => setLines(Number(e.target.value))}
          aria-label={tr('Logs.nombre.de.lignes')}
        >
          {PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{tr('Logs.nombre.de.lignes.2')}</span>
          <Input
            type="number"
            min={1}
            max={2000}
            className="w-28"
            value={lines}
            onChange={(e) => setLines(Number(e.target.value))}
          />
        </div>
        <InlineButton onClick={() => setQuery(lines)} disabled={loading || lines < 1}>
          {tr('Logs.afficher')}
        </InlineButton>
        <div className="flex flex-1 items-center gap-2">
          <span className="text-sm text-gray-500">{tr('Logs.filtrer')}</span>
          <Input
            type="search"
            placeholder={tr('Logs.texte.a.rechercher')}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label={tr('Logs.filtrer.les.lignes')}
            className="min-w-48 flex-1"
          />
        </div>
      </div>

      {error && <ErrorBlock message={error} />}
      {loading && <LoadingBlock />}

      {!loading && !error && data && (
        <>
          {(() => {
            const needle = filter.trim().toLowerCase()
            const visible = needle
              ? data.lines.filter((l) => l.toLowerCase().includes(needle))
              : data.lines
            return (
              <>
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                  <span className="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-600">
                    {visible.length} {tr('Logs.ligne')}{visible.length > 1 ? 's' : ''}
                    {needle && ` / ${data.lines.length}`}
                  </span>
                  {data.file && (
                    <span className="truncate font-mono text-xs text-gray-400" title={data.file}>
                      {data.file}
                    </span>
                  )}
                  <InlineButton
                    className="ml-3"
                    onClick={() => void copyText(visible.join('\n'))}
                    disabled={visible.length === 0}
                    title={tr('Logs.copier.les.lignes.affichees.dans.le.presse.papiers')}
                  >
                    {copied ? 'Copié !' : 'Copier'}
                  </InlineButton>
                </div>

                {visible.length > 0 ? (
                  <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-950 shadow-sm">
                    <pre className="max-h-[70vh] overflow-auto p-4 font-mono text-xs leading-relaxed text-gray-100">
                      {visible.join('\n')}
                    </pre>
                  </div>
                ) : (
                  <EmptyState
                    title={needle ? 'Aucune ligne ne correspond au filtre' : 'Aucune ligne de log'}
                    description={
                      needle
                        ? `Aucune ligne ne contient « ${filter} ».`
                        : data.file
                          ? 'Le fichier de log est vide ou introuvable.'
                          : 'Aucun fichier de log configuré sur le serveur.'
                    }
                  />
                )}
              </>
            )
          })()}
        </>
      )}
    </div>
  )
}
