import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../api/client'
import { consultantsApi } from '../api/consultants'
import { notificationConfigsApi } from '../api/notificationConfigs'
import { useAsync } from '../lib/useAsync'
import { useI18n } from '../i18n'
import { useSoc } from '../soc/SocContext'
import { Button, Card, Field, Input, InlineButton, RefreshButton, Select, Textarea } from '../components/ui'
import { Badge, ErrorBlock, LoadingBlock, Modal, PageHeader, Table } from '../components/data'
import { dialog } from '../components/dialog'
import type {
  NotificationConfigDto,
  NotificationConfigRequest,
  NotificationConfigStatus,
  NotificationContext,
  NotificationExecutionDto,
  NotificationRecurrence,
  NotificationScheduleType,
} from '../api/types'

const CONTEXTS: NotificationContext[] = ['CRA', 'INVOICE', 'ORDER', 'DOCUMENT', 'VALIDATION', 'OTHER']
const RECURRENCES: NotificationRecurrence[] = ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']

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
    recipientIds: [],
  }
}

export function NotificationSettings() {
  const { t } = useI18n()
  const { user } = useAuth()
  const { selectedSocId } = useSoc()
  const socId = selectedSocId ?? user?.socId ?? null

  const { data: configs, loading, error, reload } = useAsync(
    () => (socId ? notificationConfigsApi.list(socId) : Promise.resolve([])),
    [socId],
  )
  const { data: collaborators } = useAsync(
    () => (socId ? consultantsApi.collaborators(socId) : Promise.resolve([])),
    [socId],
  )

  const [form, setForm] = useState<NotificationConfigRequest>(emptyForm(socId))
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyConfig, setHistoryConfig] = useState<NotificationConfigDto | null>(null)
  const [history, setHistory] = useState<NotificationExecutionDto[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  function openCreate() {
    setForm(emptyForm(socId))
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
      recipientIds: [...config.recipientIds],
    })
    setFormError(null)
    setOpen(true)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      await notificationConfigsApi.save({ ...form, socId })
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

  const recipientLabel = (config: NotificationConfigDto) =>
    config.recipientNames.length ? config.recipientNames.join(', ') : '—'

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
                  <InlineButton id={`NotificationSettings.row.${row.id}.edit`} variant="primary" onClick={() => openEdit(row)}>
                    {t('common.edit')}
                  </InlineButton>
                  <InlineButton id={`NotificationSettings.row.${row.id}.run`} variant="ok" onClick={() => runNow(row)}>
                    {t('NotificationSettings.runNow')}
                  </InlineButton>
                  <InlineButton id={`NotificationSettings.row.${row.id}.history`} variant="history" onClick={() => openHistory(row)}>
                    {t('NotificationSettings.history')}
                  </InlineButton>
                  <InlineButton id={`NotificationSettings.row.${row.id}.toggle`} variant="disable" onClick={() => toggleStatus(row)}>
                    {row.status === 'ACTIVE' ? t('NotificationSettings.disable') : t('NotificationSettings.enable')}
                  </InlineButton>
                  <InlineButton id={`NotificationSettings.row.${row.id}.delete`} variant="danger" onClick={() => remove(row)}>
                    {t('common.delete')}
                  </InlineButton>
                </div>
              ),
            },
          ]}
          rows={configs ?? []}
          rowKey={(row) => row.id}
          empty={<p id="NotificationSettings.empty" className="text-gray-500">{t('NotificationSettings.empty')}</p>}
        />
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={form.id ? t('NotificationSettings.edit') : t('NotificationSettings.new')}
        titleId="NotificationSettings.form.title"
        size="xl"
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t('NotificationSettings.recipients')} id="NotificationSettings.recipients">
              <Select
                id="NotificationSettings.recipients.input"
                multiple
                size={6}
                value={form.recipientIds.map(String)}
                onChange={(event) =>
                  setForm({
                    ...form,
                    recipientIds: Array.from(event.target.selectedOptions).map((option) => Number(option.value)),
                  })
                }
              >
                {(collaborators ?? []).map((collaborator) => (
                  <option key={collaborator.id} value={collaborator.id}>{collaborator.fullName}</option>
                ))}
              </Select>
            </Field>
            <div className="space-y-3">
              <Field label={t('NotificationSettings.channels')} id="NotificationSettings.channels">
                <div className="space-y-2 text-sm text-gray-700">
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
          </div>

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
