import { useMemo, useState } from 'react'
import { socsApi, type DemoSocDto } from '../api/socs'
import { ApiError } from '../api/client'
import type { SocDto } from '../api/types'
import { useAsync } from '../lib/useAsync'
import { Button, Card, RefreshButton, Spinner } from '../components/ui'
import { ErrorBlock, LoadingBlock, Modal, PageHeader } from '../components/data'

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
      <span className="w-32 shrink-0 font-medium text-gray-500">{label}</span>
      <span className="font-mono text-gray-900">{value}</span>
    </div>
  )
}

export function DemoSoc() {
  const { data: socs, loading, error, reload } = useAsync(() => socsApi.findAll(), [])
  const [creating, setCreating] = useState(false)
  const [result, setResult] = useState<DemoSocDto | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const demoList = useMemo(
    () => (socs ?? []).filter((s) => s.name.toLowerCase().startsWith('demo ')),
    [socs],
  )

  async function createDemo() {
    setActionError(null)
    setCreating(true)
    try {
      const demo = await socsApi.createDemo()
      setResult(demo)
      reload()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Impossible de créer la société démo')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Société démo"
        subtitle="Créer une société de démonstration numérotée prête à l'emploi (responsable, client, projet, mission, consultant)."
        actions={<RefreshButton onClick={reload} />}
      />

      {error && <ErrorBlock message={error} />}
      {actionError && <div className="mb-4"><ErrorBlock message={actionError} /></div>}

      <Card className="mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="font-semibold text-gray-900">Nouvelle société démo numérotée</p>
          <p className="mt-1 text-sm text-gray-500">
            La prochaine société sera numérotée automatiquement (ex. « Demo 1 », « Demo 2 », …).
            Son responsable sera <span className="font-mono">resp_demo&lt;n&gt;</span> avec le mot de
            passe <span className="font-mono">Eisi.2020</span>.
          </p>
        </div>
        <Button className="w-auto" variant="yellow" onClick={() => void createDemo()} disabled={creating}>
          {creating ? <Spinner className="border-white border-t-transparent" /> : null}
          + Créer une société démo
        </Button>
      </Card>

      {loading && <LoadingBlock />}

      {!loading && demoList.length === 0 && (
        <Card className="flex flex-col items-center justify-center py-12 text-sm text-gray-500">
          Aucune société démo créée pour le moment.
        </Card>
      )}

      {!loading && demoList.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                    Société démo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                    Gérant
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                    SIRET
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {demoList.map((s: SocDto) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.gerant ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.siret ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {result && (
        <Modal
          open
          onClose={() => setResult(null)}
          title={`Société démo ${result.number} créée`}
          footer={
            <Button type="button" className="!w-auto" onClick={() => setResult(null)}>
              Fermer
            </Button>
          }
        >
          <div className="space-y-2">
            <InfoRow label="Société" value={result.socName} />
            <InfoRow label="Responsable" value={result.username} />
            <InfoRow label="Mot de passe" value={result.password} />
            <InfoRow label="Client" value={result.clientName} />
            <InfoRow label="Projet" value={result.projectName} />
            <InfoRow label="Activité" value={result.activityName} />
            <InfoRow label="Consultant" value={result.consultantName} />
          </div>
        </Modal>
      )}
    </div>
  )
}
