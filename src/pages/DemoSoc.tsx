import { tr } from '../i18n/translate'
import { useMemo, useState } from 'react'
import { socsApi, type DemoSocDto } from '../api/socs'
import { ApiError } from '../api/client'
import type { SocDto } from '../api/types'
import { useAsync } from '../lib/useAsync'
import { usePagination } from '../lib/usePagination'
import { useAuth } from '../auth/AuthContext'
import { Button, Card, RefreshButton, Spinner } from '../components/ui'
import { ErrorBlock, LoadingBlock, Modal, PageHeader, Pagination } from '../components/data'

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
      <span className="w-32 shrink-0 font-medium text-gray-500">{label}</span>
      <span className="font-mono text-gray-900">{value}</span>
    </div>
  )
}

export function DemoSoc() {
  const { user } = useAuth()
  const { data: socs, loading, error, reload } = useAsync(() => socsApi.findAll(), [])
  const [creating, setCreating] = useState(false)
  const [result, setResult] = useState<DemoSocDto | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const demoList = useMemo(
    () => (socs ?? []).filter((s) => s.name.toLowerCase().startsWith('demo ')),
    [socs],
  )
  const demoPage = usePagination(demoList, user?.pageSize ?? 5)

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
        title={tr('DemoSoc.societe.demo')}
        titleId="DemoSoc.societe.demo"
        count={demoList.length}
        subtitle={tr('DemoSoc.creer.une.societe.de.demonstration.numerotee.prete.a.l.emplo')}
        subtitleId="DemoSoc.creer.une.societe.de.demonstration.numerotee.prete.a.l.emplo"
        actions={<RefreshButton onClick={reload} />}
      />

      {error && <ErrorBlock message={error} />}
      {actionError && <div className="mb-4"><ErrorBlock message={actionError} /></div>}

      <Card className="mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="font-semibold text-gray-900">{tr('DemoSoc.nouvelle.societe.demo.numerotee')}</p>
          <p className="mt-1 text-sm text-gray-500">
            {tr('DemoSoc.la.prochaine.societe.sera.numerotee.automatiquement.ex.demo.')} <span className="font-mono">resp_demo&lt;n&gt;</span> {tr('DemoSoc.avec.le.mot.de.passe')} <span className="font-mono">{tr('DemoSoc.eisi.2020')}</span>.
          </p>
        </div>
        <Button className="w-auto" variant="primary" onClick={() => void createDemo()} disabled={creating}>
          {creating ? <Spinner className="border-white border-t-transparent" /> : null}
          {tr('DemoSoc.creer.une.societe.demo')}
        </Button>
      </Card>

      {loading && <LoadingBlock />}

      {!loading && demoList.length === 0 && (
        <Card className="flex flex-col items-center justify-center py-12 text-sm text-gray-500">
          {tr('DemoSoc.aucune.societe.demo.creee.pour.le.moment')}
        </Card>
      )}

      {!loading && demoList.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-12 px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-gray-400">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                    {tr('DemoSoc.societe.demo')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                    {tr('DemoSoc.gerant')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                    {tr('DemoSoc.siret')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {demoPage.pageItems.map((s: SocDto, i) => (
                  <tr key={s.id}>
                    <td className="w-12 px-4 py-3 text-right text-sm tabular-nums text-gray-400">
                      {demoPage.offset + i + 1}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.gerant ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.siret ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 pb-3">
            <Pagination
              page={demoPage.page}
              totalPages={demoPage.totalPages}
              total={demoPage.total}
              onChange={demoPage.setPage}
            />
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
            <InfoRow label={tr('DemoSoc.societe')} value={result.socName} />
            <InfoRow label={tr('DemoSoc.responsable')} value={result.username} />
            <InfoRow label={tr('DemoSoc.mot.de.passe')} value={result.password} />
            <InfoRow label={tr('DemoSoc.client')} value={result.clientName} />
            <InfoRow label={tr('DemoSoc.projet')} value={result.projectName} />
            <InfoRow label={tr('DemoSoc.activite')} value={result.activityName} />
            <InfoRow label={tr('DemoSoc.consultant')} value={result.consultantName} />
          </div>
        </Modal>
      )}
    </div>
  )
}
