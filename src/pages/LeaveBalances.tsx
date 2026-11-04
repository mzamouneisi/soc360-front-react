import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { leaveApi } from '../api/leave'
import { consultantsApi } from '../api/consultants'
import { useAsync } from '../lib/useAsync'
import { useSoc } from '../soc/SocContext'
import { Card, Field, Input, RefreshButton, Select } from '../components/ui'
import { ErrorBlock, LoadingBlock, PageHeader, Table } from '../components/data'

export function LeaveBalances() {
  const { user } = useAuth()
  const { selectedSocId } = useSoc()
  const socId = selectedSocId ?? user?.socId ?? null
  const isConsultant = user?.role === 'CONSULTANT'
  const ownId = user?.consultantId ?? user?.id ?? null
  const [consultantId, setConsultantId] = useState<number | null>(isConsultant ? ownId : null)
  const [referenceDate, setReferenceDate] = useState(new Date().toISOString().slice(0, 10))

  const { data: collaborators } = useAsync(
    () => (!isConsultant && socId ? consultantsApi.collaborators(socId) : Promise.resolve([])),
    [isConsultant, socId],
  )
  const selectedId = consultantId ?? (isConsultant ? ownId : (collaborators ?? [])[0]?.id ?? null)

  const { data, loading, error, reload } = useAsync(
    () => (selectedId ? leaveApi.balance(selectedId, referenceDate) : Promise.resolve(null)),
    [selectedId, referenceDate],
  )

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

      {data && (
        <div className="space-y-6">
          {data.balances.map((balance) => (
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
                  rowKey={(lot) => lot.id}
                  rows={balance.lots}
                  columns={[
                    { key: 'period', label: 'Période', render: (lot) => <span id={`LeaveBalances.${balance.leaveType}.lot.${lot.id}.period`}>{lot.periodKey}</span> },
                    { key: 'quantity', label: 'Acquis', render: (lot) => <span id={`LeaveBalances.${balance.leaveType}.lot.${lot.id}.quantity`}>{lot.quantity}</span> },
                    { key: 'remaining', label: 'Restant', render: (lot) => <span id={`LeaveBalances.${balance.leaveType}.lot.${lot.id}.remaining`}>{lot.remaining}</span> },
                    { key: 'credit', label: 'Crédit', render: (lot) => <span id={`LeaveBalances.${balance.leaveType}.lot.${lot.id}.credit`}>{lot.creditDate}</span> },
                    { key: 'expiration', label: 'Expiration', render: (lot) => <span id={`LeaveBalances.${balance.leaveType}.lot.${lot.id}.expiration`}>{lot.expirationDate ?? '—'}</span> },
                  ]}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
