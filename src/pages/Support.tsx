import { tr } from '../i18n/translate'
import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { supportApi } from '../api/support'
import { ApiError } from '../api/client'
import { useAsync } from '../lib/useAsync'
import { Button, Field, IconButton, InlineButton, Input, RefreshButton, Select, Spinner, Textarea } from '../components/ui'
import {
  Badge,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  Modal,
  PageHeader,
  Pagination,
  Table,
} from '../components/data'
import { dialog } from '../components/dialog'
import {
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  formatDateTime,
  statusBadge,
} from '../lib/format'
import type {
  SupportExchangeDto,
  SupportTicketDto,
  TicketPriority,
  TicketStatus,
} from '../api/types'

export function Support() {
  const { user } = useAuth()
  const canManage = user?.role === 'ADMIN'
  const [page, setPage] = useState(0)
  const [mine, setMine] = useState(false)
  const size = user?.pageSize ?? 5

  const { data, loading, error, reload } = useAsync(
    () => supportApi.findAll({ page, size, mine }),
    [page, mine, size],
  )

  const [createOpen, setCreateOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TicketPriority>('MEDIUM')
  const [category, setCategory] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [detail, setDetail] = useState<SupportTicketDto | null>(null)
  const [exchanges, setExchanges] = useState<SupportExchangeDto[]>([])
  const [exchangeBody, setExchangeBody] = useState('')
  const [exchangeSubmitting, setExchangeSubmitting] = useState(false)

  async function openDetail(ticket: SupportTicketDto) {
    setDetail(ticket)
    setExchangeBody('')
    try {
      setExchanges(await supportApi.exchanges(ticket.id))
    } catch {
      setExchanges([])
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || !description.trim()) {
      setFormError('Le titre et la description sont obligatoires')
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      await supportApi.create({
        title: title.trim(),
        description: description.trim(),
        priority,
        category: category.trim() || undefined,
      })
      setCreateOpen(false)
      setTitle('')
      setDescription('')
      setPriority('MEDIUM')
      setCategory('')
      reload()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Erreur inattendue')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAddExchange() {
    if (!detail || !exchangeBody.trim()) return
    setExchangeSubmitting(true)
    try {
      await supportApi.addExchange(detail.id, exchangeBody.trim())
      setExchangeBody('')
      setExchanges(await supportApi.exchanges(detail.id))
      setDetail(await supportApi.getById(detail.id))
      reload()
    } catch (err) {
      void dialog.error(err instanceof ApiError ? err.message : 'Erreur inattendue')
    } finally {
      setExchangeSubmitting(false)
    }
  }

  async function handleStatusChange(status: TicketStatus) {
    if (!detail) return
    try {
      const updated = await supportApi.updateStatus(detail.id, status)
      setDetail(updated)
      reload()
    } catch (err) {
      void dialog.error(err instanceof ApiError ? err.message : 'Erreur inattendue')
    }
  }

  return (
    <div>
      <PageHeader
        title={tr('Support.support')}
        count={data?.total ?? 0}
        subtitle={tr('Support.tickets.d.assistance.et.demandes')}
        actions={
          <>
            <RefreshButton onClick={reload} />
            <Button
              className="w-auto"
              onClick={() => {
                setCreateOpen(true)
                setFormError(null)
              }}
            >
              + Nouveau ticket
            </Button>
          </>
        }
      />

      <label className="mb-4 flex w-fit items-center gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={mine}
          onChange={(e) => {
            setMine(e.target.checked)
            setPage(0)
          }}
          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
        />
        {tr('Support.mes.tickets.uniquement')}
      </label>

      {error && <ErrorBlock message={error} />}
      {loading && <LoadingBlock />}

      {!loading && data && data.items.length > 0 && (
        <>
          <Table
            rowKey={(t) => t.id}
            onRowClick={openDetail}
            rows={data.items}
            startIndex={data.page * size}
            columns={[
              {
                key: 'title',
                label: 'Ticket',
                render: (t) => (
                  <div>
                    <p className="font-medium text-gray-900">{t.title}</p>
                    <p className="text-xs text-gray-500">
                      {t.category ?? 'Général'} · {formatDateTime(t.createdAt)}
                    </p>
                  </div>
                ),
              },
              {
                key: 'status',
                label: 'Statut',
                render: (t) => (
                  <Badge kind={statusBadge(t.status)}>
                    {TICKET_STATUS_LABELS[t.status] ?? t.status}
                  </Badge>
                ),
              },
              {
                key: 'priority',
                label: 'Priorité',
                render: (t) => (
                  <Badge kind={t.priority === 'URGENT' || t.priority === 'HIGH' ? 'error' : 'muted'}>
                    {TICKET_PRIORITY_LABELS[t.priority] ?? t.priority}
                  </Badge>
                ),
              },
              {
                key: 'creator',
                label: 'Créé par',
                render: (t) =>
                  t.creator ? `${t.creator.firstName} ${t.creator.lastName}` : '—',
              },
              {
                key: 'assigned',
                label: 'Assigné à',
                render: (t) =>
                  t.assignedTo ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}` : '—',
              },
            ]}
          />
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />
        </>
      )}

      {!loading && data && data.items.length === 0 && (
        <EmptyState
          title={tr('Support.aucun.ticket')}
          description={tr('Support.creez.un.ticket.pour.contacter.le.support')}
          action={
            <Button
              className="w-auto"
              onClick={() => {
                setCreateOpen(true)
                setFormError(null)
              }}
            >
              + Nouveau ticket
            </Button>
          }
        />
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={tr('Support.nouveau.ticket')}
        footer={
          <>
            <IconButton icon="cancel" label="Annuler" onClick={() => setCreateOpen(false)} />
            <Button className="w-auto" onClick={handleCreate as never} disabled={submitting}>
              {submitting ? <Spinner className="border-white border-t-transparent" /> : null}
              Créer le ticket
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {formError}
            </div>
          )}
          <Field label={tr('Support.titre')}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label={tr('Support.description')}>
            <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={tr('Support.priorite')}>
              <Select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
              >
                <option value="LOW">{tr('Support.basse')}</option>
                <option value="MEDIUM">{tr('Support.moyenne')}</option>
                <option value="HIGH">{tr('Support.haute')}</option>
                <option value="URGENT">{tr('Support.urgente')}</option>
              </Select>
            </Field>
            <Field label={tr('Support.categorie')}>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder={tr('Support.facturation.bug.question')}
              />
            </Field>
          </div>
        </form>
      </Modal>

      <Modal
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.title ?? 'Ticket'}
        size="lg"
      >
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge kind={statusBadge(detail.status)}>
                {TICKET_STATUS_LABELS[detail.status] ?? detail.status}
              </Badge>
              <Badge kind={detail.priority === 'URGENT' || detail.priority === 'HIGH' ? 'error' : 'muted'}>
                {TICKET_PRIORITY_LABELS[detail.priority] ?? detail.priority}
              </Badge>
              <span className="text-xs text-gray-500">
                {detail.creator ? `Créé par ${detail.creator.firstName} ${detail.creator.lastName}` : 'Créé par le support'} ·{' '}
                {formatDateTime(detail.createdAt)}
              </span>
            </div>

            <p className="whitespace-pre-wrap text-sm text-gray-700">{detail.description}</p>

            {canManage && detail.status !== 'CLOSED' && (
              <div className="flex flex-wrap gap-2">
                {detail.status === 'OPEN' && (
                  <InlineButton onClick={() => handleStatusChange('IN_PROGRESS')}>
                    {tr('Support.passer.en.cours')}
                  </InlineButton>
                )}
                {(detail.status === 'OPEN' || detail.status === 'IN_PROGRESS') && (
                  <InlineButton onClick={() => handleStatusChange('RESOLVED')}>{tr('Support.resoudre')}</InlineButton>
                )}
                <InlineButton onClick={() => handleStatusChange('CLOSED')}>{tr('Support.clore')}</InlineButton>
              </div>
            )}
            {canManage && detail.status === 'CLOSED' && (
              <InlineButton onClick={() => handleStatusChange('OPEN')}>{tr('Support.rouvrir')}</InlineButton>
            )}

            <div className="space-y-3 border-t border-gray-200 pt-4">
              <p className="text-sm font-semibold text-gray-900">{tr('Support.echanges')}</p>
              {exchanges.length === 0 && (
                <p className="text-sm text-gray-400">{tr('Support.aucun.echange.pour.le.moment')}</p>
              )}
              {exchanges.map((exc) => (
                <div key={exc.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">
                    {exc.author ? `${exc.author.firstName} ${exc.author.lastName}` : 'Support'} ·{' '}
                    {formatDateTime(exc.createdAt)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{exc.body}</p>
                </div>
              ))}

              <div className="space-y-2">
                <Textarea
                  rows={3}
                  placeholder={tr('Support.votre.message')}
                  value={exchangeBody}
                  onChange={(e) => setExchangeBody(e.target.value)}
                />
                <IconButton
                  icon="send"
                  label={tr('Support.envoyer')}
                  variant="primary"
                  className="w-auto"
                  onClick={handleAddExchange}
                  disabled={exchangeSubmitting || !exchangeBody.trim()}
                />
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
