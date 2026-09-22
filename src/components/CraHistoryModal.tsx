import { tr } from '../i18n/translate'
import { crasApi } from '../api/cras'
import type { CraStatus } from '../api/types'
import { CRA_STATUS_LABELS, formatDateTime } from '../lib/format'
import { useAsync } from '../lib/useAsync'
import { usePagination } from '../lib/usePagination'
import { useAuth } from '../auth/AuthContext'
import { ErrorBlock, LoadingBlock, Modal, Pagination } from './data'
import { InlineButton } from './ui'

export function CraHistoryModal({
  craId,
  isIndispo = false,
  onClose,
}: {
  craId: number
  isIndispo?: boolean
  onClose: () => void
}) {
  const history = useAsync(() => crasApi.history(craId), [craId])
  const { user } = useAuth()
  const rows = history.data ?? []
  const page = usePagination(rows, user?.pageSize ?? 5)
  const statusLabel = (status: CraStatus | null) =>
    status == null ? '—' : CRA_STATUS_LABELS[status] ?? status

  return (
    <Modal
      open
      title={`${tr('CraHistoryModal.historique')} (${page.total})`}
      size="lg"
      onClose={onClose}
      footer={<InlineButton onClick={onClose}>Fermer</InlineButton>}
    >
      {history.loading && <LoadingBlock />}
      {history.error && <ErrorBlock message={history.error} />}
      {!history.loading && !history.error && rows.length === 0 && (
        <p className="rounded-lg border border-dashed border-gray-300 px-3 py-6 text-center text-sm text-gray-400">
          {tr('CraHistoryModal.aucun.historique.pour')} {isIndispo ? 'cette Indispo' : 'ce CRA'}.
        </p>
      )}
      {!history.loading && rows.length > 0 && (
        <div className="max-h-96 overflow-x-auto overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead style={{ backgroundColor: 'var(--table-header)' }}>
              <tr>
                <th className="w-12 px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-gray-400">
                  #
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                  {tr('CraHistoryModal.date.modif')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                  {tr('CraHistoryModal.modifie.par')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                  {tr('CraHistoryModal.commentaire')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                  {tr('CraHistoryModal.statut.avant')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                  {tr('CraHistoryModal.statut.apres')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {page.pageItems.map((h, i) => (
                <tr key={h.id} className="align-top">
                  <td className="w-12 whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-gray-400">
                    {page.offset + i + 1}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                    {formatDateTime(h.dateModif)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{h.modifierName ?? '—'}</td>
                  <td className="max-w-64 px-4 py-3 text-sm text-gray-600">{h.comment ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{statusLabel(h.statusBefore)}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{statusLabel(h.statusAfter)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!history.loading && !history.error && rows.length > 0 && (
        <Pagination
          page={page.page}
          totalPages={page.totalPages}
          total={page.total}
          onChange={page.setPage}
        />
      )}
    </Modal>
  )
}
