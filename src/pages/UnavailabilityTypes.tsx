import { tr } from '../i18n/translate'
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../api/client'
import { unavailabilityTypesApi } from '../api/unavailabilityTypes'
import { useAsync } from '../lib/useAsync'
import { useSoc } from '../soc/SocContext'
import { IconButton, Input, RefreshButton } from '../components/ui'
import { ErrorBlock, LoadingBlock, PageHeader } from '../components/data'
import { dialog } from '../components/dialog'
import type { UnavailabilityTypeConfigDto, UnavailabilityTypeConfigRow } from '../api/types'

interface RowForm {
  key: string
  typeLabel: string
  durationRule: string
  countType: string
  mainConditions: string
  remuneration: string
  cpAcquisition: string
  legalProvision: string
  syntecProvision: string
  documentRequired: string
}

let rowCounter = 0

function newKey(): string {
  rowCounter += 1
  return `row-${rowCounter}`
}

function emptyRow(): RowForm {
  return {
    key: newKey(),
    typeLabel: '',
    durationRule: '',
    countType: '',
    mainConditions: '',
    remuneration: '',
    cpAcquisition: '',
    legalProvision: '',
    syntecProvision: '',
    documentRequired: '',
  }
}

function toForm(dto: UnavailabilityTypeConfigDto): RowForm {
  return {
    key: newKey(),
    typeLabel: dto.typeLabel ?? '',
    durationRule: dto.durationRule ?? '',
    countType: dto.countType ?? '',
    mainConditions: dto.mainConditions ?? '',
    remuneration: dto.remuneration ?? '',
    cpAcquisition: dto.cpAcquisition ?? '',
    legalProvision: dto.legalProvision ?? '',
    syntecProvision: dto.syntecProvision ?? '',
    documentRequired: dto.documentRequired ?? '',
  }
}

function toRequest(row: RowForm): UnavailabilityTypeConfigRow {
  const text = (value: string) => {
    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
  }
  return {
    typeLabel: row.typeLabel.trim(),
    durationRule: text(row.durationRule),
    countType: text(row.countType),
    mainConditions: text(row.mainConditions),
    remuneration: text(row.remuneration),
    cpAcquisition: text(row.cpAcquisition),
    legalProvision: text(row.legalProvision),
    syntecProvision: text(row.syntecProvision),
    documentRequired: text(row.documentRequired),
  }
}

export function UnavailabilityTypes() {
  const { user } = useAuth()
  const { selectedSocId } = useSoc()
  const canEdit = user?.role === 'ADMIN' || user?.role === 'RESPONSIBLE_SOC'
  const workingSocId = selectedSocId ?? user?.socId ?? null

  const { data, loading, error, reload } = useAsync(
    () =>
      workingSocId
        ? unavailabilityTypesApi.list(workingSocId)
        : Promise.resolve([] as UnavailabilityTypeConfigDto[]),
    [workingSocId],
  )

  const [rows, setRows] = useState<RowForm[]>([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    setRows((data ?? []).map(toForm))
  }, [data])

  if (!user) return null
  if (!canEdit) return <Navigate to="/" replace />

  const columns: { key: keyof UnavailabilityTypeConfigRow; label: string; width: string }[] = [
    { key: 'typeLabel', label: tr('UnavailabilityTypes.col.type'), width: 'w-56' },
    { key: 'durationRule', label: tr('UnavailabilityTypes.col.duration'), width: 'w-56' },
    { key: 'countType', label: tr('UnavailabilityTypes.col.count'), width: 'w-40' },
    { key: 'mainConditions', label: tr('UnavailabilityTypes.col.conditions'), width: 'w-64' },
    { key: 'remuneration', label: tr('UnavailabilityTypes.col.remuneration'), width: 'w-56' },
    { key: 'cpAcquisition', label: tr('UnavailabilityTypes.col.cp'), width: 'w-64' },
    { key: 'legalProvision', label: tr('UnavailabilityTypes.col.legal'), width: 'w-56' },
    { key: 'syntecProvision', label: tr('UnavailabilityTypes.col.syntec'), width: 'w-64' },
    { key: 'documentRequired', label: tr('UnavailabilityTypes.col.document'), width: 'w-48' },
  ]

  function updateCell(key: string, field: keyof UnavailabilityTypeConfigRow, value: string) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, [field]: value } : row)))
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()])
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((row) => row.key !== key))
  }

  async function handleSave() {
    if (!workingSocId) {
      setFormError(tr('UnavailabilityTypes.noSoc'))
      return
    }
    if (rows.some((row) => row.typeLabel.trim() === '')) {
      setFormError(tr('UnavailabilityTypes.typeRequired'))
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const saved = await unavailabilityTypesApi.save(workingSocId, rows.map(toRequest))
      setRows(saved.map(toForm))
      void dialog.success(tr('UnavailabilityTypes.saved'))
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={tr('UnavailabilityTypes.title')}
        titleId="UnavailabilityTypes.title"
        count={rows.length}
        subtitle={tr('UnavailabilityTypes.subtitle')}
        subtitleId="UnavailabilityTypes.subtitle"
        actions={
          <>
            <RefreshButton onClick={reload} />
            <IconButton
              icon="add"
              label={tr('UnavailabilityTypes.addRow')}
              variant="new"
              onClick={addRow}
              id="UnavailabilityTypes.addRow"
            />
            <IconButton
              icon="save"
              label={tr('UnavailabilityTypes.save')}
              variant="primary"
              onClick={handleSave}
              loading={saving}
              disabled={saving}
              id="UnavailabilityTypes.save"
            />
          </>
        }
      />

      {formError && (
        <div className="mb-4">
          <ErrorBlock message={formError} />
        </div>
      )}
      {error && <ErrorBlock message={error} />}
      {loading && <LoadingBlock />}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-[1400px] w-full divide-y divide-gray-200">
            <thead style={{ backgroundColor: 'var(--table-header)' }}>
              <tr>
                <th className="w-12 px-3 py-3 text-right text-xs font-bold uppercase tracking-wide text-gray-400">
                  #
                </th>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`${column.width} px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500`}
                  >
                    {column.label}
                  </th>
                ))}
                <th className="w-16 px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {rows.map((row, index) => (
                <tr key={row.key} className="align-top even:bg-gray-50">
                  <td className="px-3 py-2 text-right text-sm tabular-nums text-gray-400">
                    {index + 1}
                  </td>
                  {columns.map((column) => (
                    <td key={column.key} className="px-3 py-2">
                      <Input
                        className="w-full"
                        value={row[column.key] ?? ''}
                        onChange={(e) => updateCell(row.key, column.key, e.target.value)}
                        aria-label={`${column.label}-${index + 1}`}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <IconButton
                      icon="delete"
                      label={tr('UnavailabilityTypes.deleteRow')}
                      variant="danger"
                      onClick={() => removeRow(row.key)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-gray-400">
              {tr('UnavailabilityTypes.empty')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
