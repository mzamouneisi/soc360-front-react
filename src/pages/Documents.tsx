import { tr } from '../i18n/translate'
import { useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { documentsApi } from '../api/documents'
import { consultantsApi } from '../api/consultants'
import { ApiError } from '../api/client'
import { useAsync } from '../lib/useAsync'
import { Button, Card, Field, IconButton, InlineButton, Input, RefreshButton, Select, Spinner } from '../components/ui'
import { Badge, EmptyState, ErrorBlock, LoadingBlock, Modal, PageHeader, Table } from '../components/data'
import { dialog } from '../components/dialog'
import { DOCUMENT_CATEGORIES, formatDate, formatSize } from '../lib/format'
import type { HrDocumentDto } from '../api/types'

export function Documents() {
  const { user } = useAuth()
  const isConsultant = user?.role === 'CONSULTANT'
  const canDelete = user?.role === 'ADMIN' || user?.role === 'RESPONSIBLE_SOC'

  const { data, loading, error, reload, setData } = useAsync(
    () =>
      isConsultant && user?.consultantId
        ? documentsApi.findAll({ consultantId: user.consultantId })
        : documentsApi.findAll({ socId: user?.socId ?? undefined }),
    [user?.socId, user?.consultantId, isConsultant],
  )

  const { data: summaries } = useAsync(
    () => (user?.socId ? consultantsApi.summaries(user.socId) : Promise.resolve([])),
    [user?.socId],
  )

  const { data: shareTargets } = useAsync(
    () => documentsApi.shareTargets(),
    [user?.id],
  )

  const [modalOpen, setModalOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [category, setCategory] = useState<string>(DOCUMENT_CATEGORIES[0])
  const [description, setDescription] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [consultantId, setConsultantId] = useState('')
  const [visibility, setVisibility] = useState('PRIVATE')
  const [sharedWith, setSharedWith] = useState<number[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!user) return null

  function openUpload() {
    setFile(null)
    setCategory(DOCUMENT_CATEGORIES[0])
    setDescription('')
    setExpiresAt('')
    setConsultantId(isConsultant ? String(user.consultantId ?? '') : '')
    setVisibility('PRIVATE')
    setSharedWith([])
    setFormError(null)
    setModalOpen(true)
    setTimeout(() => fileRef.current?.click(), 50)
  }

  async function handleUpload(e: FormEvent) {
    e.preventDefault()
    if (!file) {
      setFormError('Sélectionnez un fichier')
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      await documentsApi.upload(file, {
        consultantId: consultantId
          ? Number(consultantId)
          : isConsultant
            ? (user?.consultantId ?? null)
            : null,
        socId: user?.socId ?? null,
        category,
        expiresAt: expiresAt || null,
        description: description || null,
        visibility,
        sharedWith: visibility === 'PUBLIC' ? [] : sharedWith,
      })
      setModalOpen(false)
      reload()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDownload(doc: HrDocumentDto) {
    try {
      await documentsApi.download(doc.id, doc.name)
    } catch (err) {
      void dialog.error(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    }
  }

  async function handleDelete(doc: HrDocumentDto) {
    if (!(await dialog.confirm(tr('Documents.supprimer.le.document', { name: doc.name }), { variant: 'warning', danger: true, okLabel: tr('common.delete') }))) return
    try {
      await documentsApi.delete(doc.id)
      setData((prev) => (prev ?? []).filter((d) => d.id !== doc.id))
    } catch (err) {
      void dialog.error(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    }
  }

  const expiredSoon = (data ?? []).filter((d) => {
    if (!d.expiresAt) return false
    const exp = new Date(d.expiresAt + 'T00:00:00')
    const limit = new Date()
    limit.setDate(limit.getDate() + 30)
    return exp < limit
  }).length

  return (
    <div>
      <PageHeader
        title={tr('Documents.documents')}
        count={(data ?? []).length}
        subtitle={tr('Documents.partage.et.archivage.des.documents.contrats.pieces.rh')}
        actions={
          <>
            <RefreshButton onClick={reload} />
            <IconButton icon="add" label={tr('Documents.partager.un.document')} variant="new" onClick={openUpload} id="Documents.partager.un.document" />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm font-medium text-gray-500">{tr('Documents.documents')}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{(data ?? []).length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-gray-500">{tr('Documents.expire.sous.30.jours')}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{expiredSoon}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-gray-500">{tr('Documents.taille.totale')}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {formatSize((data ?? []).reduce((s, d) => s + d.size, 0))}
          </p>
        </Card>
      </div>

      {error && <ErrorBlock message={error} />}
      {loading && <LoadingBlock />}

      {!loading && data && data.length > 0 && (
        <div className="mt-6">
          <Table
            paginate
            rowKey={(d) => d.id}
            rows={data}
            columns={[
              {
                key: 'name',
                label: 'Document',
                render: (d) => (
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6Zm7 7V3.5L18.5 9H13Z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900">{d.name}</p>
                      <p className="text-xs text-gray-500">{formatSize(d.size)}</p>
                    </div>
                  </div>
                ),
              },
              {
                key: 'category',
                label: 'Catégorie',
                render: (d) => <Badge kind="info">{d.category}</Badge>,
              },
              {
                key: 'description',
                label: 'Description',
                render: (d) => <span className="text-gray-500">{d.description ?? '—'}</span>,
              },
              {
                key: 'expires',
                label: 'Expire le',
                render: (d) => <span className="text-gray-500">{formatDate(d.expiresAt)}</span>,
              },
              {
                key: 'uploaded',
                label: 'Partagé par',
                render: (d) => <span className="text-gray-500">{d.uploadedBy}</span>,
              },
              {
                key: 'actions',
                label: '',
                render: (d) => (
                  <div className="flex justify-end gap-1">
                    <InlineButton onClick={() => handleDownload(d)}>Télécharger</InlineButton>
                    {canDelete && (
                      <IconButton icon="delete" label="Supprimer" variant="danger" onClick={() => handleDelete(d)} />
                    )}
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      {!loading && data && data.length === 0 && (
        <EmptyState
          title={tr('Documents.aucun.document')}
          description={tr('Documents.partagez.le.premier.document.de.votre.espace')}
        />
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={tr('Documents.partager.un.document')}
        footer={
          <>
            <IconButton icon="cancel" label="Annuler" onClick={() => setModalOpen(false)} />
            <Button className="w-auto" onClick={handleUpload as never} disabled={submitting || !file}>
              {submitting ? <Spinner className="border-white border-t-transparent" /> : null}
              Partager
            </Button>
          </>
        }
      >
        <form onSubmit={handleUpload} className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {formError}
            </div>
          )}
          <div className="rounded-lg border border-dashed border-gray-300 p-4 text-center">
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <button type="button" onClick={() => fileRef.current?.click()}>
              <p className="text-sm font-medium text-brand-600">
                {file ? file.name : 'Choisir un fichier'}
              </p>
              {!file && <p className="mt-1 text-xs text-gray-500">{tr('Documents.pdf.images.documents')}</p>}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={tr('Documents.categorie')} id="Documents.categorie">
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                {DOCUMENT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </Select>
            </Field>
            {!isConsultant && (
              <Field label={tr('Documents.consultant.concerne')} id="Documents.consultant.concerne">
                <Select value={consultantId} onChange={(e) => setConsultantId(e.target.value)}>
                  <option value="">{tr('Documents.tous.general')}</option>
                  {(summaries ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
          <Field label={tr('Documents.description')} id="Documents.description">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={tr('Documents.contrat.signe.avenant')}
            />
          </Field>
          <Field label={tr('Documents.expiration.optionnel')} id="Documents.expiration.optionnel">
            <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </Field>
          <Field label={tr('Documents.visibilite')} id="Documents.visibilite">
            <Select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
              <option value="PRIVATE">{tr('Documents.prive.personnes.choisies')}</option>
              <option value="PUBLIC">{tr('Documents.public.toute.la.societe')}</option>
            </Select>
          </Field>
          {visibility === 'PRIVATE' && (
            <Field label={tr('Documents.partager.avec')} id="Documents.partager.avec">
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2">
                {(shareTargets ?? []).length === 0 && (
                  <p className="px-2 py-1 text-sm text-gray-400">{tr('Documents.aucune.personne.a.partager')}</p>
                )}
                {(shareTargets ?? []).map((m) => (
                  <label key={m.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={sharedWith.includes(m.id)}
                      onChange={(e) =>
                        setSharedWith((prev) =>
                          e.target.checked
                            ? [...prev, m.id]
                            : prev.filter((id) => id !== m.id),
                        )
                      }
                      className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-gray-700">{m.fullName}</span>
                    <span className="text-xs text-gray-400">{m.role}</span>
                  </label>
                ))}
              </div>
            </Field>
          )}
        </form>
      </Modal>
    </div>
  )
}
