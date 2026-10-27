import { tr } from '../i18n/translate'
import { crasApi } from '../api/cras'
import type { CraStatus } from '../api/types'
import { CRA_STATUS_LABELS, formatDateTime } from '../lib/format'
import { useAsync } from '../lib/useAsync'
import { useDynamicTranslate } from '../lib/useDynamicTranslate'
import { usePagination } from '../lib/usePagination'
import { useAuth } from '../auth/AuthContext'
import { ErrorBlock, LoadingBlock, Modal, Pagination } from './data'
import { IconButton } from './ui'

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
  const dt = useDynamicTranslate()
  const rows = history.data ?? []
  const page = usePagination(rows, user?.pageSize ?? 5)
  const statusLabel = (status: CraStatus | null) =>
    status == null ? '—' : dt(CRA_STATUS_LABELS[status] ?? status)

  return (
    <Modal
      open
      title={`${tr('CraHistoryModal.historique')} (${page.total})`}
      titleId="CraHistoryModal.historique.title"
      size="lg"
      onClose={onClose}
      footer={<IconButton id="CraHistoryModal.close" icon="close" label="Fermer" onClick={onClose} />}
    >
      {history.loading && <LoadingBlock />}
      {history.error && <ErrorBlock id="CraHistoryModal.error" message={history.error} />}
      {!history.loading && !history.error && rows.length === 0 && (
        <p id="CraHistoryModal.aucun.historique.pour" className="rounded-lg border border-dashed border-gray-300 px-3 py-6 text-center text-sm text-gray-400">
          {tr('CraHistoryModal.aucun.historique.pour')} {isIndispo ? 'cette Indispo' : 'ce CRA'}.
        </p>
      )}
      {!history.loading && rows.length > 0 && (
        <div className="max-h-96 overflow-x-auto overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead style={{ backgroundColor: 'var(--table-header)' }}>
              <tr>
                <th id="CraHistoryModal.index" className="w-12 px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-gray-400">
                  #
                </th>
                <th id="CraHistoryModal.date.modif" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                  {tr('CraHistoryModal.date.modif')}
                </th>
                <th id="CraHistoryModal.modifie.par" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                  {tr('CraHistoryModal.modifie.par')}
                </th>
                <th id="CraHistoryModal.commentaire" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                  {tr('CraHistoryModal.commentaire')}
                </th>
                <th id="CraHistoryModal.statut.avant" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                  {tr('CraHistoryModal.statut.avant')}
                </th>
                <th id="CraHistoryModal.statut.apres" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                  {tr('CraHistoryModal.statut.apres')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {page.pageItems.map((h, i) => (
                <tr key={h.id} id={`CraHistoryModal.row.${h.id}`} className="align-top">
                  <td id={`CraHistoryModal.row.${h.id}.index`} className="w-12 whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-gray-400">
                    {page.offset + i + 1}
                  </td>
                  <td id={`CraHistoryModal.row.${h.id}.date`} className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                    {formatDateTime(h.dateModif)}
                  </td>
                  <td id={`CraHistoryModal.row.${h.id}.modifier`} className="px-4 py-3 text-sm text-gray-900">{h.modifierName ?? '—'}</td>
                  <td id={`CraHistoryModal.row.${h.id}.comment`} className="max-w-64 px-4 py-3 text-sm text-gray-600">{h.comment || '—'}</td>
                  <td id={`CraHistoryModal.row.${h.id}.statusBefore`} className="px-4 py-3 text-sm text-gray-500">{statusLabel(h.statusBefore)}</td>
                  <td id={`CraHistoryModal.row.${h.id}.statusAfter`} className="px-4 py-3 text-sm text-gray-900">{statusLabel(h.statusAfter)}</td>
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
