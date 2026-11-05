import { tr } from '../i18n/translate'
import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { prospectsApi } from '../api/prospects'
import { ApiError } from '../api/client'
import { useAsync } from '../lib/useAsync'
import { Button, Field, IconButton, Input, RefreshButton, Select, Textarea } from '../components/ui'
import { Badge, EmptyState, ErrorBlock, LoadingBlock, Modal, PageHeader, Table } from '../components/data'
import { dialog } from '../components/dialog'
import { useSoc } from '../soc/SocContext'
import type { ProspectDto, ProspectKind, ProspectNoteDto, ProspectTarget } from '../api/types'

interface FormState {
  name: string
  kind: ProspectKind
  contactName: string
  contactEmail: string
  contactPhone: string
  address: string
}

const emptyForm: FormState = {
  name: '',
  kind: 'COMPANY',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  address: '',
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  const [year, month, day] = value.split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

function noteClassName(note: ProspectNoteDto): string {
  const base = 'rounded-lg border px-3 py-2'
  if (note.color === 'green') return `${base} border-green-200 bg-green-50`
  if (note.color === 'blue') return `${base} border-blue-200 bg-blue-50`
  return `${base} border-gray-100 bg-gray-50`
}

function noteText(note: ProspectNoteDto): string {
  const key = note.eventType === 'CONVERSION_CLIENT'
    ? 'Prospects.note.converted.client'
    : note.eventType === 'CONVERSION_SUPPLIER'
      ? 'Prospects.note.converted.supplier'
      : null
  if (!key) return note.content
  const translated = tr(key)
  return translated === key ? note.content : translated
}

export function Prospects() {
  const { user } = useAuth()
  const { selectedSocId } = useSoc()
  const socId = selectedSocId ?? user?.socId ?? undefined

  const { data, loading, error, reload, setData } = useAsync(
    () => prospectsApi.findAll(socId),
    [socId],
  )

  const [editing, setEditing] = useState<ProspectDto | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [noteProspect, setNoteProspect] = useState<ProspectDto | null>(null)
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteDate, setNoteDate] = useState(today())
  const [noteContent, setNoteContent] = useState('')
  const [noteError, setNoteError] = useState<string | null>(null)
  const [noteSubmitting, setNoteSubmitting] = useState(false)
  const [notePage, setNotePage] = useState(0)

  function openCreate() {
    setForm(emptyForm)
    setEditing(null)
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(prospect: ProspectDto) {
    setForm({
      name: prospect.name,
      kind: prospect.kind,
      contactName: prospect.contactName ?? '',
      contactEmail: prospect.contactEmail ?? '',
      contactPhone: prospect.contactPhone ?? '',
      address: prospect.address ?? '',
    })
    setEditing(prospect)
    setFormError(null)
    setModalOpen(true)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!form.name.trim()) {
      setFormError(tr('Prospects.nom.obligatoire'))
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      const payload = {
        name: form.name.trim(),
        kind: form.kind,
        contactName: form.contactName.trim() || null,
        contactEmail: form.contactEmail.trim() || null,
        contactPhone: form.contactPhone.trim() || null,
        address: form.address.trim() || null,
        socId: socId ?? null,
        socParentId: socId ?? null,
        status: editing?.status ?? 'ACTIVE',
      }
      if (editing) {
        await prospectsApi.update(editing.id, payload)
      } else {
        await prospectsApi.create(payload)
      }
      setModalOpen(false)
      reload()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(prospect: ProspectDto) {
    if (!(await dialog.confirm(tr('Prospects.deleteConfirm'), { variant: 'warning', danger: true, okLabel: tr('common.delete') }))) {
      return
    }
    try {
      await prospectsApi.delete(prospect.id)
      setData((data ?? []).filter((item) => item.id !== prospect.id))
    } catch (err) {
      void dialog.error(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    }
  }

  async function handleConvert(prospect: ProspectDto, target: ProspectTarget) {
    const targetLabel = target === 'CLIENT' ? tr('Prospects.target.client') : tr('Prospects.target.supplier')
    if (!(await dialog.confirm(tr('Prospects.convertConfirm', { target: targetLabel }), { variant: 'question' }))) {
      return
    }
    try {
      const updated = await prospectsApi.convert(prospect.id, target)
      setData((data ?? []).map((item) => (item.id === updated.id ? updated : item)))
    } catch (err) {
      void dialog.error(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    }
  }

  function openNotes(prospect: ProspectDto) {
    setNoteProspect(prospect)
    setNoteDate(today())
    setNoteContent('')
    setNoteError(null)
    setNotePage(0)
    setNoteOpen(true)
  }

  function refreshProspect(updated: ProspectDto) {
    setNoteProspect(updated)
    setData((data ?? []).map((item) => (item.id === updated.id ? updated : item)))
  }

  async function handleAddNote(event: FormEvent) {
    event.preventDefault()
    if (!noteProspect) return
    if (!noteContent.trim()) {
      setNoteError(tr('Prospects.note.obligatoire'))
      return
    }
    setNoteSubmitting(true)
    setNoteError(null)
    try {
      const updated = await prospectsApi.addNote(noteProspect.id, {
        noteDate: noteDate || null,
        content: noteContent.trim(),
      })
      refreshProspect(updated)
      setNoteContent('')
      setNoteDate(today())
      setNotePage(0)
    } catch (err) {
      setNoteError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    } finally {
      setNoteSubmitting(false)
    }
  }

  async function handleDeleteNote(noteId: number) {
    if (!noteProspect) return
    if (!(await dialog.confirm(tr('Prospects.deleteNoteConfirm'), { variant: 'warning', danger: true }))) {
      return
    }
    try {
      refreshProspect(await prospectsApi.deleteNote(noteProspect.id, noteId))
    } catch (err) {
      void dialog.error(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    }
  }

  const notePageSize = user?.pageSize ?? 5
  const notes = noteProspect?.notes ?? []
  const noteTotalPages = Math.max(1, Math.ceil(notes.length / notePageSize))
  const safeNotePage = Math.min(notePage, noteTotalPages - 1)
  const visibleNotes = notes.slice(safeNotePage * notePageSize, safeNotePage * notePageSize + notePageSize)

  return (
    <div>
      <PageHeader
        title={tr('Prospects.title')}
        titleId="Prospects.title"
        count={(data ?? []).length}
        subtitle={tr('Prospects.subtitle')}
        subtitleId="Prospects.subtitle"
        actions={
          <>
            <RefreshButton onClick={reload} />
            <IconButton
              icon="add"
              label={tr('Prospects.new')}
              variant="new"
              onClick={openCreate}
              id="Prospects.new"
            />
          </>
        }
      />

      {error && <ErrorBlock id="Prospects.error" message={error} />}
      {loading && <LoadingBlock />}
      {!loading && data && data.length > 0 && (
        <Table
          paginate
          rowKey={(prospect) => prospect.id}
          rows={data}
          onRowClick={openEdit}
          columns={[
            {
              key: 'Prospects.name',
              label: tr('Prospects.name'),
              render: (prospect) => (
                <div>
                  <p id={`Prospects.row.${prospect.id}.name`} className="font-medium text-gray-900">{prospect.name}</p>
                  <p id={`Prospects.row.${prospect.id}.kind`} className="text-xs text-gray-500">
                    {prospect.kind === 'PERSON' ? tr('Prospects.kind.person') : tr('Prospects.kind.company')}
                  </p>
                </div>
              ),
            },
            {
              key: 'Prospects.contactName',
              label: tr('Prospects.contactName'),
              render: (prospect) => (
                <div>
                  {prospect.contactName ? <p id={`Prospects.row.${prospect.id}.contactName`} className="text-gray-900">{prospect.contactName}</p> : null}
                  {prospect.contactEmail ? <p id={`Prospects.row.${prospect.id}.email`} className="text-xs text-gray-500">{prospect.contactEmail}</p> : null}
                  {prospect.contactPhone ? <p id={`Prospects.row.${prospect.id}.phone`} className="text-xs text-gray-500">{prospect.contactPhone}</p> : null}
                  {!prospect.contactName && !prospect.contactEmail && !prospect.contactPhone ? (
                    <span id={`Prospects.row.${prospect.id}.contactEmpty`} className="text-gray-400">—</span>
                  ) : null}
                </div>
              ),
            },
            {
              key: 'Prospects.lastNote',
              label: tr('Prospects.lastNote'),
              render: (prospect) => (
                <span id={`Prospects.row.${prospect.id}.lastNote`}>{formatDate(prospect.lastNoteDate)}</span>
              ),
            },
            {
              key: 'Prospects.status',
              label: tr('Prospects.status'),
              render: (prospect) => (
                <div className="flex flex-col gap-1">
                  <Badge kind={prospect.status === 'ACTIVE' ? 'success' : 'muted'} id={`Prospects.row.${prospect.id}.status`}>
                    {prospect.status === 'ACTIVE' ? tr('Prospects.active') : tr('Prospects.archived')}
                  </Badge>
                  {prospect.convertedTo ? (
                    <span id={`Prospects.row.${prospect.id}.converted`} className="text-xs text-gray-500">
                      {tr('Prospects.convertedTo')} {prospect.convertedTo === 'CLIENT' ? tr('Prospects.target.client') : tr('Prospects.target.supplier')}
                    </span>
                  ) : null}
                </div>
              ),
            },
            {
              key: 'actions',
              label: '',
              render: (prospect) => (
                <div id={`Prospects.row.${prospect.id}.actions`} className="flex justify-end gap-1">
                  <IconButton
                    icon="history"
                    label={tr('Prospects.notes')}
                    variant="history"
                    onClick={(event) => { event.stopPropagation(); openNotes(prospect) }}
                    id={`Prospects.row.${prospect.id}.notes`}
                  />
                  {prospect.status === 'ACTIVE' ? (
                    <>
                      <IconButton
                        icon="check"
                        label={tr('Prospects.convertToClient')}
                        variant="ok"
                        onClick={(event) => { event.stopPropagation(); void handleConvert(prospect, 'CLIENT') }}
                        id={`Prospects.row.${prospect.id}.convert.client`}
                      />
                      <IconButton
                        icon="send"
                        label={tr('Prospects.convertToSupplier')}
                        variant="new"
                        onClick={(event) => { event.stopPropagation(); void handleConvert(prospect, 'SUPPLIER') }}
                        id={`Prospects.row.${prospect.id}.convert.supplier`}
                      />
                    </>
                  ) : null}
                  <IconButton
                    icon="edit"
                    label={tr('common.edit')}
                    variant="primary"
                    onClick={(event) => { event.stopPropagation(); openEdit(prospect) }}
                    id={`Prospects.row.${prospect.id}.edit`}
                  />
                  <IconButton
                    icon="delete"
                    label={tr('common.delete')}
                    variant="danger"
                    onClick={(event) => { event.stopPropagation(); void handleDelete(prospect) }}
                    id={`Prospects.row.${prospect.id}.delete`}
                  />
                </div>
              ),
            },
          ]}
        />
      )}
      {!loading && data?.length === 0 && (
        <EmptyState
          title={tr('Prospects.empty')}
          titleId="Prospects.empty"
          description={tr('Prospects.subtitle')}
          descriptionId="Prospects.subtitle.empty"
        />
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? tr('Prospects.edit') : tr('Prospects.new')}
        titleId="Prospects.modal.title"
        footer={
          <>
            <IconButton icon="cancel" label={tr('common.cancel')} onClick={() => setModalOpen(false)} id="Prospects.cancel" />
            <IconButton
              icon={editing ? 'save' : 'add'}
              label={editing ? tr('common.save') : tr('common.create')}
              variant="primary"
              onClick={handleSubmit as never}
              disabled={submitting}
              loading={submitting}
              id={editing ? 'Prospects.save' : 'Prospects.create'}
            />
          </>
        }
      >
        <form id="Prospects.form" onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div id="Prospects.formError" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={tr('Prospects.name')} id="Prospects.name">
              <Input
                id="Prospects.name.input"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
              />
            </Field>
            <Field label={tr('Prospects.kind')} id="Prospects.kind">
              <Select
                id="Prospects.kind.input"
                value={form.kind}
                onChange={(event) => setForm({ ...form, kind: event.target.value as ProspectKind })}
              >
                <option value="COMPANY">{tr('Prospects.kind.company')}</option>
                <option value="PERSON">{tr('Prospects.kind.person')}</option>
              </Select>
            </Field>
            <Field label={tr('Prospects.contactName')} id="Prospects.contactName">
              <Input
                id="Prospects.contactName.input"
                value={form.contactName}
                onChange={(event) => setForm({ ...form, contactName: event.target.value })}
              />
            </Field>
            <Field label={tr('Prospects.phone')} id="Prospects.phone">
              <Input
                id="Prospects.phone.input"
                value={form.contactPhone}
                onChange={(event) => setForm({ ...form, contactPhone: event.target.value })}
              />
            </Field>
          </div>
          <Field label={tr('Prospects.email')} id="Prospects.email">
            <Input
              id="Prospects.email.input"
              type="email"
              value={form.contactEmail}
              onChange={(event) => setForm({ ...form, contactEmail: event.target.value })}
            />
          </Field>
          <Field label={tr('Prospects.address')} id="Prospects.address">
            <Input
              id="Prospects.address.input"
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
            />
          </Field>
        </form>
      </Modal>

      <Modal
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        title={`${tr('Prospects.notes.title')} — ${noteProspect?.name ?? ''}`}
        titleId="Prospects.notes.title"
        size="lg"
        footer={
          <IconButton icon="close" label={tr('common.close')} variant="neutral" onClick={() => setNoteOpen(false)} id="Prospects.notes.close" />
        }
      >
        <form id="Prospects.notes.form" onSubmit={handleAddNote} className="mb-4 space-y-3 rounded-lg border border-gray-200 p-3">
          {noteError && <div id="Prospects.notes.error" className="text-sm text-red-600">{noteError}</div>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={tr('Prospects.noteDate')} id="Prospects.noteDate">
              <Input
                id="Prospects.noteDate.input"
                type="date"
                value={noteDate}
                onChange={(event) => setNoteDate(event.target.value)}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label={tr('Prospects.noteContent')} id="Prospects.noteContent">
                <Textarea
                  id="Prospects.noteContent.input"
                  rows={3}
                  value={noteContent}
                  onChange={(event) => setNoteContent(event.target.value)}
                />
              </Field>
            </div>
          </div>
          <div className="flex justify-end">
            <IconButton
              icon="add"
              label={tr('Prospects.addNote')}
              variant="primary"
              type="submit"
              disabled={noteSubmitting}
              loading={noteSubmitting}
              id="Prospects.notes.add"
            />
          </div>
        </form>

        {!noteProspect || noteProspect.notes.length === 0 ? (
          <p id="Prospects.notes.empty" className="text-gray-500">{tr('Prospects.noNotes')}</p>
        ) : (
          <div className="space-y-2">
            {visibleNotes.map((note) => (
              <div id={`Prospects.notes.${note.id}`} key={note.id} className={noteClassName(note)}>
                <div className="flex items-center justify-between gap-2">
                  <span id={`Prospects.notes.${note.id}.date`} className="text-xs font-semibold text-gray-600">{formatDate(note.noteDate)}</span>
                  <IconButton
                    icon="delete"
                    label={tr('common.delete')}
                    variant="danger"
                    onClick={() => void handleDeleteNote(note.id)}
                    id={`Prospects.notes.${note.id}.delete`}
                  />
                </div>
                <p id={`Prospects.notes.${note.id}.content`} className="whitespace-pre-wrap text-sm text-gray-800">{noteText(note)}</p>
                {note.author ? (
                  <p id={`Prospects.notes.${note.id}.author`} className="mt-1 text-xs text-gray-400">{note.author}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
        {noteProspect && noteTotalPages > 1 ? (
          <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
            <span id="Prospects.notes.total">
              {noteProspect.notes.length} {noteProspect.notes.length > 1 ? tr('common.items') : tr('common.item')}
            </span>
            <div className="flex items-center gap-1">
              <Button
                id="Prospects.notes.previous"
                variant="neutral"
                disabled={safeNotePage <= 0}
                onClick={() => setNotePage(safeNotePage - 1)}
              >
                {tr('common.previous')}
              </Button>
              <span id="Prospects.notes.page">
                {tr('common.page')} {safeNotePage + 1} / {noteTotalPages}
              </span>
              <Button
                id="Prospects.notes.next"
                variant="neutral"
                disabled={safeNotePage >= noteTotalPages - 1}
                onClick={() => setNotePage(safeNotePage + 1)}
              >
                {tr('common.next')}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
