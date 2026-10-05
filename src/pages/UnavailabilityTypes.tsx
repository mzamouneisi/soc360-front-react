import { tr } from '../i18n/translate'
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../api/client'
import { unavailabilityTypesApi } from '../api/unavailabilityTypes'
import { useAsync } from '../lib/useAsync'
import { useSoc } from '../soc/SocContext'
import { Card, Field, IconButton, Input, RefreshButton } from '../components/ui'
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader, Table } from '../components/data'
import { dialog } from '../components/dialog'
import type { UnavailabilityTypeConfigDto, UnavailabilityTypeConfigRow } from '../api/types'

interface RowForm {
  key: string
  typeLabel: string
  duration: string
  countType: string
  mainConditions: string
  remuneration: boolean
  cpAcquisition: boolean
  legalProvision: boolean
  collectiveAgreementProvision: string
  documentRequired: boolean
}

interface EditingState {
  original: RowForm | null
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
    duration: '',
    countType: '',
    mainConditions: '',
    remuneration: false,
    cpAcquisition: false,
    legalProvision: false,
    collectiveAgreementProvision: '',
    documentRequired: false,
  }
}

function toForm(dto: UnavailabilityTypeConfigDto): RowForm {
  return {
    key: newKey(),
    typeLabel: dto.typeLabel ?? '',
    duration: dto.duration == null ? '' : String(dto.duration),
    countType: dto.countType ?? '',
    mainConditions: dto.mainConditions ?? '',
    remuneration: dto.remuneration ?? false,
    cpAcquisition: dto.cpAcquisition ?? false,
    legalProvision: dto.legalProvision ?? false,
    collectiveAgreementProvision: dto.collectiveAgreementProvision ?? '',
    documentRequired: dto.documentRequired ?? false,
  }
}

function parseDuration(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null
}

function toRequest(row: RowForm): UnavailabilityTypeConfigRow {
  const text = (value: string) => {
    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
  }
  return {
    typeLabel: row.typeLabel.trim(),
    duration: parseDuration(row.duration),
    countType: text(row.countType),
    mainConditions: text(row.mainConditions),
    remuneration: row.remuneration,
    cpAcquisition: row.cpAcquisition,
    legalProvision: row.legalProvision,
    collectiveAgreementProvision: text(row.collectiveAgreementProvision),
    documentRequired: row.documentRequired,
  }
}

function sameRow(a: RowForm, b: RowForm): boolean {
  return (
    a.typeLabel === b.typeLabel &&
    a.duration === b.duration &&
    a.countType === b.countType &&
    a.mainConditions === b.mainConditions &&
    a.remuneration === b.remuneration &&
    a.cpAcquisition === b.cpAcquisition &&
    a.legalProvision === b.legalProvision &&
    a.collectiveAgreementProvision === b.collectiveAgreementProvision &&
    a.documentRequired === b.documentRequired
  )
}

