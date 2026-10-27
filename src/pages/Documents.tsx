import { tr } from '../i18n/translate'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { documentsApi } from '../api/documents'
import { consultantsApi } from '../api/consultants'
import { ApiError } from '../api/client'
import { useAsync } from '../lib/useAsync'
import { Button, Card, Field, IconButton, InlineButton, Input, RefreshButton, Select, Spinner } from '../components/ui'
import { Badge, EmptyState, ErrorBlock, LoadingBlock, Modal, PageHeader, Table } from '../components/data'
import { dialog } from '../components/dialog'
import { DOCUMENT_CATEGORIES, formatDate, formatSize } from '../lib/format'
import { DocumentPreview } from '../components/DocumentPreview'
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
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      setFilePreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setFilePreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

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
      setFormError(tr('Documents.selectionnez.un.fichier'))
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
        titleId="Documents.documents"
        count={(data ?? []).length}
        subtitle={tr('Documents.partage.et.archivage.des.documents.contrats.pieces.rh')}
        subtitleId="Documents.partage.et.archivage.des.documents.contrats.pieces.rh"
        actions={
          <>
            <RefreshButton onClick={reload} />
            <IconButton icon="add" label={tr('Documents.partager.un.document')} variant="new" onClick={openUpload} id="Documents.partager.un.document" />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="p-5" id="Documents.card.documents">
          <p id="Documents.documents.2" className="text-sm font-medium text-gray-500">{tr('Documents.documents')}</p>
          <p id="Documents.documentsCount" className="mt-2 text-2xl font-bold text-gray-900">{(data ?? []).length}</p>
        </Card>
        <Card className="p-5" id="Documents.card.expiring">
          <p id="Documents.expire.sous.30.jours" className="text-sm font-medium text-gray-500">{tr('Documents.expire.sous.30.jours')}</p>
          <p id="Documents.expiredSoonCount" className="mt-2 text-2xl font-bold text-gray-900">{expiredSoon}</p>
        </Card>
        <Card className="p-5" id="Documents.card.size">
          <p id="Documents.taille.totale" className="text-sm font-medium text-gray-500">{tr('Documents.taille.totale')}</p>
          <p id="Documents.totalSize" className="mt-2 text-2xl font-bold text-gray-900">
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
                label: tr('Documents.document'),
                render: (d) => (
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6Zm7 7V3.5L18.5 9H13Z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p id={`Documents.document.${d.id}.name`} className="truncate font-medium text-gray-900">{d.name}</p>
                      <p id={`Documents.document.${d.id}.size`} className="text-xs text-gray-500">{formatSize(d.size)}</p>
                    </div>
                  </div>
                ),
              },
              {
                key: 'category',
                label: tr('Documents.categorie'),
                render: (d) => <Badge kind="info" id={`Documents.document.${d.id}.category`}>{d.category}</Badge>,
              },
              {
                key: 'description',
                label: tr('Documents.description'),
                render: (d) => <span id={`Documents.document.${d.id}.description`} className="text-gray-500">{d.description ?? '—'}</span>,
              },
              {
                key: 'expires',
                label: tr('Documents.expire.le'),
                render: (d) => <span id={`Documents.document.${d.id}.expires`} className="text-gray-500">{formatDate(d.expiresAt)}</span>,
              },
              {
                key: 'uploaded',
                label: tr('Documents.partage.par'),
                render: (d) => <span id={`Documents.document.${d.id}.uploadedBy`} className="text-gray-500">{d.uploadedBy}</span>,
              },
              {
                key: 'actions',
                label: '',
                render: (d) => (
                  <div className="flex justify-end gap-1">
                    <InlineButton id={`Documents.document.${d.id}.download`} onClick={() => handleDownload(d)}>{tr('Documents.telecharger')}</InlineButton>
                    {canDelete && (
                      <IconButton id={`Documents.document.${d.id}.delete`} icon="delete" label={tr('common.delete')} variant="danger" onClick={() => handleDelete(d)} />
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
          titleId="Documents.aucun.document"
          description={tr('Documents.partagez.le.premier.document.de.votre.espace')}
          descriptionId="Documents.partagez.le.premier.document.de.votre.espace"
        />
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={tr('Documents.partager.un.document')}
        titleId="Documents.partager.un.document.modal"
        footer={
          <>
            <IconButton icon="cancel" label={tr('common.cancel')} onClick={() => setModalOpen(false)} id="common.cancel" />
            <Button id="Documents.partager" className="w-auto" onClick={handleUpload as never} disabled={submitting || !file}>
              {submitting ? <Spinner className="border-white border-t-transparent" /> : null}
              {tr('Documents.partager')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleUpload} className="space-y-4">
          {formError && (
            <div id="Documents.formError" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
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
            <button type="button" id="Documents.chooseFile" onClick={() => fileRef.current?.click()}>
              <p id="Documents.chooseFile.name" className="text-sm font-medium text-brand-600">
                {file ? file.name : tr('Documents.choisir.un.fichier')}
              </p>
              {!file && <p id="Documents.pdf.images.documents" className="mt-1 text-xs text-gray-500">{tr('Documents.pdf.images.documents')}</p>}
            </button>
          </div>
          {file && filePreviewUrl && (
            <DocumentPreview url={filePreviewUrl} name={file.name} />
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={tr('Documents.categorie')} id="Documents.categorie">
              <Select id="Documents.categorie.select" value={category} onChange={(e) => setCategory(e.target.value)}>
                {DOCUMENT_CATEGORIES.map((cat, index) => (
                  <option key={cat} id={`Documents.categorie.option.${index}`} value={cat}>
                    {cat}
                  </option>
                ))}
              </Select>
            </Field>
            {!isConsultant && (
              <Field label={tr('Documents.consultant.concerne')} id="Documents.consultant.concerne">
                <Select id="Documents.consultant.concerne.select" value={consultantId} onChange={(e) => setConsultantId(e.target.value)}>
                  <option id="Documents.tous.general" value="">{tr('Documents.tous.general')}</option>
                  {(summaries ?? []).map((c) => (
                    <option key={c.id} id={`Documents.consultant.concerne.option.${c.id}`} value={c.id}>
                      {c.fullName}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
          <Field label={tr('Documents.description')} id="Documents.description">
            <Input
              id="Documents.description.input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={tr('Documents.contrat.signe.avenant')}
            />
          </Field>
          <Field label={tr('Documents.expiration.optionnel')} id="Documents.expiration.optionnel">
            <Input id="Documents.expiration.optionnel.input" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </Field>
          <Field label={tr('Documents.visibilite')} id="Documents.visibilite">
            <Select id="Documents.visibilite.select" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
              <option id="Documents.prive.personnes.choisies" value="PRIVATE">{tr('Documents.prive.personnes.choisies')}</option>
              <option id="Documents.public.toute.la.societe" value="PUBLIC">{tr('Documents.public.toute.la.societe')}</option>
            </Select>
          </Field>
          {visibility === 'PRIVATE' && (
            <Field label={tr('Documents.partager.avec')} id="Documents.partager.avec">
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2">
                {(shareTargets ?? []).length === 0 && (
                  <p id="Documents.aucune.personne.a.partager" className="px-2 py-1 text-sm text-gray-400">{tr('Documents.aucune.personne.a.partager')}</p>
                )}
                {(shareTargets ?? []).map((m) => (
                  <label key={m.id} id={`Documents.partager.avec.${m.id}.label`} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-gray-50">
                    <input
                      id={`Documents.partager.avec.${m.id}.checkbox`}
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
                    <span id={`Documents.partager.avec.${m.id}.fullName`} className="text-gray-700">{m.fullName}</span>
                    <span id={`Documents.partager.avec.${m.id}.role`} className="text-xs text-gray-400">{m.role}</span>
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
