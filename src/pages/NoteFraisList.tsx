import { tr } from '../i18n/translate'
import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { noteFraisApi } from '../api/noteFrais'
import { activitiesApi } from '../api/activities'
import { consultantsApi } from '../api/consultants'
import { documentsApi } from '../api/documents'
import { isImageFile, ocrImageText } from '../lib/ocr'
import { parseReceipt } from '../lib/receipt'
import { ApiError } from '../api/client'
import { useAsync } from '../lib/useAsync'
import { useDynamicTranslate } from '../lib/useDynamicTranslate'
import { usePagination } from '../lib/usePagination'
import { Card, Field, IconButton, Input, RefreshButton, Select, Textarea } from '../components/ui'
import { Badge, ErrorBlock, LoadingBlock, Modal, PageHeader, Pagination, Table } from '../components/data'
import { DocumentPreview } from '../components/DocumentPreview'
import { dialog } from '../components/dialog'
import {
  NOTE_FRAIS_CATEGORIES,
  NOTE_FRAIS_STATUS_LABELS,
  formatDateTime,
  formatMoney,
  monthLabel,
  monthShort,
  statusBadge,
} from '../lib/format'
import type { NoteFraisDto, NoteFraisHistoryDto } from '../api/types'

interface LineForm {
  date: string
  category: string
  label: string
  enseigne: string
  adresse: string
  montantHT: string
  montantTTC: string
  reimbursed: boolean
  comment: string
  fromDocument: boolean
}

interface FormState {
  consultantId: string
  activityId: string
  month: number
  year: number
  lines: LineForm[]
  infosFacture: string
}

function newLine(): LineForm {
  return {
    date: new Date().toISOString().slice(0, 10),
    category: 'Déplacement',
    label: '',
    enseigne: '',
    adresse: '',
    montantHT: '',
    montantTTC: '',
    reimbursed: false,
    comment: '',
    fromDocument: false,
  }
}

function lineAmount(line: LineForm): number {
  const ttc = Number(line.montantTTC) || 0
  const ht = Number(line.montantHT) || 0
  return ttc > 0 ? ttc : ht
}

function isBlankLine(line: LineForm): boolean {
  return (
    !line.enseigne.trim() &&
    !line.adresse.trim() &&
    !line.montantHT.trim() &&
    !line.montantTTC.trim() &&
    !line.label.trim()
  )
}

function fillLineFromText(lines: LineForm[], text: string, filename: string): LineForm[] {
  const parsed = parseReceipt(text, filename)
  const apply = (base: LineForm): LineForm => ({
    ...base,
    date: parsed.date ?? base.date,
    montantHT: parsed.montantHT != null ? String(parsed.montantHT) : base.montantHT,
    montantTTC: parsed.montantTTC != null ? String(parsed.montantTTC) : base.montantTTC,
    category: parsed.category ?? base.category,
    label: base.label.trim() ? base.label : parsed.label ?? '',
    enseigne: parsed.enseigne ?? base.enseigne,
    adresse: parsed.adresse ?? base.adresse,
    fromDocument: true,
  })
  const first = lines[0] ?? newLine()
  if (isBlankLine(first)) {
    return [apply(first), ...lines.slice(1)]
  }
  return [...lines, apply(newLine())]
}