function yesNo(value: boolean): string {
  return value ? tr('common.yes') : tr('common.no')
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
  const [editing, setEditing] = useState<EditingState | null>(null)
  const [form, setForm] = useState<RowForm>(emptyRow())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    setRows((data ?? []).map(toForm))
    setEditing(null)
    setFormError(null)
  }, [data])

  if (!user) return null
  if (!canEdit) return <Navigate to="/" replace />

  const isNew = editing != null && editing.original == null
  const isDirty = editing != null && editing.original != null && !sameRow(form, editing.original)

  function setField<K extends keyof RowForm>(key: K, value: RowForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function openCreate() {
    const row = emptyRow()
    setForm(row)
    setEditing({ original: null })
    setFormError(null)
  }

  function openEdit(row: RowForm) {
    setForm({ ...row })
    setEditing({ original: row })
    setFormError(null)
  }

  async function persist(nextRows: RowForm[], closeAfter: boolean) {
    if (!workingSocId) {
      setFormError(tr('UnavailabilityTypes.noSoc'))
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const saved = await unavailabilityTypesApi.save(workingSocId, nextRows.map(toRequest))
      setRows(saved.map(toForm))
      if (closeAfter) {
        setEditing(null)
        setFormError(null)
      }
      return true
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleSave() {
    if (!editing) return
    if (form.typeLabel.trim() === '') {
      setFormError(tr('UnavailabilityTypes.typeRequired'))
      return
    }
    const nextRows = editing.original == null
      ? [...rows, form]
      : rows.map((row) => (row.key === editing.original!.key ? form : row))
    const ok = await persist(nextRows, true)
    if (ok) void dialog.success(tr('UnavailabilityTypes.saved'))
  }

  async function handleClose() {
    if (isDirty) {
      const save = await dialog.confirm(tr('UnavailabilityTypes.confirmSave'), {
        variant: 'question',
        okLabel: tr('common.save'),
      })
      if (save) {
        await handleSave()
        return
      }
    }
    setEditing(null)
    setFormError(null)
  }

  async function handleDelete(row: RowForm) {
    if (!workingSocId) return
    if (
      !(await dialog.confirm(tr('UnavailabilityTypes.confirmDelete', { type: row.typeLabel }), {
        variant: 'warning',
        danger: true,
        okLabel: tr('common.delete'),
      }))
    ) {
      return
    }
    const nextRows = rows.filter((r) => r.key !== row.key)
    await persist(nextRows, false)
    if (editing?.original?.key === row.key) {
      setEditing(null)
    }
  }

  const columns = [
    { key: 'typeLabel', label: tr('UnavailabilityTypes.col.type'), render: (r: RowForm) => r.typeLabel },
    {
      key: 'duration',
      label: tr('UnavailabilityTypes.col.duration'),
      render: (r: RowForm) => (r.duration.trim() === '' ? '—' : `${r.duration} j`),
    },
    { key: 'countType', label: tr('UnavailabilityTypes.col.count'), render: (r: RowForm) => r.countType || '—' },
    {
      key: 'mainConditions',
      label: tr('UnavailabilityTypes.col.conditions'),
      render: (r: RowForm) => r.mainConditions || '—',
    },
    { key: 'remuneration', label: tr('UnavailabilityTypes.col.remuneration'), render: (r: RowForm) => yesNo(r.remuneration) },
    { key: 'cpAcquisition', label: tr('UnavailabilityTypes.col.cp'), render: (r: RowForm) => yesNo(r.cpAcquisition) },
    { key: 'legalProvision', label: tr('UnavailabilityTypes.col.legal'), render: (r: RowForm) => yesNo(r.legalProvision) },
    {
      key: 'collectiveAgreementProvision',
      label: tr('UnavailabilityTypes.col.syntec'),
      render: (r: RowForm) => r.collectiveAgreementProvision || '—',
    },
    { key: 'documentRequired', label: tr('UnavailabilityTypes.col.document'), render: (r: RowForm) => yesNo(r.documentRequired) },
    {
      key: 'actions',
      label: '',
      render: (r: RowForm) => (
        <div className="flex justify-end gap-1">
          <IconButton icon="edit" label={tr('common.edit')} onClick={() => openEdit(r)} id="common.edit" />
          <IconButton
            icon="delete"
            label={tr('UnavailabilityTypes.deleteRow')}
            variant="danger"
            onClick={() => handleDelete(r)}
          />
        </div>
      ),
    },
  ]

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
              label={tr('UnavailabilityTypes.new')}
              variant="new"
              onClick={openCreate}
              id="UnavailabilityTypes.new"
            />
          </>
        }
      />

      {error && <ErrorBlock message={error} />}
      {loading && <LoadingBlock />}

      {!loading && !error && (
        <Table
          paginate
          rowKey={(r) => r.key}
          rows={rows}
          columns={columns}
          empty={<EmptyState title={tr('UnavailabilityTypes.empty')} />}
        />
      )}

      {editing && (
        <Card className="mt-6 p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            {isNew ? tr('UnavailabilityTypes.form.new') : tr('UnavailabilityTypes.form.edit')}
          </h3>
          {formError && (
            <div className="mb-4">
              <ErrorBlock message={formError} />
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={tr('UnavailabilityTypes.col.type')} id="UnavailabilityTypes.form.type">
              <Input
                aria-label={tr('UnavailabilityTypes.col.type')}
                value={form.typeLabel}
                onChange={(e) => setField('typeLabel', e.target.value)}
              />
            </Field>
            <Field label={tr('UnavailabilityTypes.col.duration')} id="UnavailabilityTypes.form.duration">
              <Input
                type="number"
                aria-label={tr('UnavailabilityTypes.col.duration')}
                value={form.duration}
                onChange={(e) => setField('duration', e.target.value)}
              />
            </Field>
            <Field label={tr('UnavailabilityTypes.col.count')} id="UnavailabilityTypes.form.count">
              <Input
                aria-label={tr('UnavailabilityTypes.col.count')}
                value={form.countType}
                onChange={(e) => setField('countType', e.target.value)}
              />
            </Field>
            <Field label={tr('UnavailabilityTypes.col.conditions')} id="UnavailabilityTypes.form.conditions">
              <Input
                aria-label={tr('UnavailabilityTypes.col.conditions')}
                value={form.mainConditions}
                onChange={(e) => setField('mainConditions', e.target.value)}
              />
            </Field>
            <Field
              label={tr('UnavailabilityTypes.col.syntec')}
              id="UnavailabilityTypes.form.collectiveAgreement"
            >
              <Input
                aria-label={tr('UnavailabilityTypes.col.syntec')}
                value={form.collectiveAgreementProvision}
                onChange={(e) => setField('collectiveAgreementProvision', e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label={tr('UnavailabilityTypes.col.remuneration')} id="UnavailabilityTypes.form.remuneration">
                <input
                  type="checkbox"
                  aria-label={tr('UnavailabilityTypes.col.remuneration')}
                  className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  checked={form.remuneration}
                  onChange={(e) => setField('remuneration', e.target.checked)}
                />
              </Field>
              <Field label={tr('UnavailabilityTypes.col.cp')} id="UnavailabilityTypes.form.cp">
                <input
                  type="checkbox"
                  aria-label={tr('UnavailabilityTypes.col.cp')}
                  className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  checked={form.cpAcquisition}
                  onChange={(e) => setField('cpAcquisition', e.target.checked)}
                />
              </Field>
              <Field label={tr('UnavailabilityTypes.col.legal')} id="UnavailabilityTypes.form.legal">
                <input
                  type="checkbox"
                  aria-label={tr('UnavailabilityTypes.col.legal')}
                  className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  checked={form.legalProvision}
                  onChange={(e) => setField('legalProvision', e.target.checked)}
                />
              </Field>
              <Field label={tr('UnavailabilityTypes.col.document')} id="UnavailabilityTypes.form.document">
                <input
                  type="checkbox"
                  aria-label={tr('UnavailabilityTypes.col.document')}
                  className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  checked={form.documentRequired}
                  onChange={(e) => setField('documentRequired', e.target.checked)}
                />
              </Field>
            </div>
          </div>
          <div className="mt-6 flex items-center justify-end gap-2">
            <IconButton
              icon="close"
              label={tr('common.close')}
              onClick={handleClose}
              disabled={saving}
              id="UnavailabilityTypes.close"
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
          </div>
        </Card>
      )}
    </div>
  )
}
