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

function InfoRow({ label, value, id }: { label: string; value: string; id?: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
      <span id={id} className="w-32 shrink-0 font-medium text-gray-500">{label}</span>
      <span id={id ? `${id}.value` : undefined} className="font-mono text-gray-900">{value}</span>
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

      {error && <ErrorBlock id="DemoSoc.error" message={error} />}
      {actionError && <div className="mb-4"><ErrorBlock id="DemoSoc.actionError" message={actionError} /></div>}

      <Card id="DemoSoc.createCard" className="mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p id="DemoSoc.nouvelle.societe.demo.numerotee" className="font-semibold text-gray-900">{tr('DemoSoc.nouvelle.societe.demo.numerotee')}</p>
          <p id="DemoSoc.la.prochaine.societe.sera.numerotee.automatiquement.ex.demo." className="mt-1 text-sm text-gray-500">
            {tr('DemoSoc.la.prochaine.societe.sera.numerotee.automatiquement.ex.demo.')} <span id="DemoSoc.respDemoValue" className="font-mono">resp_demo&lt;n&gt;</span> {tr('DemoSoc.avec.le.mot.de.passe')} <span id="DemoSoc.eisi.2020" className="font-mono">{tr('DemoSoc.eisi.2020')}</span>.
          </p>
        </div>
        <Button id="DemoSoc.creer.une.societe.demo" className="w-auto" variant="primary" onClick={() => void createDemo()} disabled={creating}>
          {creating ? <Spinner className="border-white border-t-transparent" /> : null}
          {tr('DemoSoc.creer.une.societe.demo')}
        </Button>
      </Card>

      {loading && <LoadingBlock />}

      {!loading && demoList.length === 0 && (
        <Card id="DemoSoc.aucune.societe.demo.creee.pour.le.moment" className="flex flex-col items-center justify-center py-12 text-sm text-gray-500">
          {tr('DemoSoc.aucune.societe.demo.creee.pour.le.moment')}
        </Card>
      )}

      {!loading && demoList.length > 0 && (
        <Card id="DemoSoc.list" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th id="DemoSoc.table.index" className="w-12 px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-gray-400">
                    #
                  </th>
                  <th id="DemoSoc.societe.demo.column" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                    {tr('DemoSoc.societe.demo')}
                  </th>
                  <th id="DemoSoc.gerant" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                    {tr('DemoSoc.gerant')}
                  </th>
                  <th id="DemoSoc.siret" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                    {tr('DemoSoc.siret')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {demoPage.pageItems.map((s: SocDto, i) => (
                  <tr id={`DemoSoc.row.${s.id}`} key={s.id}>
                    <td id={`DemoSoc.row.${s.id}.index`} className="w-12 px-4 py-3 text-right text-sm tabular-nums text-gray-400">
                      {demoPage.offset + i + 1}
                    </td>
                    <td id={`DemoSoc.row.${s.id}.name`} className="px-4 py-3 text-sm font-medium text-gray-900">{s.name}</td>
                    <td id={`DemoSoc.row.${s.id}.gerant`} className="px-4 py-3 text-sm text-gray-600">{s.gerant ?? '—'}</td>
                    <td id={`DemoSoc.row.${s.id}.siret`} className="px-4 py-3 text-sm text-gray-600">{s.siret ?? '—'}</td>
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
          titleId="DemoSoc.result.title"
          title={`Société démo ${result.number} créée`}
          footer={
            <Button id="DemoSoc.result.close" type="button" className="!w-auto" onClick={() => setResult(null)}>
              Fermer
            </Button>
          }
        >
          <div className="space-y-2">
            <InfoRow id="DemoSoc.societe" label={tr('DemoSoc.societe')} value={result.socName} />
            <InfoRow id="DemoSoc.responsable" label={tr('DemoSoc.responsable')} value={result.username} />
            <InfoRow id="DemoSoc.mot.de.passe" label={tr('DemoSoc.mot.de.passe')} value={result.password} />
            <InfoRow id="DemoSoc.client" label={tr('DemoSoc.client')} value={result.clientName} />
            <InfoRow id="DemoSoc.projet" label={tr('DemoSoc.projet')} value={result.projectName} />
            <InfoRow id="DemoSoc.activite" label={tr('DemoSoc.activite')} value={result.activityName} />
            <InfoRow id="DemoSoc.consultant" label={tr('DemoSoc.consultant')} value={result.consultantName} />
          </div>
        </Modal>
      )}
    </div>
  )
}
