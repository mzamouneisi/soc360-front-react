import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../api/client'
import { consultantsApi } from '../api/consultants'
import { notificationConfigsApi } from '../api/notificationConfigs'
import { socsApi } from '../api/socs'
import { useAsync } from '../lib/useAsync'
import { useI18n } from '../i18n'
import { useSoc } from '../soc/SocContext'
import { Button, Card, Field, Input, InlineButton, RefreshButton, Select, Textarea } from '../components/ui'
import { Badge, ErrorBlock, LoadingBlock, Modal, PageHeader, Table } from '../components/data'
import { dialog } from '../components/dialog'
import { ROLE_LABELS } from '../lib/format'
import type {
  CollaboratorSummary,
  NotificationConfigDto,
  NotificationConfigRequest,
  NotificationConfigStatus,
  NotificationContext,
  NotificationExecutionDto,
  NotificationRecipientAudience,
  NotificationRecurrence,
  NotificationScheduleType,
  SocDto,
} from '../api/types'

const CONTEXTS: NotificationContext[] = ['CRA', 'INVOICE', 'ORDER', 'DOCUMENT', 'VALIDATION', 'OTHER']
const RECURRENCES: NotificationRecurrence[] = ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']
// Rôle du plus haut au plus bas (ADMIN exclu des destinataires).
const ROLE_RANK: Record<string, number> = {
  ADMIN: 4,
  RESPONSIBLE_SOC: 3,
  MANAGER: 2,
  CONSULTANT: 1,
}

function defaultExecutionAt(): string {
  const date = new Date()
  date.setMinutes(0, 0, 0)
  date.setHours(date.getHours() + 1)
  return date.toISOString().slice(0, 16)
}

function toInputValue(value: string | null): string {
  return value ? value.slice(0, 16) : ''
}

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('fr-FR')
}

function emptyForm(socId: number | null): NotificationConfigRequest {
  return {
    id: null,
    socId,
    name: '',
    subject: '',
    contextType: 'OTHER',
    message: '',
    channelInApp: true,
    channelEmail: true,
    scheduleType: 'ONCE',
    executionAt: defaultExecutionAt(),
    recurrence: 'NONE',
    recurrenceEndDate: null,
    status: 'ACTIVE',
    referenceType: null,
    referenceId: null,
    recipientAudience: null,
    recipientIncludeNonEmployees: false,
    recipientIncludeSelf: false,
    recipientCompanyIds: [],
    recipientIds: [],
  }
}