export function NoteFraisList() {
  const { user } = useAuth()
  const dt = useDynamicTranslate()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())

  const isConsultant = user?.role === 'CONSULTANT'
  const canValidate =
    user?.role === 'ADMIN' || user?.role === 'RESPONSIBLE_SOC' || user?.role === 'MANAGER'

  const { data, loading, error, reload, setData } = useAsync(
    () =>
      isConsultant && user?.consultantId
        ? noteFraisApi.findByConsultantYear(user.consultantId, year)
        : user?.socId
          ? noteFraisApi.findBySocYear(user.socId, year)
          : Promise.resolve([] as NoteFraisDto[]),
    [user?.socId, user?.consultantId, isConsultant, year],
  )

  const { data: summaries } = useAsync(
    () => (user?.socId ? consultantsApi.summaries(user.socId) : Promise.resolve([])),
    [user?.socId],
  )

  const { data: totalsByMonth } = useAsync(
    () => (user?.socId && !isConsultant ? noteFraisApi.totalsByMonth(user.socId, year) : Promise.resolve({} as Record<string, number>)),
    [user?.socId, isConsultant, year],
  )
  const { data: totalsByCategory } = useAsync(
    () => (user?.socId && !isConsultant ? noteFraisApi.totalsByCategory(user.socId, year) : Promise.resolve({} as Record<string, number>)),
    [user?.socId, isConsultant, year],
  )

  const selfCollaboratorId = user?.consultantId ?? user?.id ?? null
  const collaboratorOptions = useMemo(() => {
    const list = summaries ?? []
    if (!selfCollaboratorId || list.some((c) => c.id === selfCollaboratorId)) return list
    return [
      {
        id: selfCollaboratorId,
        fullName: [user?.firstName, user?.lastName].filter(Boolean).join(' '),
        position: '',
        email: user?.email ?? '',
        hireDate: user?.hireDate ?? null,
      },
      ...list,
    ]
  }, [summaries, selfCollaboratorId, user?.firstName, user?.lastName, user?.email, user?.hireDate])
  const [form, setForm] = useState<FormState>({
    consultantId: String(selfCollaboratorId ?? ''),
    activityId: '',
    month: now.getMonth() + 1,
    year,
    lines: [newLine()],
    infosFacture: '',
  })
  const { data: activities } = useAsync(
    () =>
      activitiesApi.findAll({
        socId: user?.socId ?? undefined,
        consultantId: form.consultantId ? Number(form.consultantId) : undefined,
      }),
    [user?.socId, form.consultantId],
  )
  const [editing, setEditing] = useState<NoteFraisDto | null>(null)
  const [readOnlyForm, setReadOnlyForm] = useState(false)
  const [historyFor, setHistoryFor] = useState<NoteFraisDto | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null)
  const [attachmentName, setAttachmentName] = useState<string | null>(null)
  const [ocrPending, setOcrPending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [attachmentDocumentId, setAttachmentDocumentId] = useState<number | null>(null)
  const previewRequest = useRef(0)

  if (!user) return null

  const isOwner = (nf: NoteFraisDto) =>
    selfCollaboratorId != null && nf.consultantId === selfCollaboratorId
  const isCollaboratorManager = (nf: NoteFraisDto) =>
    nf.managerId != null && nf.managerId === user?.id
  // Une note soumise ou validée est verrouillée, sauf pour le manager direct du collaborateur
  // (qui peut intervenir, l'action étant historisée).
  const isReadOnlyForUser = (nf: NoteFraisDto) =>
    (nf.status === 'SUBMITTED' || nf.status === 'VALIDATED') && !isCollaboratorManager(nf)
  const canWrite = (nf: NoteFraisDto) => !isReadOnlyForUser(nf)
  const canSubmit = (nf: NoteFraisDto) =>
    isOwner(nf) && (nf.status === 'DRAFT' || nf.status === 'REJECTED')
  const canCancel = (nf: NoteFraisDto) =>
    isOwner(nf) && nf.status === 'SUBMITTED'
  const canReview = (nf: NoteFraisDto) => canValidate && !isOwner(nf)

  function openCreate() {
    previewRequest.current += 1
    if (attachmentUrl) URL.revokeObjectURL(attachmentUrl)
    setForm({
      consultantId: String(selfCollaboratorId ?? ''),
      activityId: '',
      month: now.getMonth() + 1,
      year,
      lines: [newLine()],
      infosFacture: '',
    })
    setEditing(null)
    setReadOnlyForm(false)
    setFormError(null)
    setAttachmentUrl(null)
    setAttachmentName(null)
    setAttachmentDocumentId(null)
    setOcrPending(false)
    setUploading(false)
    setModalOpen(true)
  }

  async function openEdit(nf: NoteFraisDto, readOnly = false) {
    const requestId = previewRequest.current + 1
    previewRequest.current = requestId
    if (attachmentUrl) URL.revokeObjectURL(attachmentUrl)
    setForm({
      consultantId: String(nf.consultantId),
      activityId: nf.activityId != null ? String(nf.activityId) : '',
      month: nf.month,
      year: nf.year,
      lines:
        nf.lines.length > 0
          ? nf.lines.map((l) => ({
              date: l.date,
              category: l.category,
              label: l.label,
              enseigne: l.enseigne ?? '',
              adresse: l.adresse ?? '',
              montantHT: String(l.montantHT),
              montantTTC: String(l.montantTTC),
              reimbursed: l.reimbursed,
              comment: l.comment ?? '',
              fromDocument: nf.documentId != null,
            }))
          : [newLine()],
      infosFacture: nf.infosFacture ?? '',
    })
    setEditing(nf)
    setReadOnlyForm(readOnly)
    setFormError(null)
    setAttachmentUrl(null)
    setAttachmentName(nf.documentName ?? null)
    setAttachmentDocumentId(nf.documentId ?? null)
    setOcrPending(false)
    setUploading(false)
    setModalOpen(true)
    if (nf.documentId) {
      try {
        const url = await documentsApi.previewUrl(nf.documentId)
        if (requestId !== previewRequest.current) {
          URL.revokeObjectURL(url)
          return
        }
        setAttachmentUrl(url)
      } catch {
        // Le bouton de téléchargement reste disponible si l'aperçu échoue.
      }
    }
  }

  async function openView(nf: NoteFraisDto) {
    await openEdit(nf, !canWrite(nf))
  }

  async function removeAttachment() {
    if (
      !(await dialog.confirm(
        tr('NoteFraisList.confirmer.retirer.le.document.joint', {
          name: attachmentName ?? '',
        }),
        { variant: 'warning', danger: true, okLabel: tr('NoteFraisList.retirer') },
      ))
    ) {
      return
    }
    if (attachmentUrl) URL.revokeObjectURL(attachmentUrl)
    setAttachmentUrl(null)
    setAttachmentName(null)
    setAttachmentDocumentId(null)
    setForm((prev) => {
      const kept = prev.lines.filter((line) => !line.fromDocument)
      return { ...prev, lines: kept.length > 0 ? kept : [newLine()] }
    })
  }

  async function removeLine(index: number) {
    if (
      !(await dialog.confirm(tr('NoteFraisList.confirmer.supprimer.la.ligne'), {
        variant: 'warning',
        danger: true,
        okLabel: tr('NoteFraisList.supprimer'),
      }))
    ) {
      return
    }
    setForm({ ...form, lines: form.lines.filter((_, j) => j !== index) })
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFormError(null)
    setUploading(true)
    try {
      // 1. Le justificatif est d'abord téléversé (il est obligatoire).
      const document = await documentsApi.upload(file, {
        category: 'JUSTIFICATIF',
        consultantId: form.consultantId ? Number(form.consultantId) : user?.consultantId ?? undefined,
        socId: user?.socId ?? undefined,
        description: 'Justificatif de note de frais',
      })
      if (attachmentUrl) URL.revokeObjectURL(attachmentUrl)
      setAttachmentDocumentId(document.id)
      setAttachmentName(document.name)
      setAttachmentUrl(URL.createObjectURL(file))

      // 2. Le texte du document est ensuite placé dans la zone de texte prévue.
      const textFile = /\.(txt|csv|md|json|xml|log)$/i.test(file.name)
      const pdfFile = /\.pdf$/i.test(file.name)
      const extractable = textFile || isImageFile(file.name) || pdfFile
      let text = ''
      if (textFile) {
        text = await file.text()
      } else if (isImageFile(file.name)) {
        setOcrPending(true)
        try {
          text = await ocrImageText(file)
        } finally {
          setOcrPending(false)
        }
      } else if (pdfFile) {
        const result = await noteFraisApi.extractText(file)
        text = result.text ?? ''
      }
      if (text.trim()) {
        // 3. Puis on reconnaît un maximum de valeurs pour pré-remplir le formulaire.
        setForm((prev) => ({
          ...prev,
          infosFacture: text,
          lines: fillLineFromText(prev.lines, text, file.name),
        }))
      } else if (extractable) {
        setFormError(
          isImageFile(file.name)
            ? 'OCR non disponible pour cette image : saisissez les informations manuellement.'
            : 'Aucun texte extrait de ce fichier : saisissez les informations manuellement.',
        )
      }
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)
    if (!attachmentDocumentId) {
      setFormError(tr('NoteFraisList.justificatif.obligatoire.erreur'))
      setSubmitting(false)
      return
    }
    const requestedLines = form.lines.filter((l) => !isBlankLine(l))
    const invalidLine = requestedLines.find(
      (l) =>
        !l.enseigne.trim() ||
        !l.category.trim() ||
        !l.label.trim() ||
        !l.adresse.trim() ||
        !l.date ||
        Number(l.montantHT) <= 0 ||
        Number(l.montantTTC) <= 0,
    )
    if (invalidLine) {
      setFormError(tr('NoteFraisList.champs.obligatoires'))
      setSubmitting(false)
      return
    }
    try {
      const request = {
        consultantId: Number(form.consultantId),
        month: form.month,
        year: form.year,
        lines: requestedLines
          .map((l) => ({
            date: l.date,
            category: l.category,
            label: l.label.trim() || 'Dépense',
            montantHT: Number(l.montantHT) || 0,
            montantTTC: Number(l.montantTTC) || 0,
            enseigne: l.enseigne.trim() || null,
            adresse: l.adresse.trim() || null,
            reimbursed: l.reimbursed,
            comment: l.comment || null,
          })),
        infosFacture: form.infosFacture || null,
        documentId: attachmentDocumentId,
        documentName: attachmentName,
        activityId: form.activityId ? Number(form.activityId) : null,
      }
      if (request.lines.length === 0) {
        setFormError('Ajoutez au moins une ligne')
        setSubmitting(false)
        return
      }
      if (editing) {
        await noteFraisApi.update(editing.id, request)
      } else {
        await noteFraisApi.create(request)
      }
      setModalOpen(false)
      reload()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    } finally {
      setSubmitting(false)
    }
  }

  async function changeStatus(
    nf: NoteFraisDto,
    action: 'submit' | 'cancel' | 'validate' | 'reject' | 'delete',
  ) {
    try {
      if (action === 'submit') {
        const updated = await noteFraisApi.submit(nf.id)
        setData((prev) => (prev ?? []).map((x) => (x.id === updated.id ? updated : x)))
      } else if (action === 'cancel') {
        const updated = await noteFraisApi.cancel(nf.id)
        setData((prev) => (prev ?? []).map((x) => (x.id === updated.id ? updated : x)))
      } else if (action === 'validate') {
        const updated = await noteFraisApi.validate(nf.id)
        setData((prev) => (prev ?? []).map((x) => (x.id === updated.id ? updated : x)))
      } else if (action === 'reject') {
        const comment = await dialog.prompt(tr('common.rejectionReason'))
        if (comment === null) return false
        const updated = await noteFraisApi.reject(nf.id, comment)
        setData((prev) => (prev ?? []).map((x) => (x.id === updated.id ? updated : x)))
      } else {
        if (!(await dialog.confirm(tr('NoteFraisList.supprimer.cette.note.de.frais'), { variant: 'warning', danger: true, okLabel: tr('common.delete') }))) return false
        await noteFraisApi.delete(nf.id)
        setData((prev) => (prev ?? []).filter((x) => x.id !== nf.id))
      }
      return true
    } catch (err) {
      void dialog.error(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
      return false
    }
  }

  async function handleFormAction(action: 'submit' | 'validate' | 'reject') {
    if (!editing) return
    if (await changeStatus(editing, action)) setModalOpen(false)
  }

  const filledLines = form.lines.filter((l) => !isBlankLine(l))
  const requiredFieldsCompleted =
    attachmentDocumentId != null &&
    filledLines.length > 0 &&
    filledLines.every(
      (l) =>
        l.enseigne.trim() &&
        l.category.trim() &&
        l.label.trim() &&
        l.adresse.trim() &&
        l.date &&
        Number(l.montantHT) > 0 &&
        Number(l.montantTTC) > 0,
    )

  const formIsValid =
    requiredFieldsCompleted && (isConsultant || form.consultantId.trim() !== '')

  const totalYear = (data ?? []).reduce((sum, nf) => sum + nf.totalAmount, 0)
  const pendingCount = (data ?? []).filter((nf) => nf.status === 'SUBMITTED').length

  return (
    <div>
      <PageHeader
        title={tr('NoteFraisList.notes.de.frais')}
        titleId="NoteFraisList.notes.de.frais"
        count={(data ?? []).length}
        subtitle={tr('NoteFraisList.suivi.des.depenses.et.remboursements')}
        subtitleId="NoteFraisList.suivi.des.depenses.et.remboursements"
        actions={
          <div className="flex items-center gap-2">
            <RefreshButton onClick={reload} />
            <Select
              id="NoteFraisList.year.select"
              title={tr('NoteFraisList.annee')}
              className="w-auto"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {[now.getFullYear() - 1, now.getFullYear()].map((y) => (
                <option id={`NoteFraisList.year.option.${y}`} key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
            <IconButton icon="add" label={tr('NoteFraisList.nouvelle.note.de.frais')} variant="new" onClick={openCreate} id="NoteFraisList.nouvelle.note.de.frais" />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="p-5">
          <p id="NoteFraisList.total" className="text-sm font-medium text-gray-500">{tr('NoteFraisList.total')} {year}</p>
          <p id="NoteFraisList.total.value" className="mt-2 text-2xl font-bold text-gray-900">{formatMoney(totalYear)}</p>
        </Card>
        <Card className="p-5">
          <p id="NoteFraisList.en.attente.de.validation" className="text-sm font-medium text-gray-500">{tr('NoteFraisList.en.attente.de.validation')}</p>
          <p id="NoteFraisList.en.attente.de.validation.value" className="mt-2 text-2xl font-bold text-gray-900">{pendingCount}</p>
        </Card>
        <Card className="p-5">
          <p id="NoteFraisList.notes" className="text-sm font-medium text-gray-500">{tr('NoteFraisList.notes')} {year}</p>
          <p id="NoteFraisList.notes.value" className="mt-2 text-2xl font-bold text-gray-900">{(data ?? []).length}</p>
        </Card>
      </div>

      {!isConsultant && totalsByMonth && Object.keys(totalsByMonth).length > 0 && (
        <Card className="mt-6 p-5">
          <h3 className="text-sm font-semibold text-gray-900" id="NoteFraisList.montants.par.mois">{tr('NoteFraisList.montants.par.mois')}</h3>
          <div className="mt-4 flex flex-wrap items-end gap-6">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((_, i) => {
              const value = totalsByMonth[String(i + 1)] ?? 0
              return (
                <div key={i} className="w-10 text-center">
                  <p id={`NoteFraisList.month.${i + 1}.value`} className="text-xs font-medium text-gray-900">
                    {value > 0 ? formatMoney(value) : '—'}
                  </p>
                  <div className="mx-auto mt-1 h-20 w-4 overflow-hidden rounded bg-gray-100">
                    <div
                      className="w-full bg-brand-500"
                      style={{
                        height: value > 0 ? '100%' : '0%',
                      }}
                    />
                  </div>
                  <p id={`NoteFraisList.month.${i + 1}.label`} className="mt-1 text-[10px] text-gray-400">{monthShort(i + 1)}</p>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {!isConsultant && totalsByCategory && Object.keys(totalsByCategory).length > 0 && (
        <Card className="mt-6 p-5">
          <h3 className="text-sm font-semibold text-gray-900" id="NoteFraisList.montants.par.categorie">{tr('NoteFraisList.montants.par.categorie')}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(totalsByCategory).map(([cat, value], index) => (
              <span
                id={`NoteFraisList.category.${index}`}
                key={cat}
                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700"
              >
                {cat} · {formatMoney(value)}
              </span>
            ))}
          </div>
        </Card>
      )}

      {error && <ErrorBlock message={error} />}
      {loading && <LoadingBlock />}

      {!loading && data && data.length > 0 && (
        <div className="mt-6">
          <Table
            paginate
            rowKey={(nf) => nf.id}
            rows={data}
            onRowClick={(nf) => void openView(nf)}
            columns={[
              {
                key: 'consultant',
                label: tr('NoteFraisList.consultant'),
                render: (nf) => <span id={`NoteFraisList.row.${nf.id}.consultant`} className="font-medium text-gray-900">{nf.consultantName}</span>,
              },
              {
                key: 'mission',
                label: tr('NoteFraisList.mission'),
                render: (nf) => (
                  <span id={`NoteFraisList.row.${nf.id}.mission`} className="text-gray-700">
                    {nf.activityName ?? '—'}
                  </span>
                ),
              },
              {
                key: 'period',
                label: tr('common.period'),
                render: (nf) => (
                  <span id={`NoteFraisList.row.${nf.id}.period`} className="text-gray-700">
                    {monthLabel(nf.month)} {nf.year}
                  </span>
                ),
              },
              {
                key: 'lines',
                label: tr('NoteFraisList.lignes'),
                render: (nf) => <span id={`NoteFraisList.row.${nf.id}.lines`}>{nf.lines.length}</span>,
              },
              {
                key: 'total',
                label: tr('NoteFraisList.total'),
                render: (nf) => <span id={`NoteFraisList.row.${nf.id}.total`} className="font-semibold text-gray-900">{formatMoney(nf.totalAmount)}</span>,
              },
              {
                key: 'status',
                label: tr('common.status'),
                render: (nf) => (
                  <Badge id={`NoteFraisList.row.${nf.id}.status`} kind={statusBadge(nf.status)}>
                    {dt(NOTE_FRAIS_STATUS_LABELS[nf.status] ?? nf.status)}
                  </Badge>
                ),
              },
              {
                key: 'comment',
                label: tr('NoteFraisList.rejet'),
                render: (nf) => (nf.status === 'REJECTED' ? <span id={`NoteFraisList.row.${nf.id}.comment`} className="text-xs text-amber-700">{nf.comment}</span> : <span id={`NoteFraisList.row.${nf.id}.comment`}>—</span>),
              },
              {
                key: 'actions',
                label: '',
                render: (nf) => (
                  <div className="flex justify-end gap-1">
                    <IconButton icon="edit" label={tr('common.edit')} onClick={(e) => { e.stopPropagation(); void openEdit(nf, isReadOnlyForUser(nf)) }} id={`common.edit.${nf.id}`} />
                    {canSubmit(nf) && (
                      <IconButton icon="send" label={tr('Unavailability.soumettre')} variant="soft" onClick={(e) => { e.stopPropagation(); void changeStatus(nf, 'submit') }} id={`Unavailability.soumettre.${nf.id}`} />
                    )}
                    {canCancel(nf) && (
                      <IconButton icon="cancel" label={tr('NoteFraisList.annuler.la.soumission')} variant="danger" onClick={(e) => { e.stopPropagation(); void changeStatus(nf, 'cancel') }} id={`NoteFraisList.annuler.la.soumission.${nf.id}`} />
                    )}
                    {canReview(nf) && nf.status === 'SUBMITTED' && (
                      <>
                        <IconButton icon="check" label={tr('Unavailability.valider')} variant="soft" onClick={(e) => { e.stopPropagation(); void changeStatus(nf, 'validate') }} id={`Unavailability.valider.${nf.id}`} />
                        <IconButton icon="reject" label={tr('Unavailability.rejeter')} variant="danger" onClick={(e) => { e.stopPropagation(); void changeStatus(nf, 'reject') }} id={`Unavailability.rejeter.${nf.id}`} />
                      </>
                    )}
                    <IconButton icon="delete" label={tr('NoteFraisList.suppr')} variant="danger" disabled={isReadOnlyForUser(nf)} onClick={(e) => { e.stopPropagation(); void changeStatus(nf, 'delete') }} id={`NoteFraisList.suppr.${nf.id}`} />
                    <IconButton icon="history" label={tr('NoteFraisList.historique')} variant="history" onClick={(e) => { e.stopPropagation(); setHistoryFor(nf) }} id={`NoteFraisList.historique.${nf.id}`} />
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      {!loading && data && data.length === 0 && (
        <Card className="mt-6 flex flex-col items-center justify-center py-14">
          <p id="NoteFraisList.aucune.note.de.frais.pour" className="text-sm font-medium text-gray-900">{tr('NoteFraisList.aucune.note.de.frais.pour')} {year}</p>
          <p id="NoteFraisList.creez.votre.premiere.note.de.frais" className="mt-1 text-sm text-gray-500">{tr('NoteFraisList.creez.votre.premiere.note.de.frais')}</p>
        </Card>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        titleId={editing ? 'NoteFraisList.modifier.la.note.de.modal' : 'NoteFraisList.nouvelle.note.de.frais.modal'}
        title={editing ? tr('NoteFraisList.modifier.la.note.de', { name: editing.consultantName }) : tr('NoteFraisList.nouvelle.note.de.frais')}
        size="xl"
        footer={
          <>
            <IconButton icon="cancel" label={tr('common.cancel')} onClick={() => setModalOpen(false)} id="common.cancel" />
            {editing && isOwner(editing) && (editing.status === 'DRAFT' || editing.status === 'REJECTED') && (
              <IconButton icon="send" label={tr('Unavailability.soumettre')} variant="soft" onClick={() => void handleFormAction('submit')} id="NoteFraisList.form.soumettre" />
            )}
            {editing && canReview(editing) && (editing.status === 'SUBMITTED' || editing.status === 'REJECTED') && (
              <IconButton icon="check" label={tr('Unavailability.valider')} variant="soft" onClick={() => void handleFormAction('validate')} id="NoteFraisList.form.valider" />
            )}
            {editing && canReview(editing) && editing.status === 'SUBMITTED' && (
              <IconButton icon="reject" label={tr('Unavailability.rejeter')} variant="danger" onClick={() => void handleFormAction('reject')} id="NoteFraisList.form.rejeter" />
            )}
            <IconButton id={editing ? 'common.save' : 'common.create'} icon={editing ? 'save' : 'add'} label={editing ? tr('common.save') : tr('common.create')} variant="primary" className="w-auto" onClick={handleSubmit as never} disabled={readOnlyForm || submitting || uploading || !formIsValid} loading={submitting || uploading} />
          </>
        }
      >
        <div id="NoteFraisList.justificatif.apercu.row" className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start">
          <div id="NoteFraisList.justificatif.champs.column" className="space-y-[30px] lg:flex-1">
          <div id="NoteFraisList.justificatif" className="rounded-lg border-2 border-brand-200 bg-brand-50/40 p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p id="NoteFraisList.justificatif.obligatoire.titre" className="text-sm font-semibold text-gray-900">
                {tr('NoteFraisList.justificatif.obligatoire.titre')}
              </p>
              {!requiredFieldsCompleted && (
                <span id="NoteFraisList.justificatif.obligatoire" className="text-xs font-normal text-red-600">
                  {tr('NoteFraisList.justificatif.obligatoire')}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label
                id="NoteFraisList.joindre.une.facture.image.pdf"
                title={tr('NoteFraisList.joindre.une.facture.image.pdf')}
                aria-disabled={readOnlyForm || attachmentDocumentId != null || uploading}
                className={`inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-base font-semibold text-gray-700 transition ${readOnlyForm || attachmentDocumentId != null || uploading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-gray-50'}`}
              >
                +
                <input
                  id="NoteFraisList.joindre.une.facture.image.pdf.file"
                  type="file"
                  accept="image/*,application/pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.rtf"
                  aria-label={tr('NoteFraisList.joindre.une.facture.image.pdf')}
                  disabled={readOnlyForm || attachmentDocumentId != null || uploading}
                  className="hidden"
                  onChange={handleFile}
                />
              </label>
              {attachmentName && (
                <span id="NoteFraisList.attachment.name" className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                  <span id="NoteFraisList.attachment.name.value">{attachmentName}</span>
                  {attachmentDocumentId != null && (
                    <button
                      id="NoteFraisList.justificatif.telecharger"
                      type="button"
                      onClick={() => void documentsApi.download(attachmentDocumentId, attachmentName ?? 'justificatif')}
                      className="text-brand-600 hover:text-brand-700"
                    >
                      {tr('NoteFraisList.justificatif.telecharger')}
                    </button>
                  )}
                  <button
                    id="NoteFraisList.retirer"
                    type="button"
                    disabled={readOnlyForm}
                    onClick={() => void removeAttachment()}
                    className="text-red-600 hover:text-red-800"
                  >
                    {tr('NoteFraisList.retirer')}
                  </button>
                </span>
              )}
            </div>
            {(uploading || ocrPending) && (
              <p id="NoteFraisList.lecture.de.la.facture.en.cours.ocr" className="mt-2 text-sm text-brand-700">
                {uploading
                  ? tr('NoteFraisList.justificatif.televersement')
                  : tr('NoteFraisList.lecture.de.la.facture.en.cours.ocr')}
              </p>
            )}

          </div>
          <div id="NoteFraisList.justificatif.champs" className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-3 sm:grid-cols-2">
            {!isConsultant && (
              <Field label={tr('NoteFraisList.consultant')} id="NoteFraisList.consultant">
                <Select
                  id="NoteFraisList.consultant.select"
                  title={tr('NoteFraisList.consultant')}
                  disabled={readOnlyForm}
                  value={form.consultantId}
                  onChange={(e) => setForm({ ...form, consultantId: e.target.value })}
                >
                  <option id="NoteFraisList.selectionner" value="">{tr('NoteFraisList.selectionner')}</option>
                  {collaboratorOptions.map((c) => (
                    <option id={`NoteFraisList.consultant.option.${c.id}`} key={c.id} value={c.id}>
                      {c.fullName}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label={tr('NoteFraisList.mission')} id="NoteFraisList.mission">
              <Select
                id="NoteFraisList.activity.select"
                title={tr('NoteFraisList.mission')}
                disabled={readOnlyForm}
                value={form.activityId}
                onChange={(e) => setForm({ ...form, activityId: e.target.value })}
              >
                <option id="NoteFraisList.aucune.mission" value="">
                  {tr('NoteFraisList.aucune.mission')}
                </option>
                {(activities ?? []).map((activity) => (
                  <option id={`NoteFraisList.activity.option.${activity.id}`} key={activity.id} value={activity.id}>
                    {activity.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={tr('NoteFraisList.mois')} id="NoteFraisList.mois">
              <Select
                id="NoteFraisList.mois.select"
                title={tr('NoteFraisList.mois')}
                disabled={readOnlyForm}
                value={form.month}
                onChange={(e) => setForm({ ...form, month: Number(e.target.value) })}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option id={`NoteFraisList.mois.option.${m}`} key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={tr('NoteFraisList.annee')} id="NoteFraisList.annee">
              <Select
                id="NoteFraisList.annee.select"
                title={tr('NoteFraisList.annee')}
                disabled={readOnlyForm}
                value={form.year}
                onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
              >
                {[now.getFullYear() - 1, now.getFullYear()].map((y) => (
                  <option id={`NoteFraisList.annee.option.${y}`} key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          </div>
          {attachmentUrl && attachmentName && (
            <div id="NoteFraisList.document.joint.section" className="lg:flex-1">
              <p id="NoteFraisList.document.joint" className="mb-2 text-sm font-semibold text-gray-900">
                {tr('NoteFraisList.document.joint')}
              </p>
              <DocumentPreview
                id="NoteFraisList.apercu"
                url={attachmentUrl}
                name={attachmentName}
              />
            </div>
          )}
        </div>
        <form onSubmit={handleSubmit}>
          <fieldset disabled={readOnlyForm} className="space-y-4">
          {formError && (
            <div id="NoteFraisList.form.error" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {formError}
            </div>
          )}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p id="NoteFraisList.lignes.de.depenses" className="text-sm font-medium text-gray-700">{tr('NoteFraisList.lignes.de.depenses')}</p>
                {!requiredFieldsCompleted && (
                  <p id="NoteFraisList.champs.obligatoires" className="text-xs text-red-600">{tr('NoteFraisList.champs.obligatoires')}</p>
                )}
              </div>
              <span id="NoteFraisList.total.2" className="text-sm text-gray-500">
                {tr('NoteFraisList.total.2')} {formatMoney(form.lines.reduce((s, l) => s + lineAmount(l), 0))}
              </span>
            </div>
            <div className="space-y-3">
              {form.lines.map((line, i) => (
                <div key={i} className="flex items-stretch gap-2">
                  <div id={`NoteFraisList.line.${i}.frame`} className="grid flex-1 grid-cols-1 gap-2 rounded-lg border border-gray-200 p-3 sm:grid-cols-12 sm:items-center">
                  <Field className="sm:col-span-2" label={tr('NoteFraisList.nom.enseigne')} id={`NoteFraisList.line.${i}.enseigne.label`}>
                    <Input
                      id={`NoteFraisList.line.${i}.enseigne`}
                      placeholder={tr('NoteFraisList.nom.enseigne')}
                      title={tr('NoteFraisList.nom.enseigne')}
                      required
                      aria-required="true"
                      value={line.enseigne}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          lines: form.lines.map((l, j) => (j === i ? { ...l, enseigne: e.target.value } : l)),
                        })
                      }
                    />
                  </Field>
                  <Field className="sm:col-span-2 min-w-0" label={tr('NoteFraisList.date')} id={`NoteFraisList.line.${i}.date.label`}>
                    <Input
                      id={`NoteFraisList.line.${i}.date`}
                      type="date"
                      title={tr('NoteFraisList.date')}
                      required
                      aria-required="true"
                      className="w-full"
                      value={line.date}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          lines: form.lines.map((l, j) => (j === i ? { ...l, date: e.target.value } : l)),
                        })
                      }
                    />
                  </Field>
                  <Field className="sm:col-span-2" label={tr('NoteFraisList.categorie')} id={`NoteFraisList.line.${i}.category.label`}>
                    <Select
                      id={`NoteFraisList.line.${i}.category`}
                      title={tr('NoteFraisList.categorie')}
                      required
                      aria-required="true"
                      value={line.category}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          lines: form.lines.map((l, j) => (j === i ? { ...l, category: e.target.value } : l)),
                        })
                      }
                    >
                      {NOTE_FRAIS_CATEGORIES.map((cat, categoryIndex) => (
                        <option id={`NoteFraisList.line.${i}.category.option.${categoryIndex}`} key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field className="sm:col-span-2" label={tr('NoteFraisList.libelle.action')} id={`NoteFraisList.line.${i}.label.label`}>
                    <Input
                      id={`NoteFraisList.line.${i}.label`}
                      placeholder={tr('NoteFraisList.libelle.action')}
                      title={tr('NoteFraisList.libelle.action')}
                      required
                      aria-required="true"
                      value={line.label}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          lines: form.lines.map((l, j) => (j === i ? { ...l, label: e.target.value } : l)),
                        })
                      }
                    />
                  </Field>
                  <Field className="sm:col-span-4" label={tr('NoteFraisList.adresse')} id={`NoteFraisList.line.${i}.adresse.label`}>
                    <Input
                      id={`NoteFraisList.line.${i}.adresse`}
                      placeholder={tr('NoteFraisList.adresse')}
                      title={tr('NoteFraisList.adresse')}
                      required
                      aria-required="true"
                      value={line.adresse}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          lines: form.lines.map((l, j) => (j === i ? { ...l, adresse: e.target.value } : l)),
                        })
                      }
                    />
                  </Field>
                  <Field className="sm:col-span-2" label={tr('NoteFraisList.montant.ht')} id={`NoteFraisList.line.${i}.montantHT.label`}>
                    <Input
                      id={`NoteFraisList.line.${i}.montantHT`}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={tr('NoteFraisList.montant.ht')}
                      title={tr('NoteFraisList.montant.ht')}
                      required
                      aria-required="true"
                      value={line.montantHT}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          lines: form.lines.map((l, j) => (j === i ? { ...l, montantHT: e.target.value } : l)),
                        })
                      }
                    />
                  </Field>
                  <Field className="sm:col-span-2" label={tr('NoteFraisList.montant.ttc')} id={`NoteFraisList.line.${i}.montantTTC.label`}>
                    <Input
                      id={`NoteFraisList.line.${i}.montantTTC`}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={tr('NoteFraisList.montant.ttc')}
                      title={tr('NoteFraisList.montant.ttc')}
                      required
                      aria-required="true"
                      value={line.montantTTC}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          lines: form.lines.map((l, j) => (j === i ? { ...l, montantTTC: e.target.value } : l)),
                        })
                      }
                    />
                  </Field>
                  <label id={`NoteFraisList.line.${i}.remboursee.label`} className="flex items-center gap-2 pt-5 text-sm text-gray-600 sm:col-span-2">
                    <input
                      id={`NoteFraisList.line.${i}.remboursee`}
                      type="checkbox"
                      title={tr('NoteFraisList.remboursee')}
                      checked={line.reimbursed}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          lines: form.lines.map((l, j) =>
                            j === i ? { ...l, reimbursed: e.target.checked } : l,
                          ),
                        })
                      }
                      className="h-4 w-4 rounded border-gray-300 text-brand-600"
                    />
                    {tr('NoteFraisList.remboursee')}
                  </label>
                  </div>
                  <div className="flex items-center">
                    <IconButton
                      id={`NoteFraisList.line.${i}.supprimer`}
                      type="button"
                      icon="delete"
                      label={tr('NoteFraisList.supprimer')}
                      variant="danger"
                      disabled={readOnlyForm}
                      onClick={() => void removeLine(i)}
                    />
                  </div>
                </div>
              ))}
            </div>
            <button
              id="NoteFraisList.ajouter.une.ligne"
              type="button"
              onClick={() => setForm({ ...form, lines: [...form.lines, newLine()] })}
              className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              {tr('NoteFraisList.ajouter.une.ligne')}
            </button>
          </div>

          <Field label={tr('NoteFraisList.infos.facture.texte.de.la.facture')} id="NoteFraisList.infos.facture.texte.de.la.facture">
            <Textarea
              id="NoteFraisList.infos.facture.texte.de.la.facture.textarea"
              title={tr('NoteFraisList.infos.facture.texte.de.la.facture')}
              rows={4}
              placeholder={tr('NoteFraisList.collez.ou.saisissez.ici.le.contenu.de.la.facture.du.ticket')}
              value={form.infosFacture}
              onChange={(e) => setForm({ ...form, infosFacture: e.target.value })}
            />
          </Field>
          </fieldset>
        </form>
      </Modal>
      {historyFor && (
        <NoteFraisHistoryModal
          noteFrais={historyFor}
          onClose={() => setHistoryFor(null)}
        />
      )}
    </div>
  )
}

function NoteFraisHistoryModal({
  noteFrais,
  onClose,
}: {
  noteFrais: NoteFraisDto
  onClose: () => void
}) {
  const { user } = useAuth()
  const dt = useDynamicTranslate()
  const history = useAsync(() => noteFraisApi.history(noteFrais.id), [noteFrais.id])
  const historyPage = usePagination(history.data ?? [], user?.pageSize ?? 5)

  return (
    <Modal
      open
      onClose={onClose}
      titleId="NoteFraisList.historique.de.la.note.de.frais"
      title={`${tr('NoteFraisList.historique.de.la.note.de.frais')} (${historyPage.total})`}
      size="xl"
      footer={
        <IconButton icon="close" label={tr('NoteFraisList.fermer')} onClick={onClose} id="NoteFraisList.fermer" />
      }
    >
      <p id="NoteFraisList.historique.subtitle" className="mb-3 text-xs text-gray-500">
        {noteFrais.consultantName} — {monthLabel(noteFrais.month)} {noteFrais.year}
      </p>
      {history.loading && <LoadingBlock />}
      {history.error && <ErrorBlock message={history.error} />}
      {!history.loading && !history.error && (history.data?.length ?? 0) === 0 && (
        <p id="NoteFraisList.aucune.modification.enregistree" className="py-6 text-center text-sm text-gray-500">
          {tr('NoteFraisList.aucune.modification.enregistree')}
        </p>
      )}
      {!history.loading && (history.data?.length ?? 0) > 0 && (
        <div className="max-h-96 overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead style={{ backgroundColor: 'var(--table-header)' }}>
              <tr>
                <th id="NoteFraisList.history.th.index" className="w-10 px-3 py-2 text-right text-xs font-bold uppercase text-gray-400">#</th>
                <th id="NoteFraisList.history.date" className="px-3 py-2 text-left text-xs font-bold uppercase text-gray-500">{tr('NoteFraisList.date')}</th>
                <th id="NoteFraisList.history.modifie.par" className="px-3 py-2 text-left text-xs font-bold uppercase text-gray-500">{tr('NoteFraisList.modifie.par')}</th>
                <th id="NoteFraisList.history.commentaire" className="px-3 py-2 text-left text-xs font-bold uppercase text-gray-500">{tr('NoteFraisList.commentaire')}</th>
                <th id="NoteFraisList.history.statut.avant" className="px-3 py-2 text-center text-xs font-bold uppercase text-gray-500">{tr('NoteFraisList.avant')}</th>
                <th id="NoteFraisList.history.statut.apres" className="px-3 py-2 text-center text-xs font-bold uppercase text-gray-500">{tr('NoteFraisList.apres')}</th>
                <th id="NoteFraisList.history.montant.avant" className="px-3 py-2 text-right text-xs font-bold uppercase text-gray-500">{tr('NoteFraisList.montant.avant')}</th>
                <th id="NoteFraisList.history.montant.apres" className="px-3 py-2 text-right text-xs font-bold uppercase text-gray-500">{tr('NoteFraisList.montant.apres')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {historyPage.pageItems.map((h: NoteFraisHistoryDto, i) => (
                <tr id={`NoteFraisList.history.row.${h.id}`} key={h.id}>
                  <td id={`NoteFraisList.history.row.${h.id}.index`} className="w-10 whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums text-gray-400">
                    {historyPage.offset + i + 1}
                  </td>
                  <td id={`NoteFraisList.history.row.${h.id}.date`} className="whitespace-nowrap px-3 py-2 text-sm text-gray-600">
                    {formatDateTime(h.dateModif)}
                  </td>
                  <td id={`NoteFraisList.history.row.${h.id}.modifier`} className="px-3 py-2 text-sm text-gray-900">{h.modifierName ?? '—'}</td>
                  <td id={`NoteFraisList.history.row.${h.id}.comment`} className="px-3 py-2 text-sm text-gray-600">{h.comment ? dt(h.comment) : '—'}</td>
                  <td id={`NoteFraisList.history.row.${h.id}.before`} className="px-3 py-2 text-center text-sm text-gray-600">
                    {h.statusBefore ? dt(NOTE_FRAIS_STATUS_LABELS[h.statusBefore]) : '—'}
                  </td>
                  <td id={`NoteFraisList.history.row.${h.id}.after`} className="px-3 py-2 text-center text-sm text-gray-600">
                    {dt(NOTE_FRAIS_STATUS_LABELS[h.statusAfter])}
                  </td>
                  <td id={`NoteFraisList.history.row.${h.id}.totalBefore`} className="px-3 py-2 text-right text-sm text-gray-600">
                    {h.totalBefore != null ? formatMoney(h.totalBefore) : '—'}
                  </td>
                  <td id={`NoteFraisList.history.row.${h.id}.totalAfter`} className="px-3 py-2 text-right text-sm text-gray-600">
                    {h.totalAfter != null ? formatMoney(h.totalAfter) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!history.loading && (history.data?.length ?? 0) > 0 && (
        <Pagination
          page={historyPage.page}
          totalPages={historyPage.totalPages}
          total={historyPage.total}
          onChange={historyPage.setPage}
        />
      )}
    </Modal>
  )
}
