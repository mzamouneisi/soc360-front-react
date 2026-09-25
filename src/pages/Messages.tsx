import { tr } from '../i18n/translate'
import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { messagesApi } from '../api/messages'
import { usersApi } from '../api/users'
import { ApiError } from '../api/client'
import { useAsync } from '../lib/useAsync'
import { Field, IconButton, Input, RefreshButton, Select, Textarea } from '../components/ui'
import { EmptyState, ErrorBlock, LoadingBlock, Modal, PageHeader, Pagination, Table } from '../components/data'
import { dialog } from '../components/dialog'
import { formatDateTime } from '../lib/format'
import type { MessageDto } from '../api/types'

type Tab = 'inbox' | 'sent'

export function Messages() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const [tab, setTab] = useState<Tab>('inbox')
  const [page, setPage] = useState(0)
  const size = user?.pageSize ?? 5

  const { data, loading, error, reload, setData } = useAsync(
    () => (tab === 'inbox' ? messagesApi.inbox(page, size) : messagesApi.sent(page, size)),
    [tab, page, size],
  )

  const { data: users } = useAsync(
    () => (isAdmin ? usersApi.findAll({ size: 100 }) : Promise.resolve(null)),
    [isAdmin],
  )

  const [composeOpen, setComposeOpen] = useState(false)
  const [recipientId, setRecipientId] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [viewing, setViewing] = useState<MessageDto | null>(null)

  async function openMessage(message: MessageDto) {
    setViewing(message)
    if (tab === 'inbox' && !message.read) {
      try {
        await messagesApi.markRead(message.id)
        setData((prev) =>
          prev
            ? {
                ...prev,
                items: prev.items.map((m) => (m.id === message.id ? { ...m, read: true } : m)),
              }
            : prev,
        )
      } catch {
        // ignore
      }
    }
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault()
    if (!recipientId || !subject.trim() || !body.trim()) {
      setFormError('Destinataire, objet et message sont obligatoires')
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      await messagesApi.send(Number(recipientId), subject.trim(), body.trim())
      setComposeOpen(false)
      setRecipientId('')
      setSubject('')
      setBody('')
      if (tab === 'sent') reload()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!viewing) return
    try {
      await messagesApi.delete(viewing.id)
      setViewing(null)
      reload()
    } catch (err) {
      void dialog.error(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'inbox', label: 'Réception' },
    { key: 'sent', label: 'Envoyés' },
  ]

  return (
    <div>
      <PageHeader
        title={tr('Messages.messages')}
        count={data?.total ?? 0}
        subtitle={tr('Messages.messagerie.interne')}
        actions={
          <>
            <RefreshButton onClick={reload} />
            {isAdmin ? (
              <IconButton
                icon="add"
                label={tr('Messages.nouveau.message')}
                variant="primary"
                onClick={() => {
                  setComposeOpen(true)
                  setFormError(null)
                }}
              />
            ) : null}
          </>
        }
      />

      {!isAdmin && (
        <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          {tr('Messages.seuls.les.administrateurs.peuvent.rediger.des.messages.consu')}
        </div>
      )}

      <div className="mb-4 flex gap-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key)
              setPage(0)
            }}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === t.key ? 'bg-brand-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <ErrorBlock message={error} />}
      {loading && <LoadingBlock />}

      {!loading && data && data.items.length > 0 && (
        <>
          <Table
            rowKey={(m) => m.id}
            onRowClick={openMessage}
            rows={data.items}
            startIndex={data.page * size}
            columns={[
              {
                key: 'subject',
                label: 'Objet',
                render: (m) => (
                  <div>
                    <p className={`font-medium ${m.read ? 'text-gray-700' : 'text-gray-900'}`}>
                      {m.subject}
                      {!m.read && (
                        <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-brand-600" />
                      )}
                    </p>
                    <p className="max-w-md truncate text-xs text-gray-500">{m.body}</p>
                  </div>
                ),
              },
              {
                key: 'person',
                label: tab === 'inbox' ? 'Expéditeur' : 'Destinataire',
                render: (m) => {
                  const person = tab === 'inbox' ? m.sender : m.recipient
                  return person ? `${person.firstName} ${person.lastName}` : '—'
                },
              },
              {
                key: 'date',
                label: 'Date',
                render: (m) => <span className="text-gray-500">{formatDateTime(m.createdAt)}</span>,
              },
            ]}
          />
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />
        </>
      )}

      {!loading && data && data.items.length === 0 && (
        <EmptyState
          title={tr('Messages.aucun.message')}
          description={tab === 'inbox' ? 'Votre boîte de réception est vide.' : 'Vous n’avez rien envoyé.'}
        />
      )}

      <Modal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        title={tr('Messages.nouveau.message')}
        footer={
          <>
            <IconButton icon="cancel" label="Annuler" onClick={() => setComposeOpen(false)} />
            <IconButton icon="send" label="Envoyer" variant="primary" className="w-auto" onClick={handleSend as never} disabled={submitting} loading={submitting} />
          </>
        }
      >
        <form onSubmit={handleSend} className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {formError}
            </div>
          )}
          <Field label={tr('Messages.destinataire')}>
            <Select value={recipientId} onChange={(e) => setRecipientId(e.target.value)}>
              <option value="">{tr('Messages.selectionner')}</option>
              {(users?.items ?? [])
                .filter((u) => u.id !== user?.id)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName} ({u.username})
                  </option>
                ))}
            </Select>
          </Field>
          <Field label={tr('Messages.objet')}>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>
          <Field label={tr('Messages.message')}>
            <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
        </form>
      </Modal>

      <Modal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing?.subject ?? 'Message'}
        footer={
          <>
            <IconButton icon="close" label="Fermer" onClick={() => setViewing(null)} />
            <IconButton icon="delete" label="Supprimer" variant="danger" onClick={handleDelete} />
          </>
        }
      >
        {viewing && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              {tab === 'inbox' ? 'De' : 'À'} :{' '}
              {(tab === 'inbox' ? viewing.sender : viewing.recipient)
                ? `${(tab === 'inbox' ? viewing.sender : viewing.recipient)!.firstName} ${
                    (tab === 'inbox' ? viewing.sender : viewing.recipient)!.lastName
                  }`
                : '—'}{' '}
              · {formatDateTime(viewing.createdAt)}
            </p>
            <p className="whitespace-pre-wrap text-sm text-gray-800">{viewing.body}</p>
          </div>
        )}
      </Modal>
    </div>
  )
}