export function NotificationSettings() {
  const { t } = useI18n()
  const { user } = useAuth()
  const { selectedSocId } = useSoc()
  const isAdmin = user?.role === 'ADMIN'
  const [adminSocs, setAdminSocs] = useState<SocDto[]>([])
  const [adminSocId, setAdminSocId] = useState<number | null>(null)
  const socId = isAdmin ? adminSocId : selectedSocId ?? user?.socId ?? null

  useEffect(() => {
    if (!isAdmin) return
    let cancelled = false
    socsApi
      .findAll()
      .then((list) => {
        if (cancelled) return
        setAdminSocs(list)
        setAdminSocId((current) => {
          if (current != null && list.some((s) => s.id === current)) return current
          return list[0]?.id ?? null
        })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [isAdmin])

  const { data: configs, loading, error, reload } = useAsync(
    () => (socId ? notificationConfigsApi.list(socId) : Promise.resolve([])),
    [socId],
  )
  const { data: collaborators } = useAsync(
    () => (isAdmin
      ? consultantsApi.collaborators()
      : socId ? consultantsApi.collaborators(socId) : Promise.resolve([])),
    [isAdmin, socId],
  )
  const sortedCollaborators = [...(collaborators ?? [])].sort((a, b) => {
    const byRole = (ROLE_RANK[b.role] ?? 0) - (ROLE_RANK[a.role] ?? 0)
    return byRole !== 0 ? byRole : a.fullName.localeCompare(b.fullName)
  })

  const [form, setForm] = useState<NotificationConfigRequest>(emptyForm(socId))
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyConfig, setHistoryConfig] = useState<NotificationConfigDto | null>(null)
  const [history, setHistory] = useState<NotificationExecutionDto[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [recipientMode, setRecipientModeState] = useState<'AUDIENCE' | 'SPECIFIC' | 'COMPANIES'>('AUDIENCE')

  const audienceKeys: Record<NotificationRecipientAudience, string> = {
    ALL: isAdmin
      ? 'NotificationSettings.recipients.audienceCompanies'
      : 'NotificationSettings.recipients.audienceAll',
    RESPONSIBLE_SOC: 'NotificationSettings.recipients.audienceResponsibles',
    MANAGERS: 'NotificationSettings.recipients.audienceManagers',
    CONSULTANTS: 'NotificationSettings.recipients.audienceConsultants',
  }
  // Un manager ne peut cibler « Managers » que s'il a au moins un manager dans son équipe
  // (distinct de lui-même).
  const managerHasManagerCollaborator = (collaborators ?? []).some(
    (collaborator) => collaborator.role === 'MANAGER' && collaborator.id !== user?.id,
  )
  const baseAudienceOptions: NotificationRecipientAudience[] = isAdmin
    ? ['ALL', 'RESPONSIBLE_SOC', 'MANAGERS', 'CONSULTANTS']
    : ['ALL', 'MANAGERS', 'CONSULTANTS']
  const audienceOptions = user?.role === 'MANAGER' && !managerHasManagerCollaborator
    ? baseAudienceOptions.filter((audience) => audience !== 'MANAGERS')
    : baseAudienceOptions

  function openCreate() {
    setForm(emptyForm(socId))
    setRecipientModeState('AUDIENCE')
    setFormError(null)
    setOpen(true)
  }

  function openEdit(config: NotificationConfigDto) {
    setForm({
      id: config.id,
      socId: config.socId,
      name: config.name,
      subject: config.subject,
      contextType: config.contextType,
      message: config.message,
      channelInApp: config.channelInApp,
      channelEmail: config.channelEmail,
      scheduleType: config.scheduleType,
      executionAt: toInputValue(config.executionAt),
      recurrence: config.recurrence,
      recurrenceEndDate: config.recurrenceEndDate,
      status: config.status,
      referenceType: config.referenceType,
      referenceId: config.referenceId,
      recipientAudience: config.recipientAudience ?? null,
      recipientIncludeNonEmployees: config.recipientIncludeNonEmployees ?? false,
      recipientIncludeSelf: config.recipientIncludeSelf ?? false,
      recipientCompanyIds: [...(config.recipientCompanyIds ?? [])],
      recipientIds: [...config.recipientIds],
    })
    setRecipientModeState(config.recipientAudience != null
      ? 'AUDIENCE'
      : (config.recipientCompanyIds ?? []).length > 0 ? 'COMPANIES' : 'SPECIFIC')
    setFormError(null)
    setOpen(true)
  }

  /** Un seul cadre est actif : on nettoie les données des autres cadres. */
  function setRecipientMode(mode: 'AUDIENCE' | 'SPECIFIC' | 'COMPANIES') {
    setRecipientModeState(mode)
    setForm({
      ...form,
      recipientAudience: mode === 'AUDIENCE' ? form.recipientAudience : null,
      recipientIncludeNonEmployees: mode === 'AUDIENCE' ? form.recipientIncludeNonEmployees : false,
      recipientIncludeSelf: mode === 'AUDIENCE' ? form.recipientIncludeSelf : false,
      recipientIds: mode === 'SPECIFIC' ? form.recipientIds : [],
      recipientCompanyIds: mode === 'COMPANIES' ? form.recipientCompanyIds : [],
    })
  }

  function toggleSelectAll() {
    const allSelected = sortedCollaborators.length > 0
      && sortedCollaborators.every((c) => form.recipientIds.includes(c.id))
    setForm({
      ...form,
      recipientIds: allSelected ? [] : sortedCollaborators.map((c) => c.id),
    })
  }

  function toggleAllCompanies() {
    const allSelected = adminSocs.length > 0
      && adminSocs.every((soc) => form.recipientCompanyIds.includes(soc.id))
    setForm({
      ...form,
      recipientCompanyIds: allSelected ? [] : adminSocs.map((soc) => soc.id),
    })
  }

  /** Libellé d'un collaborateur : nom, société (admin), rôle et statut salarié/non salarié. */
  const collaboratorLabel = (collaborator: CollaboratorSummary) => {
    const role = ROLE_LABELS[collaborator.role] ?? collaborator.role
    const status = collaborator.employee
      ? t('NotificationSettings.recipients.salarie')
      : t('NotificationSettings.recipients.nonSalarie')
    const company = isAdmin && collaborator.socName ? `${collaborator.socName}, ` : ''
    return `${collaborator.fullName} (${company}${role}, ${status})`
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (recipientMode === 'AUDIENCE') {
      if (!form.recipientAudience) {
        setFormError(t('NotificationSettings.required'))
        return
      }
    } else if (recipientMode === 'SPECIFIC') {
      if (form.recipientIds.length === 0) {
        setFormError(t('NotificationSettings.required'))
        return
      }
    } else if (form.recipientCompanyIds.length === 0) {
      setFormError(t('NotificationSettings.required'))
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      await notificationConfigsApi.save({
        ...form,
        socId,
        recipientAudience: recipientMode === 'AUDIENCE' ? form.recipientAudience : null,
        recipientIncludeNonEmployees: recipientMode === 'AUDIENCE' && form.recipientIncludeNonEmployees,
        recipientIncludeSelf: recipientMode === 'AUDIENCE' && form.recipientIncludeSelf,
        recipientIds: recipientMode === 'SPECIFIC' ? form.recipientIds : [],
        recipientCompanyIds: recipientMode === 'COMPANIES' ? form.recipientCompanyIds : [],
      })
      setOpen(false)
      reload()
      dialog.success(t('NotificationSettings.saved'))
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t('NotificationSettings.required'))
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus(config: NotificationConfigDto) {
    setActionError(null)
    const next: NotificationConfigStatus = config.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
    try {
      await notificationConfigsApi.setStatus(config.id, next)
      reload()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t('NotificationSettings.sendFailed'))
    }
  }

  async function runNow(config: NotificationConfigDto) {
    setActionError(null)
    try {
      const execution = await notificationConfigsApi.run(config.id)
      reload()
      if (execution.status === 'FAILED') {
        setActionError(t('NotificationSettings.sendFailed'))
      } else {
        dialog.success(t('NotificationSettings.saved'))
      }
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t('NotificationSettings.sendFailed'))
    }
  }

  async function remove(config: NotificationConfigDto) {
    if (!(await dialog.confirm(t('NotificationSettings.deleteConfirm')))) {
      return
    }
    setActionError(null)
    try {
      await notificationConfigsApi.remove(config.id)
      reload()
      dialog.success(t('NotificationSettings.deleted'))
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t('NotificationSettings.sendFailed'))
    }
  }

  async function openHistory(config: NotificationConfigDto) {
    setHistoryConfig(config)
    setHistoryOpen(true)
    setHistoryLoading(true)
    try {
      setHistory(await notificationConfigsApi.executionsByConfig(config.id))
    } catch {
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }

  const recipientLabel = (config: NotificationConfigDto) => {
    if (config.recipientAudience) {
      const parts = [t(audienceKeys[config.recipientAudience])]
      if (config.recipientIncludeNonEmployees) parts.push(t('NotificationSettings.recipients.includeNonEmployees'))
      if (config.recipientIncludeSelf) parts.push(t('NotificationSettings.recipients.includeSelf'))
      return parts.join(', ')
    }
    if ((config.recipientCompanyNames ?? []).length) {
      return config.recipientCompanyNames.join(', ')
    }
    return config.recipientNames.length ? config.recipientNames.join(', ') : '—'
  }

  const statusBadge = (config: NotificationConfigDto) => (
    <Badge id={`NotificationSettings.row.${config.id}.status`} kind={config.status === 'ACTIVE' ? 'success' : 'muted'}>
      {config.status === 'ACTIVE' ? t('NotificationSettings.active') : t('NotificationSettings.disabled')}
    </Badge>
  )

  return (
    <div>
      <PageHeader
        title={t('NotificationSettings.title')}
        titleId="NotificationSettings.title"
        subtitle={t('NotificationSettings.subtitle')}
        actions={<RefreshButton onClick={reload} />}
      />

      {isAdmin && (
        <div className="mb-4 w-fit">
          <Field label={t('common.company')} id="NotificationSettings.soc">
            <Select
              id="NotificationSettings.soc.input"
              className="w-64"
              value={socId ?? ''}
              onChange={(event) => setAdminSocId(event.target.value ? Number(event.target.value) : null)}
            >
              {adminSocs.map((soc) => (
                <option key={soc.id} value={soc.id} id={`NotificationSettings.soc.option.${soc.id}`}>
                  {soc.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}

      <div className="mb-4">
        <Button id="NotificationSettings.new" variant="green" onClick={openCreate}>
          {t('NotificationSettings.new')}
        </Button>
      </div>

      {error && <ErrorBlock id="NotificationSettings.error" message={error} />}
      {actionError && <ErrorBlock id="NotificationSettings.actionError" message={actionError} />}

      {loading ? (
        <LoadingBlock />
      ) : (
        <Table
          columns={[
            { key: 'NotificationSettings.name', label: t('NotificationSettings.name'), render: (row) => row.name },
            {
              key: 'NotificationSettings.context',
              label: t('NotificationSettings.context'),
              render: (row) => <span id={`NotificationSettings.row.${row.id}.context`}>{row.contextType}</span>,
            },
            { key: 'NotificationSettings.status', label: t('NotificationSettings.status'), render: statusBadge },
            {
              key: 'NotificationSettings.schedule',
              label: t('NotificationSettings.schedule'),
              render: (row) => (
                <span id={`NotificationSettings.row.${row.id}.schedule`}>
                  {row.scheduleType === 'RECURRING' ? `${row.recurrence} — ` : ''}
                  {formatDateTime(row.nextRunAt)}
                </span>
              ),
            },
            {
              key: 'NotificationSettings.recipients',
              label: t('NotificationSettings.recipients'),
              render: (row) => <span id={`NotificationSettings.row.${row.id}.recipients`}>{recipientLabel(row)}</span>,
            },
            {
              key: 'NotificationSettings.actions',
              label: '',
              render: (row) => (
                <div id={`NotificationSettings.row.${row.id}.actions`} className="flex flex-wrap gap-2">
                  <InlineButton
                    id={`NotificationSettings.row.${row.id}.edit`}
                    variant="primary"
                    onClick={(e) => {
                      e.stopPropagation()
                      openEdit(row)
                    }}
                  >
                    {t('common.edit')}
                  </InlineButton>
                  <InlineButton
                    id={`NotificationSettings.row.${row.id}.run`}
                    variant="ok"
                    onClick={(e) => {
                      e.stopPropagation()
                      runNow(row)
                    }}
                  >
                    {t('NotificationSettings.runNow')}
                  </InlineButton>
                  <InlineButton
                    id={`NotificationSettings.row.${row.id}.history`}
                    variant="history"
                    onClick={(e) => {
                      e.stopPropagation()
                      openHistory(row)
                    }}
                  >
                    {t('NotificationSettings.history')}
                  </InlineButton>
                  <InlineButton
                    id={`NotificationSettings.row.${row.id}.toggle`}
                    variant="disable"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleStatus(row)
                    }}
                  >
                    {row.status === 'ACTIVE' ? t('NotificationSettings.disable') : t('NotificationSettings.enable')}
                  </InlineButton>
                  <InlineButton
                    id={`NotificationSettings.row.${row.id}.delete`}
                    variant="danger"
                    onClick={(e) => {
                      e.stopPropagation()
                      remove(row)
                    }}
                  >
                    {t('common.delete')}
                  </InlineButton>
                </div>
              ),
            },
          ]}
          rows={configs ?? []}
          rowKey={(row) => row.id}
          onRowClick={openEdit}
          empty={<p id="NotificationSettings.empty" className="text-gray-500">{t('NotificationSettings.empty')}</p>}
        />
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={form.id ? t('NotificationSettings.edit') : t('NotificationSettings.new')}
        titleId="NotificationSettings.form.title"
        size="xl"
        scrollBody
        footer={
          <>
            <Button id="NotificationSettings.form.cancel" variant="neutral" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button id="NotificationSettings.form.save" type="submit" form="NotificationSettings.form" disabled={saving}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="NotificationSettings.form" onSubmit={handleSubmit} className="space-y-4">
          {formError && <p id="NotificationSettings.form.error" className="text-sm text-red-600">{formError}</p>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t('NotificationSettings.name')} id="NotificationSettings.name">
              <Input
                id="NotificationSettings.name.input"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </Field>
            <Field label={t('NotificationSettings.subject')} id="NotificationSettings.subject">
              <Input
                id="NotificationSettings.subject.input"
                value={form.subject}
                onChange={(event) => setForm({ ...form, subject: event.target.value })}
              />
            </Field>
            <Field label={t('NotificationSettings.context')} id="NotificationSettings.context">
              <Select
                id="NotificationSettings.context.input"
                value={form.contextType}
                onChange={(event) => setForm({ ...form, contextType: event.target.value as NotificationContext })}
              >
                {CONTEXTS.map((context) => (
                  <option key={context} value={context}>{context}</option>
                ))}
              </Select>
            </Field>
            <Field label={t('NotificationSettings.status')} id="NotificationSettings.status">
              <Select
                id="NotificationSettings.status.input"
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value as NotificationConfigStatus })}
              >
                <option value="ACTIVE">{t('NotificationSettings.active')}</option>
                <option value="DISABLED">{t('NotificationSettings.disabled')}</option>
              </Select>
            </Field>
          </div>

          <Field label={t('NotificationSettings.message')} id="NotificationSettings.message">
            <Textarea
              id="NotificationSettings.message.input"
              rows={4}
              value={form.message}
              onChange={(event) => setForm({ ...form, message: event.target.value })}
            />
          </Field>
          <p id="NotificationSettings.variables" className="text-xs text-gray-500">
            {t('NotificationSettings.variables')}
          </p>

          <Field label={t('NotificationSettings.recipients')} id="NotificationSettings.recipients.field">
            <div className="space-y-3 text-sm text-gray-700">
              <div className={`grid grid-cols-1 gap-3 ${isAdmin ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
                <div id="NotificationSettings.recipients.frame.audience" className="rounded-lg border border-gray-200 p-3">
                  <label id="NotificationSettings.recipients.modeAudience" className="flex items-center gap-2 font-medium">
                    <input
                      id="NotificationSettings.recipients.modeAudience.input"
                      type="radio"
                      name="NotificationSettings.recipients.mode"
                      checked={recipientMode === 'AUDIENCE'}
                      onChange={() => setRecipientMode('AUDIENCE')}
                    />
                    {t('NotificationSettings.recipients.modeAudience')}
                  </label>
                  <div className="mt-2 space-y-2">
                    {audienceOptions.map((audience) => (
                      <label
                        key={audience}
                        id={audienceKeys[audience]}
                        className={`ml-4 flex items-center gap-2 ${recipientMode === 'AUDIENCE' ? '' : 'text-gray-400'}`}
                      >
                        <input
                          id={`${audienceKeys[audience]}.input`}
                          type="radio"
                          name="NotificationSettings.recipients.audience"
                          value={audience}
                          checked={form.recipientAudience === audience}
                          disabled={recipientMode !== 'AUDIENCE'}
                          onChange={() => setForm({ ...form, recipientAudience: audience })}
                        />
                        {t(audienceKeys[audience])}
                      </label>
                    ))}
                    <label
                      id="NotificationSettings.recipients.includeNonEmployees"
                      className={`ml-4 flex items-center gap-2 ${recipientMode === 'AUDIENCE' ? '' : 'text-gray-400'}`}
                    >
                      <input
                        id="NotificationSettings.recipients.includeNonEmployees.input"
                        type="checkbox"
                        checked={form.recipientIncludeNonEmployees}
                        disabled={recipientMode !== 'AUDIENCE'}
                        onChange={(event) => setForm({ ...form, recipientIncludeNonEmployees: event.target.checked })}
                      />
                      {t('NotificationSettings.recipients.includeNonEmployees')}
                    </label>
                    <label
                      id="NotificationSettings.recipients.includeSelf"
                      className={`ml-4 flex items-center gap-2 ${recipientMode === 'AUDIENCE' ? '' : 'text-gray-400'}`}
                    >
                      <input
                        id="NotificationSettings.recipients.includeSelf.input"
                        type="checkbox"
                        checked={form.recipientIncludeSelf}
                        disabled={recipientMode !== 'AUDIENCE'}
                        onChange={(event) => setForm({ ...form, recipientIncludeSelf: event.target.checked })}
                      />
                      {t('NotificationSettings.recipients.includeSelf')}
                    </label>
                  </div>
                </div>

                <div id="NotificationSettings.recipients.frame.specific" className="rounded-lg border border-gray-200 p-3">
                  <label id="NotificationSettings.recipients.modeSpecific" className="flex items-center gap-2 font-medium">
                    <input
                      id="NotificationSettings.recipients.modeSpecific.input"
                      type="radio"
                      name="NotificationSettings.recipients.mode"
                      checked={recipientMode === 'SPECIFIC'}
                      onChange={() => setRecipientMode('SPECIFIC')}
                    />
                    {t('NotificationSettings.recipients.modeSpecific')}
                  </label>
                  <div className="mt-2 flex items-start gap-2">
                    <div
                      id="NotificationSettings.recipients.input"
                      className="max-h-72 w-full overflow-y-auto rounded-lg border border-gray-200 p-2"
                    >
                      {sortedCollaborators.map((collaborator) => (
                        <label
                          key={collaborator.id}
                          id={`NotificationSettings.recipients.option.${collaborator.id}`}
                          className={`flex items-center gap-2 py-1 ${recipientMode === 'SPECIFIC' ? '' : 'text-gray-400'}`}
                        >
                          <input
                            id={`NotificationSettings.recipients.option.${collaborator.id}.input`}
                            type="checkbox"
                            disabled={recipientMode !== 'SPECIFIC'}
                            checked={form.recipientIds.includes(collaborator.id)}
                            onChange={(event) =>
                              setForm({
                                ...form,
                                recipientIds: event.target.checked
                                  ? [...form.recipientIds, collaborator.id]
                                  : form.recipientIds.filter((id) => id !== collaborator.id),
                              })
                            }
                          />
                          {collaboratorLabel(collaborator)}
                        </label>
                      ))}
                    </div>
                    <Button
                      type="button"
                      id="NotificationSettings.recipients.toggleAll"
                      variant="neutral"
                      disabled={recipientMode !== 'SPECIFIC' || sortedCollaborators.length === 0}
                      onClick={toggleSelectAll}
                      className="whitespace-nowrap"
                    >
                      {sortedCollaborators.length > 0
                        && sortedCollaborators.every((c) => form.recipientIds.includes(c.id))
                        ? t('NotificationSettings.recipients.deselectAll')
                        : t('NotificationSettings.recipients.selectAll')}
                    </Button>
                  </div>
                </div>

                {isAdmin && (
                  <div id="NotificationSettings.recipients.frame.companies" className="rounded-lg border border-gray-200 p-3">
                    <label id="NotificationSettings.recipients.modeCompanies" className="flex items-center gap-2 font-medium">
                      <input
                        id="NotificationSettings.recipients.modeCompanies.input"
                        type="radio"
                        name="NotificationSettings.recipients.mode"
                        checked={recipientMode === 'COMPANIES'}
                        onChange={() => setRecipientMode('COMPANIES')}
                      />
                      {t('NotificationSettings.recipients.modeCompanies')}
                    </label>
                    <p id="NotificationSettings.recipients.companyList" className="mt-2 font-medium">
                      {t('NotificationSettings.recipients.companyList')}
                    </p>
                    <div className="mt-1 flex items-start gap-2">
                      <div
                        id="NotificationSettings.recipients.companies"
                        className="max-h-72 w-full overflow-y-auto rounded-lg border border-gray-200 p-2"
                      >
                        {adminSocs.map((soc) => (
                          <label
                            key={soc.id}
                            id={`NotificationSettings.recipients.company.${soc.id}`}
                            className={`flex items-center gap-2 py-1 ${recipientMode === 'COMPANIES' ? '' : 'text-gray-400'}`}
                          >
                            <input
                              id={`NotificationSettings.recipients.company.${soc.id}.input`}
                              type="checkbox"
                              disabled={recipientMode !== 'COMPANIES'}
                              checked={form.recipientCompanyIds.includes(soc.id)}
                              onChange={(event) =>
                                setForm({
                                  ...form,
                                  recipientCompanyIds: event.target.checked
                                    ? [...form.recipientCompanyIds, soc.id]
                                    : form.recipientCompanyIds.filter((id) => id !== soc.id),
                                })
                              }
                            />
                            {soc.name}
                          </label>
                        ))}
                      </div>
                      <Button
                        type="button"
                        id="NotificationSettings.recipients.toggleAllCompanies"
                        variant="neutral"
                        disabled={recipientMode !== 'COMPANIES' || adminSocs.length === 0}
                        onClick={toggleAllCompanies}
                        className="whitespace-nowrap"
                      >
                        {adminSocs.length > 0
                          && adminSocs.every((soc) => form.recipientCompanyIds.includes(soc.id))
                          ? t('NotificationSettings.recipients.deselectAll')
                          : t('NotificationSettings.recipients.selectAll')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <Field label={t('NotificationSettings.channels')} id="NotificationSettings.channels">
                <div className="space-y-2">
                  <label id="NotificationSettings.inApp" className="flex items-center gap-2">
                    <input
                      id="NotificationSettings.inApp.input"
                      type="checkbox"
                      checked={form.channelInApp}
                      onChange={(event) => setForm({ ...form, channelInApp: event.target.checked })}
                    />
                    {t('NotificationSettings.inApp')}
                  </label>
                  <label id="NotificationSettings.email" className="flex items-center gap-2">
                    <input
                      id="NotificationSettings.email.input"
                      type="checkbox"
                      checked={form.channelEmail}
                      onChange={(event) => setForm({ ...form, channelEmail: event.target.checked })}
                    />
                    {t('NotificationSettings.email')}
                  </label>
                </div>
              </Field>
            </div>
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={t('NotificationSettings.scheduleType')} id="NotificationSettings.scheduleType">
              <Select
                id="NotificationSettings.scheduleType.input"
                value={form.scheduleType}
                onChange={(event) =>
                  setForm({
                    ...form,
                    scheduleType: event.target.value as NotificationScheduleType,
                    recurrence: event.target.value === 'RECURRING' && form.recurrence === 'NONE'
                      ? 'MONTHLY'
                      : form.recurrence,
                  })
                }
              >
                <option value="ONCE">{t('NotificationSettings.once')}</option>
                <option value="RECURRING">{t('NotificationSettings.recurring')}</option>
              </Select>
            </Field>
            <Field label={t('NotificationSettings.executionAt')} id="NotificationSettings.executionAt">
              <Input
                id="NotificationSettings.executionAt.input"
                type="datetime-local"
                value={form.executionAt ?? ''}
                onChange={(event) => setForm({ ...form, executionAt: event.target.value || null })}
              />
            </Field>
            <Field label={t('NotificationSettings.recurrence')} id="NotificationSettings.recurrence">
              <Select
                id="NotificationSettings.recurrence.input"
                value={form.recurrence}
                disabled={form.scheduleType !== 'RECURRING'}
                onChange={(event) => setForm({ ...form, recurrence: event.target.value as NotificationRecurrence })}
              >
                {RECURRENCES.map((recurrence) => (
                  <option key={recurrence} value={recurrence}>
                    {recurrence === 'NONE' ? t('NotificationSettings.none') : t(`NotificationSettings.${recurrence.toLowerCase()}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('NotificationSettings.recurrenceEndDate')} id="NotificationSettings.recurrenceEndDate">
              <Input
                id="NotificationSettings.recurrenceEndDate.input"
                type="date"
                value={form.recurrenceEndDate ?? ''}
                disabled={form.scheduleType !== 'RECURRING'}
                onChange={(event) => setForm({ ...form, recurrenceEndDate: event.target.value || null })}
              />
            </Field>
          </div>
        </form>
      </Modal>

      <Modal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title={`${t('NotificationSettings.history')} — ${historyConfig?.name ?? ''}`}
        titleId="NotificationSettings.history.title"
        size="xl"
        footer={
          <Button id="NotificationSettings.history.close" variant="neutral" onClick={() => setHistoryOpen(false)}>
            {t('common.close')}
          </Button>
        }
      >
        {historyLoading ? (
          <LoadingBlock />
        ) : history.length === 0 ? (
          <p id="NotificationSettings.history.empty" className="text-gray-500">{t('NotificationSettings.noHistory')}</p>
        ) : (
          <div className="space-y-3">
            {history.map((execution) => (
              <Card id={`NotificationSettings.history.${execution.id}`} key={execution.id} className="p-3">
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
                  <Badge
                    id={`NotificationSettings.history.${execution.id}.status`}
                    kind={execution.status === 'SUCCESS' ? 'success' : execution.status === 'PARTIAL' ? 'warning' : 'error'}
                  >
                    {t(`NotificationSettings.${execution.status.toLowerCase()}`)}
                  </Badge>
                  <span id={`NotificationSettings.history.${execution.id}.date`}>{formatDateTime(execution.startedAt)}</span>
                  <span id={`NotificationSettings.history.${execution.id}.trigger`}>{execution.triggerType}</span>
                  <span id={`NotificationSettings.history.${execution.id}.counts`}>
                    {execution.successCount}/{execution.totalRecipients} {t('NotificationSettings.success')}
                    {execution.failureCount > 0 ? ` — ${execution.failureCount} ${t('NotificationSettings.failed')}` : ''}
                  </span>
                </div>
                <ul id={`NotificationSettings.history.${execution.id}.deliveries`} className="mt-2 space-y-1 text-xs text-gray-600">
                  {execution.deliveries.map((delivery) => (
                    <li id={`NotificationSettings.history.${execution.id}.delivery.${delivery.id}`} key={delivery.id}>
                      {delivery.recipientName} — {delivery.channel} — {delivery.status}
                      {delivery.errorMessage ? ` (${delivery.errorMessage})` : ''}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
