import { tr } from '../i18n/translate'
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../api/client'
import { unavailabilityTypesApi } from '../api/unavailabilityTypes'
import { useAsync } from '../lib/useAsync'
import { useSoc } from '../soc/SocContext'
import { Badge, EmptyState, ErrorBlock, LoadingBlock, Modal, PageHeader, Table } from '../components/data'
import { Button, Field, IconButton, Input, RefreshButton, Select, Textarea } from '../components/ui'
import { dialog } from '../components/dialog'
import type {
  CountType,
  DurationUnit,
  UnavailabilityTypeConfigDto,
  UnavailabilityTypeConfigRequest,
  UnavailabilityTypeStatus,
} from '../api/types'

const DURATION_UNITS: DurationUnit[] = ['DAYS', 'MONTHS', 'YEARS']
const COUNT_TYPES: CountType[] = ['OUVRE', 'OUVRABLE', 'CALENDAIRE', 'MOIS', 'ANNEE']

interface FormState {
  name: string
  durationValue: string
  durationUnit: DurationUnit
  countType: CountType
  remuneration: '' | 'true' | 'false'
  paidLeaveAccrual: 'true' | 'false'
  providedByLaw: 'true' | 'false'
  providedByCollectiveAgreement: 'true' | 'false'
  documentRequired: 'true' | 'false'
  mainCondition: string
}

function emptyForm(): FormState {
  return {
    name: '',
    durationValue: '',
    durationUnit: 'DAYS',
    countType: 'OUVRE',
    remuneration: '',
    paidLeaveAccrual: 'true',
    providedByLaw: 'true',
    providedByCollectiveAgreement: 'true',
    documentRequired: 'false',
    mainCondition: '',
  }
}

function toForm(dto: UnavailabilityTypeConfigDto): FormState {
  return {
    name: dto.name ?? '',
    durationValue: dto.durationValue == null ? '' : String(dto.durationValue),
    durationUnit: dto.durationUnit ?? 'DAYS',
    countType: dto.countType ?? 'OUVRE',
    remuneration:
      dto.remuneration == null ? '' : dto.remuneration ? 'true' : 'false',
    paidLeaveAccrual: dto.paidLeaveAccrual ? 'true' : 'false',
    providedByLaw: dto.providedByLaw ? 'true' : 'false',
    providedByCollectiveAgreement: dto.providedByCollectiveAgreement ? 'true' : 'false',
    documentRequired: dto.documentRequired ? 'true' : 'false',
    mainCondition: dto.mainCondition ?? '',
  }
}

function booleanValue(value: '' | 'true' | 'false'): boolean | null {
  if (value === '') return null
  return value === 'true'
}

function requiredBoolean(value: 'true' | 'false'): boolean | null {
  if (value !== 'true' && value !== 'false') return null
  return value === 'true'
}

function toRequest(form: FormState, socId: number | null): UnavailabilityTypeConfigRequest {
  const duration = Number(form.durationValue.replace(',', '.'))
  return {
    socId,
    name: form.name.trim(),
    durationValue: Number.isFinite(duration) ? duration : null,
    durationUnit: form.durationUnit,
    countType: form.countType,
    remuneration: booleanValue(form.remuneration),
    paidLeaveAccrual: requiredBoolean(form.paidLeaveAccrual),
    providedByLaw: requiredBoolean(form.providedByLaw),
    providedByCollectiveAgreement: requiredBoolean(form.providedByCollectiveAgreement),
    documentRequired: requiredBoolean(form.documentRequired),
    mainCondition: form.mainCondition.trim() || null,
  }
}

function yesNo(value: boolean | null): string {
  if (value == null) return ''
  return value ? tr('common.yes') : tr('common.no')
}

function unitLabel(unit: DurationUnit): string {
  return tr(`UnavailabilityTypes.unit.${unit}`)
}

