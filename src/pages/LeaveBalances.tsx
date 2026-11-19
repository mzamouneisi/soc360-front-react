import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { leaveApi } from '../api/leave'
import { consultantsApi } from '../api/consultants'
import { useAsync } from '../lib/useAsync'
import { useSoc } from '../soc/SocContext'
import { Card, Field, Input, RefreshButton, Select } from '../components/ui'
import { ErrorBlock, LoadingBlock, PageHeader, Table } from '../components/data'
import { formatDate, formatDateTime } from '../lib/format'
import type { LeaveMovementType } from '../api/types'

const MOVEMENT_LABELS: Record<LeaveMovementType, string> = {
  ACCRUAL: 'Acquisition',
  CONSUMPTION: 'Consommation',
  REGULARIZATION: 'Régularisation',
  EXPIRATION: 'Expiration',
  CARRYOVER: 'Report',
  ADJUSTMENT: 'Ajustement',
  CORRECTION: 'Correction',
}

export function LeaveBalances() {
  const { user } = useAuth()
  const { selectedSocId } = useSoc()
  const socId = selectedSocId ?? user?.socId ?? null
  const isConsultant = user?.role === 'CONSULTANT'
  // Un collaborateur non salarié n'a pas de solde : il est sélectionné par défaut, mais un
  // manager/responsable non salarié peut toujours consulter les soldes de ses collaborateurs.
  const nonEmployeeUser = user?.employee === false
  const ownId = user?.consultantId ?? user?.id ?? null
  const [consultantId, setConsultantId] = useState<number | null>(
    isConsultant || nonEmployeeUser ? ownId : null,
  )
  const [referenceDate, setReferenceDate] = useState(new Date().toISOString().slice(0, 10))

  const { data: collaborators } = useAsync(
    () => (!isConsultant && socId ? consultantsApi.collaborators(socId) : Promise.resolve([])),
    [isConsultant, socId],
  )
  const selectedId = consultantId ?? (isConsultant ? ownId : (collaborators ?? [])[0]?.id ?? null)

  // Le statut salarié vient du consultant dont on consulte le solde (soi-même ou un collaborateur).
  const { data, loading, error, reload } = useAsync(
    () => (selectedId ? leaveApi.balance(selectedId, referenceDate) : Promise.resolve(null)),
    [selectedId, referenceDate],
  )
  // Journal d'audit : acquisitions, consommations, expirations, ajustements et corrections.
  const { data: movements } = useAsync(
    () => (selectedId ? leaveApi.movements(selectedId) : Promise.resolve([])),
    [selectedId],
  )
  const nonEmployee = data?.employee === false

  return (
    <div>
      <PageHeader
        title="Soldes de congés"
        titleId="LeaveBalances.title"
        actions={<RefreshButton onClick={reload} />}
      />

      <div className="mb-4 flex w-fit items-end gap-2">
        {!isConsultant && (
          <Field label="Consultant" id="LeaveBalances.consultant.label">
            <Select
              id="LeaveBalances.consultant"
              className="w-56"
              value={selectedId ?? ''}
              onChange={(e) => setConsultantId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">—</option>
              {(collaborators ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.fullName}</option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Date de simulation" id="LeaveBalances.date.label">
          <Input
            id="LeaveBalances.date"
            className="w-auto"
            type="date"
            value={referenceDate}
            onChange={(e) => setReferenceDate(e.target.value)}
          />
        </Field>
      </div>

      {error && <ErrorBlock id="LeaveBalances.error" message={error} />}
      {loading && <LoadingBlock />}

      {nonEmployee && (
        <Card id="LeaveBalances.non.salarie" className="p-5 text-sm text-gray-600">
          Pas de soldes de congés pour les non salariés.
        </Card>
      )}

      {data && !nonEmployee && (
        <div className="space-y-6">
          {data.balances.map((balance) => {
            const typeMovements = (movements ?? []).filter(
              (movement) => movement.leaveType === balance.leaveType,
            )
            return (
            <div key={balance.leaveType}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <Card id={`LeaveBalances.${balance.leaveType}.balance`} className="p-4">
                  <p className="text-sm font-medium text-gray-500">Solde {balance.leaveType}</p>
                  <p id={`LeaveBalances.${balance.leaveType}.balance.value`} className="mt-2 text-2xl font-bold text-gray-900">{balance.balance}</p>
                </Card>
                <Card id={`LeaveBalances.${balance.leaveType}.accrued`} className="p-4">
                  <p className="text-sm font-medium text-gray-500">Droits acquis</p>
                  <p id={`LeaveBalances.${balance.leaveType}.accrued.value`} className="mt-2 text-xl font-semibold text-gray-900">{balance.accrued}</p>
                </Card>
                <Card id={`LeaveBalances.${balance.leaveType}.consumed`} className="p-4">
                  <p className="text-sm font-medium text-gray-500">Absences déduites</p>
                  <p id={`LeaveBalances.${balance.leaveType}.consumed.value`} className="mt-2 text-xl font-semibold text-gray-900">{balance.consumed}</p>
                </Card>
                <Card id={`LeaveBalances.${balance.leaveType}.expired`} className="p-4">
                  <p className="text-sm font-medium text-gray-500">Droits expirés</p>
                  <p id={`LeaveBalances.${balance.leaveType}.expired.value`} className="mt-2 text-xl font-semibold text-gray-900">{balance.expired}</p>
                </Card>
                <Card id={`LeaveBalances.${balance.leaveType}.adjustments`} className="p-4">
                  <p className="text-sm font-medium text-gray-500">Ajustements</p>
                  <p id={`LeaveBalances.${balance.leaveType}.adjustments.value`} className="mt-2 text-xl font-semibold text-gray-900">{balance.adjustments}</p>
                </Card>
              </div>

              <div className="mt-4">
                <h3 id={`LeaveBalances.${balance.leaveType}.lots.title`} className="mb-2 text-sm font-semibold text-gray-700">
                  Lots de droits {balance.leaveType}
                </h3>
                <Table
                  paginate
                  paginationId={`LeaveBalances.${balance.leaveType}.lots`}
                  rowKey={(lot) => lot.id}
                  rows={balance.lots}
                  columns={[
                    { key: 'period', label: 'Période', render: (lot) => <span id={`LeaveBalances.${balance.leaveType}.lot.${lot.id}.period`}>{lot.periodKey}</span> },
                    { key: 'quantity', label: 'Acquis', render: (lot) => <span id={`LeaveBalances.${balance.leaveType}.lot.${lot.id}.quantity`}>{lot.quantity}</span> },
                    { key: 'remaining', label: 'Restant', render: (lot) => <span id={`LeaveBalances.${balance.leaveType}.lot.${lot.id}.remaining`}>{lot.remaining}</span> },
                    { key: 'credit', label: 'Crédit', render: (lot) => <span id={`LeaveBalances.${balance.leaveType}.lot.${lot.id}.credit`}>{formatDate(lot.creditDate)}</span> },
                    { key: 'acquisition', label: 'Acquisition', render: (lot) => <span id={`LeaveBalances.${balance.leaveType}.lot.${lot.id}.acquisition`}>{formatDate(lot.acquisitionStart)} → {formatDate(lot.acquisitionEnd)}</span> },
                    { key: 'usage', label: 'Utilisation', render: (lot) => <span id={`LeaveBalances.${balance.leaveType}.lot.${lot.id}.usage`}>{formatDate(lot.usageStart)} → {formatDate(lot.usageEnd)}</span> },
                    { key: 'expiration', label: 'Expiration', render: (lot) => <span id={`LeaveBalances.${balance.leaveType}.lot.${lot.id}.expiration`}>{lot.expirationDate ? formatDate(lot.expirationDate) : '—'}</span> },
                  ]}
                />
              </div>

              <div className="mt-4">
                <h3 id={`LeaveBalances.${balance.leaveType}.movements.title`} className="mb-2 text-sm font-semibold text-gray-700">
                  Journal des mouvements {balance.leaveType}
                </h3>
                {typeMovements.length === 0 ? (
                  <p id={`LeaveBalances.${balance.leaveType}.movements.empty`} className="text-sm text-gray-400">
                    Aucun mouvement
                  </p>
                ) : (
                  <Table
                    paginate
                    paginationId={`LeaveBalances.${balance.leaveType}.movements`}
                    rowKey={(movement) => movement.id}
                    rows={typeMovements}
                    columns={[
                      { key: 'date', label: 'Date', render: (m) => <span id={`LeaveBalances.${balance.leaveType}.movement.${m.id}.date`}>{formatDateTime(m.movementDate)}</span> },
                      { key: 'nature', label: 'Nature', render: (m) => <span id={`LeaveBalances.${balance.leaveType}.movement.${m.id}.nature`}>{MOVEMENT_LABELS[m.movementType]}</span> },
                      { key: 'quantity', label: 'Jours', render: (m) => <span id={`LeaveBalances.${balance.leaveType}.movement.${m.id}.quantity`}>{m.quantity}</span> },
                      { key: 'origin', label: 'Origine', render: (m) => <span id={`LeaveBalances.${balance.leaveType}.movement.${m.id}.origin`}>{m.origin}</span> },
                      { key: 'actor', label: 'Auteur', render: (m) => <span id={`LeaveBalances.${balance.leaveType}.movement.${m.id}.actor`}>{m.actorName ?? '—'}</span> },
                      { key: 'reason', label: 'Motif', render: (m) => <span id={`LeaveBalances.${balance.leaveType}.movement.${m.id}.reason`}>{m.reason ?? '—'}</span> },
                      { key: 'balance', label: 'Solde après', render: (m) => <span id={`LeaveBalances.${balance.leaveType}.movement.${m.id}.balance`}>{m.balanceAfter}</span> },
                    ]}
                  />
                )}
              </div>
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