function countTypeLabel(countType: CountType): string {
  return tr(`UnavailabilityTypes.countType.${countType}`)
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

  const [rows, setRows] = useState<UnavailabilityTypeConfigDto[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    setRows(data ?? [])
  }, [data])

  if (!user) return null
  if (!canEdit) return <Navigate to="/" replace />

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm())
    setFormError(null)
    setFormOpen(true)
  }

  function openEdit(dto: UnavailabilityTypeConfigDto) {
    setEditingId(dto.id)
    setForm(toForm(dto))
    setFormError(null)
    setFormOpen(true)
  }

  async function handleSave() {
    if (!workingSocId) {
      setFormError(tr('UnavailabilityTypes.noSoc'))
      return
    }
    if (form.name.trim() === '') {
      setFormError(tr('UnavailabilityTypes.typeRequired'))
      return
    }
    const duration = Number(form.durationValue.replace(',', '.'))
    if (!Number.isFinite(duration) || duration <= 0) {
      setFormError(tr('UnavailabilityTypes.durationInvalid'))
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const request = toRequest(form, workingSocId)
      if (editingId != null) {
        await unavailabilityTypesApi.update(editingId, request)
      } else {
        await unavailabilityTypesApi.create(request)
      }
      setFormOpen(false)
      reload()
      void dialog.success(tr('UnavailabilityTypes.saved'))
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDisable(row: UnavailabilityTypeConfigDto) {
    if (!(await dialog.confirm(tr('UnavailabilityTypes.confirmDisable'), {
      variant: 'warning',
      okLabel: tr('UnavailabilityTypes.disable'),
    }))) {
      return
    }
    try {
      await unavailabilityTypesApi.disable(row.id)
      reload()
    } catch (err) {
      void dialog.error(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    }
  }

  async function handleDelete(row: UnavailabilityTypeConfigDto) {
    if (!(await dialog.confirm(tr('UnavailabilityTypes.confirmDelete', { type: row.name }), {
      variant: 'warning',
      danger: true,
      okLabel: tr('common.delete'),
    }))) {
      return
    }
    try {
      await unavailabilityTypesApi.remove(row.id)
      reload()
    } catch (err) {
      void dialog.error(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    }
  }

  const statusBadge = (status: UnavailabilityTypeStatus) =>
    status === 'ACTIVE' ? 'success' : 'muted'

  const columns = [
    { key: 'name', label: tr('UnavailabilityTypes.col.type'), render: (r: UnavailabilityTypeConfigDto) => r.name },
    {
      key: 'duration',
      label: tr('UnavailabilityTypes.col.duration'),
      render: (r: UnavailabilityTypeConfigDto) =>
        r.durationValue == null ? '' : String(r.durationValue),
    },
    {
      key: 'durationUnit',
      label: tr('UnavailabilityTypes.col.durationUnit'),
      render: (r: UnavailabilityTypeConfigDto) => unitLabel(r.durationUnit),
    },
    {
      key: 'countType',
      label: tr('UnavailabilityTypes.col.count'),
      render: (r: UnavailabilityTypeConfigDto) => countTypeLabel(r.countType),
    },
    {
      key: 'mainCondition',
      label: tr('UnavailabilityTypes.col.conditions'),
      render: (r: UnavailabilityTypeConfigDto) => r.mainCondition ?? '',
    },
    {
      key: 'remuneration',
      label: tr('UnavailabilityTypes.col.remuneration'),
      render: (r: UnavailabilityTypeConfigDto) => yesNo(r.remuneration),
    },
    {
      key: 'paidLeaveAccrual',
      label: tr('UnavailabilityTypes.col.cp'),
      render: (r: UnavailabilityTypeConfigDto) => yesNo(r.paidLeaveAccrual),
    },
    {
      key: 'providedByLaw',
      label: tr('UnavailabilityTypes.col.legal'),
      render: (r: UnavailabilityTypeConfigDto) => yesNo(r.providedByLaw),
    },
    {
      key: 'providedByCollectiveAgreement',
      label: tr('UnavailabilityTypes.col.syntec'),
      render: (r: UnavailabilityTypeConfigDto) => yesNo(r.providedByCollectiveAgreement),
    },
    {
      key: 'documentRequired',
      label: tr('UnavailabilityTypes.col.document'),
      render: (r: UnavailabilityTypeConfigDto) => yesNo(r.documentRequired),
    },
    {
      key: 'status',
      label: tr('UnavailabilityTypes.col.status'),
      render: (r: UnavailabilityTypeConfigDto) => (
        <Badge id={`UnavailabilityTypes.status.${r.id}`} kind={statusBadge(r.status)}>
          {tr(`UnavailabilityTypes.status.${r.status}`)}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (r: UnavailabilityTypeConfigDto) => (
        <div className="flex justify-end gap-1">
          <IconButton icon="edit" label={tr('common.edit')} onClick={() => openEdit(r)} id={`common.edit.${r.id}`} />
          {r.status === 'ACTIVE' && (
            <IconButton
              icon="cancel"
              label={tr('UnavailabilityTypes.disable')}
              variant="danger"
              onClick={() => void handleDisable(r)}
              id={`UnavailabilityTypes.disable.${r.id}`}
            />
          )}
          <IconButton
            icon="delete"
            label={tr('UnavailabilityTypes.deleteRow')}
            variant="danger"
            onClick={() => void handleDelete(r)}
            id={`UnavailabilityTypes.deleteRow.${r.id}`}
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
          rowKey={(r) => String(r.id)}
          rows={rows}
          columns={columns}
          empty={<EmptyState titleId="UnavailabilityTypes.empty" title={tr('UnavailabilityTypes.empty')} />}
        />
      )}

      <Modal
        open={formOpen}
        titleId={editingId == null ? 'UnavailabilityTypes.form.new' : 'UnavailabilityTypes.form.edit'}
        title={editingId == null
          ? tr('UnavailabilityTypes.form.new')
          : tr('UnavailabilityTypes.form.edit')}
        onClose={() => setFormOpen(false)}
        size="lg"
        footer={
          <>
            <Button id="common.cancel" variant="neutral" onClick={() => setFormOpen(false)} disabled={saving}>
              {tr('common.cancel')}
            </Button>
            <Button id="UnavailabilityTypes.save" variant="primary" onClick={() => void handleSave()} disabled={saving}>
              {tr('UnavailabilityTypes.save')}
            </Button>
          </>
        }
      >
        {formError && (
          <div className="mb-4">
            <ErrorBlock id="UnavailabilityTypes.form.error" message={formError} />
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={tr('UnavailabilityTypes.col.type')} id="UnavailabilityTypes.form.type">
            <Input
              id="UnavailabilityTypes.form.type.input"
              aria-label={tr('UnavailabilityTypes.col.type')}
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={tr('UnavailabilityTypes.col.duration')} id="UnavailabilityTypes.form.duration">
              <Input
                id="UnavailabilityTypes.form.duration.input"
                type="number"
                min="0.01"
                step="0.5"
                aria-label={tr('UnavailabilityTypes.col.duration')}
                value={form.durationValue}
                onChange={(e) => setField('durationValue', e.target.value)}
              />
            </Field>
            <Field label={tr('UnavailabilityTypes.col.durationUnit')} id="UnavailabilityTypes.form.durationUnit">
              <Select
                id="UnavailabilityTypes.form.durationUnit.select"
                aria-label={tr('UnavailabilityTypes.col.durationUnit')}
                value={form.durationUnit}
                onChange={(e) => setField('durationUnit', e.target.value as DurationUnit)}
              >
                {DURATION_UNITS.map((unit) => (
                  <option id={`UnavailabilityTypes.form.durationUnit.option.${unit}`} key={unit} value={unit}>{unitLabel(unit)}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label={tr('UnavailabilityTypes.col.count')} id="UnavailabilityTypes.form.count">
            <Select
              id="UnavailabilityTypes.form.count.select"
              aria-label={tr('UnavailabilityTypes.col.count')}
              value={form.countType}
              onChange={(e) => setField('countType', e.target.value as CountType)}
            >
              {COUNT_TYPES.map((type) => (
                <option id={`UnavailabilityTypes.form.count.option.${type}`} key={type} value={type}>{countTypeLabel(type)}</option>
              ))}
            </Select>
          </Field>
          <Field label={tr('UnavailabilityTypes.col.remuneration')} id="UnavailabilityTypes.form.remuneration">
            <Select
              id="UnavailabilityTypes.form.remuneration.select"
              aria-label={tr('UnavailabilityTypes.col.remuneration')}
              value={form.remuneration}
              onChange={(e) => setField('remuneration', e.target.value as FormState['remuneration'])}
            >
              <option id="UnavailabilityTypes.form.remuneration.option.none" value="">{tr('UnavailabilityTypes.value.notProvided')}</option>
              <option id="UnavailabilityTypes.form.remuneration.option.yes" value="true">{tr('common.yes')}</option>
              <option id="UnavailabilityTypes.form.remuneration.option.no" value="false">{tr('common.no')}</option>
            </Select>
          </Field>
          <Field label={tr('UnavailabilityTypes.col.cp')} id="UnavailabilityTypes.form.cp">
            <Select
              id="UnavailabilityTypes.form.cp.select"
              aria-label={tr('UnavailabilityTypes.col.cp')}
              value={form.paidLeaveAccrual}
              onChange={(e) => setField('paidLeaveAccrual', e.target.value as 'true' | 'false')}
            >
              <option id="UnavailabilityTypes.form.cp.option.yes" value="true">{tr('common.yes')}</option>
              <option id="UnavailabilityTypes.form.cp.option.no" value="false">{tr('common.no')}</option>
            </Select>
          </Field>
          <Field label={tr('UnavailabilityTypes.col.legal')} id="UnavailabilityTypes.form.legal">
            <Select
              id="UnavailabilityTypes.form.legal.select"
              aria-label={tr('UnavailabilityTypes.col.legal')}
              value={form.providedByLaw}
              onChange={(e) => setField('providedByLaw', e.target.value as 'true' | 'false')}
            >
              <option id="UnavailabilityTypes.form.legal.option.yes" value="true">{tr('common.yes')}</option>
              <option id="UnavailabilityTypes.form.legal.option.no" value="false">{tr('common.no')}</option>
            </Select>
          </Field>
          <Field label={tr('UnavailabilityTypes.col.syntec')} id="UnavailabilityTypes.form.collective">
            <Select
              id="UnavailabilityTypes.form.collective.select"
              aria-label={tr('UnavailabilityTypes.col.syntec')}
              value={form.providedByCollectiveAgreement}
              onChange={(e) =>
                setField('providedByCollectiveAgreement', e.target.value as 'true' | 'false')}
            >
              <option id="UnavailabilityTypes.form.collective.option.yes" value="true">{tr('common.yes')}</option>
              <option id="UnavailabilityTypes.form.collective.option.no" value="false">{tr('common.no')}</option>
            </Select>
          </Field>
          <Field label={tr('UnavailabilityTypes.col.document')} id="UnavailabilityTypes.form.document">
            <Select
              id="UnavailabilityTypes.form.document.select"
              aria-label={tr('UnavailabilityTypes.col.document')}
              value={form.documentRequired}
              onChange={(e) => setField('documentRequired', e.target.value as 'true' | 'false')}
            >
              <option id="UnavailabilityTypes.form.document.option.yes" value="true">{tr('common.yes')}</option>
              <option id="UnavailabilityTypes.form.document.option.no" value="false">{tr('common.no')}</option>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label={tr('UnavailabilityTypes.col.conditions')} id="UnavailabilityTypes.form.conditions">
              <Textarea
                id="UnavailabilityTypes.form.conditions.textarea"
                aria-label={tr('UnavailabilityTypes.col.conditions')}
                rows={3}
                value={form.mainCondition}
                onChange={(e) => setField('mainCondition', e.target.value)}
              />
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  )
}
