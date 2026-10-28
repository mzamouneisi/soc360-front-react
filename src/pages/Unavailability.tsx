import { tr } from '../i18n/translate'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import { unavailabilityApi } from '../api/unavailability'
import { unavailabilityTypesApi } from '../api/unavailabilityTypes'
import { documentsApi } from '../api/documents'
import { consultantsApi } from '../api/consultants'
import type {
  ConsultantSummary,
  CountType,
  DayPart,
  UnavailabilityDto,
  UnavailabilityHistoryDto,
  UnavailabilityType,
} from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { useSoc } from '../soc/SocContext'
import { usePagination } from '../lib/usePagination'
import { Badge, ErrorBlock, LoadingBlock, PageHeader, Pagination } from '../components/data'
import { dialog } from '../components/dialog'
import { Alert, Card, Field, IconButton, InlineButton, Input, Select, Textarea } from '../components/ui'
import { MonthPicker } from '../components/MonthPicker'
import {
  formatDate,
  formatDateTime,
  statusBadge,
  UNAVAILABILITY_STATUS_LABELS,
  unavailabilityTypeLabel,
} from '../lib/format'
import { useAsync } from '../lib/useAsync'
import { useDynamicTranslate } from '../lib/useDynamicTranslate'
import { UnavailabilityCalendar } from './UnavailabilityCalendar'
import { DocumentAttachment, type AttachedDocument } from '../components/DocumentAttachment'

function isCountedDate(date: string, countType: CountType): boolean {
  const dow = new Date(date + 'T00:00:00Z').getUTCDay()
  if (countType === 'OUVRE') return dow !== 0 && dow !== 6
  if (countType === 'OUVRABLE') return dow !== 0
  return true
}

function durationFor(
  start: string,
  end: string,
  firstDay: DayPart,
  lastDay: DayPart,
  countType: CountType,
): number {
  if (!start || !end || start > end) return 0
  let days = 0
  const cursor = new Date(start + 'T00:00:00Z')
  const last = new Date(end + 'T00:00:00Z')
  while (cursor <= last) {
    const value = cursor.toISOString().slice(0, 10)
    if (isCountedDate(value, countType)) days += 1
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  if (days === 0) return 0
  if (start === end) return firstDay === 'ALL' ? 1 : 0.5
  if (firstDay === 'PM' && isCountedDate(start, countType)) days -= 0.5
  if (lastDay === 'AM' && isCountedDate(end, countType)) days -= 0.5
  return days
}

function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`
}

function maxIso(...values: (string | null | undefined)[]): string | undefined {
  return values
    .filter((value): value is string => value != null && value !== '')
    .sort()
    .at(-1)
}

export function Unavailability() {
  const { user } = useAuth()
  const dt = useDynamicTranslate()
  const { selectedSocId } = useSoc()
  const [searchParams] = useSearchParams()
  const isConsultant = user?.role === 'CONSULTANT'
  const isAdmin = user?.role === 'ADMIN'

  const [consultantFilter, setConsultantFilter] = useState<number | null>(null)
  const [monthFilter, setMonthFilter] = useState('')
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [formReadOnly, setFormReadOnly] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formConsultantId, setFormConsultantId] = useState<number | null>(null)
  const [formType, setFormType] = useState<UnavailabilityType>('')
  const [formStart, setFormStart] = useState('')
  const [formEnd, setFormEnd] = useState('')
  const [formComment, setFormComment] = useState('')
  const [formFirstDay, setFormFirstDay] = useState<DayPart>('ALL')
  const [formLastDay, setFormLastDay] = useState<DayPart>('ALL')
  const [formDocument, setFormDocument] = useState<AttachedDocument | null>(null)
  const [removedDocumentIds, setRemovedDocumentIds] = useState<number[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [historyFor, setHistoryFor] = useState<UnavailabilityDto | null>(null)

  const list = useAsync(
    () =>
      isConsultant
        ? unavailabilityApi.list()
        : unavailabilityApi.list({
            socId: isAdmin ? undefined : (user?.socId ?? undefined),
            consultantId: consultantFilter ?? undefined,
          }),
    [isConsultant, isAdmin, user?.socId, consultantFilter],
  )

  const consultants = useAsync(
    () =>
      isConsultant
        ? Promise.resolve([] as ConsultantSummary[])
        : consultantsApi.filterList(),
    [isConsultant],
  )

  // La liste des types provient des paramètres de la société (« Types d'indisponibilités »).
  const typesSocId = selectedSocId ?? user?.socId ?? null
  const types = useAsync(
    () => unavailabilityTypesApi.active(typesSocId),
    [typesSocId],
  )
  const typeOptions = (types.data ?? [])
    .map((t) => t.name)
    .filter((label) => label != null && label.trim() !== '')
  const formCountType: CountType =
    (types.data ?? []).find((t) => t.name === formType)?.countType ?? 'CALENDAIRE'

  useEffect(() => {
    setPage(0)
    setSelectedId(null)
  }, [search, consultantFilter, monthFilter])

  useEffect(() => {
    const open = searchParams.get('open')
    if (open) setSelectedId(Number(open))
  }, [searchParams])

  const data = list.data ?? []
  const selected = useMemo(() => data.find((u) => u.id === selectedId) ?? null, [list.data, selectedId])

  // Aperçu calendrier pendant la saisie : il met en évidence l'indisponibilité en cours
  // (même non enregistrée) avec ses demi-journées, et affiche les autres indispos, congés et
  // activités du consultant.
  const previewUnavailability = useMemo<UnavailabilityDto | null>(() => {
    if (!showForm || !formStart || !formEnd || formStart > formEnd) return null
    const consultantId = isConsultant
      ? (user?.consultantId ?? user?.id ?? null)
      : formConsultantId
    if (!consultantId) return null
    const existing = editingId != null ? data.find((u) => u.id === editingId) : null
    const durationDays = durationFor(
      formStart, formEnd, formFirstDay, formLastDay, formCountType,
    )
    const halfDays: UnavailabilityDto['halfDays'] = []
    if (formStart === formEnd) {
      if ((formFirstDay === 'AM' || formFirstDay === 'PM') &&
          isCountedDate(formStart, formCountType)) {
        halfDays.push({ date: formStart, halfDay: formFirstDay })
      }
    } else {
      if (formFirstDay === 'PM' && isCountedDate(formStart, formCountType)) {
        halfDays.push({ date: formStart, halfDay: 'PM' })
      }
      if (formLastDay === 'AM' && isCountedDate(formEnd, formCountType)) {
        halfDays.push({ date: formEnd, halfDay: 'AM' })
      }
    }
    return {
      id: editingId ?? -1,
      consultantId,
      consultantName:
        existing?.consultantName ??
        (isConsultant
          ? `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()
          : (consultants.data?.find((c) => c.id === consultantId)?.fullName ?? '')),
      socId: existing?.socId ?? user?.socId ?? 0,
      type: formType,
      startDate: formStart,
      endDate: formEnd,
      status: existing?.status ?? 'DRAFT',
      comment: formComment.trim() || null,
      rejectedReason: existing?.rejectedReason ?? null,
      submittedAt: existing?.submittedAt ?? null,
      validatedAt: existing?.validatedAt ?? null,
      durationDays,
      firstDay: formFirstDay,
      lastDay: formLastDay,
      countType: formCountType,
      halfDays,
    }
  }, [
    showForm, formStart, formEnd, isConsultant, user, formConsultantId, editingId,
    data, consultants.data, formType, formComment, formFirstDay, formLastDay,
    formCountType,
  ])

  if (!user) return null

  const monthBounds = monthFilter
    ? (() => {
        const [y, m] = monthFilter.split('-').map(Number)
        const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
        return {
          start: `${monthFilter}-01`,
          end: `${monthFilter}-${String(lastDay).padStart(2, '0')}`,
        }
      })()
    : null

  const filtered = data
    .filter((u) => {
      if (monthBounds && (u.endDate < monthBounds.start || u.startDate > monthBounds.end)) {
        return false
      }
      if (!search.trim()) return true
      const q = search.trim().toLowerCase()
      const type = unavailabilityTypeLabel(u.type).toLowerCase()
      const status = (UNAVAILABILITY_STATUS_LABELS[u.status] ?? u.status).toLowerCase()
      const consultant = (u.consultantName ?? '').toLowerCase()
      const comment = (u.comment ?? '').toLowerCase()
      return (
        type.includes(q) ||
        status.includes(q) ||
        consultant.includes(q) ||
        comment.includes(q) ||
        u.startDate.includes(q) ||
        u.endDate.includes(q)
      )
    })
    // Tri par date de début décroissante, quelle que soit la source (le backend le fait déjà,
    // mais on garantit l'ordre de façon déterministe à l'identique, id décroissant en secours).
    .sort((a, b) => b.startDate.localeCompare(a.startDate) || b.id - a.id)

  const pageSize = user?.pageSize ?? 5
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages - 1)
  const pageItems = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize)

  // Le collaborateur concerné (quel que soit son rôle) ne peut plus modifier une indisponibilité
  // validée : il peut seulement l'annuler.
  const ownerId = user.consultantId ?? user.id ?? null
  const isOwner = (u: UnavailabilityDto) => ownerId != null && u.consultantId === ownerId
  const canEdit = (u: UnavailabilityDto) =>
    isOwner(u)
      ? u.status === 'DRAFT' || u.status === 'REJECTED' || u.status === 'CANCELLED'
      : !isConsultant
  const canSubmit = (u: UnavailabilityDto) =>
    u.status === 'DRAFT' || u.status === 'REJECTED' || u.status === 'CANCELLED'
  const canDelete = (u: UnavailabilityDto) => u.status === 'DRAFT' || u.status === 'REJECTED'
  const canCancel = (u: UnavailabilityDto) =>
    isOwner(u) && (u.status === 'SUBMITTED' || u.status === 'VALIDATED')
  // Un manager ne peut pas valider/rejeter ses propres indisponibilités : c'est son manager
  // (ou un admin/responsable société) qui doit le faire.
  const canReview = (u: UnavailabilityDto) =>
    !isConsultant && !isOwner(u) && u.status === 'SUBMITTED'
  // Le manager peut invalider une indisponibilité déjà validée (elle repasse en « Rejetée »),
  // mais le collaborateur ne peut pas invalider sa propre indisponibilité.
  const canInvalidate = (u: UnavailabilityDto) =>
    !isConsultant && !isOwner(u) && u.status === 'VALIDATED'

  // Date d'embauche du consultant concerné par le formulaire (soi-même ou le collaborateur choisi).
  const formHireDate = isConsultant
    ? (user?.hireDate ?? null)
    : (consultants.data?.find((c) => c.id === formConsultantId)?.hireDate ?? null)

  const today = todayIso()
  const formIsValid =
    (isConsultant || formConsultantId != null) &&
    formType.trim() !== '' &&
    formStart !== '' &&
    formEnd !== '' &&
    formEnd >= formStart &&
    (editingId != null || formStart >= today) &&
    (!formHireDate || formStart >= formHireDate)

  function handleRowClick(u: UnavailabilityDto) {
    setSelectedId(u.id)
    if (canEdit(u)) {
      openEdit(u)
    } else if (u.status === 'VALIDATED' && isOwner(u)) {
      // Le propriétaire consulte sa propre indisponibilité validée en lecture seule.
      openEdit(u, true)
    } else {
      setShowForm(false)
    }
  }

  function openCreate() {
    if (isConsultant && !user?.hireDate) {
      void dialog.error(tr('hireDate.required'))
      return
    }
    const today = todayIso()
    setEditingId(null)
    setFormReadOnly(false)
    setFormConsultantId(user?.consultantId ?? user?.id ?? null)
    setFormType(typeOptions[0] ?? '')
    setFormStart(today)
    setFormEnd(today)
    setFormComment('')
    setFormFirstDay('ALL')
    setFormLastDay('ALL')
    setFormDocument(null)
    setRemovedDocumentIds([])
    setFormError(null)
    setShowForm(true)
  }

  function openEdit(u: UnavailabilityDto, readOnly = false) {
    setSelectedId(u.id)
    setEditingId(u.id)
    setFormReadOnly(readOnly)
    setFormConsultantId(u.consultantId)
    setFormType(u.type)
    setFormStart(u.startDate)
    setFormEnd(u.endDate)
    setFormComment(u.comment ?? '')
    setFormFirstDay(u.firstDay ?? 'ALL')
    setFormLastDay(u.lastDay ?? 'ALL')
    setFormDocument(u.documentId != null && u.documentName
      ? { id: u.documentId, name: u.documentName, comment: u.documentComment ?? null }
      : null)
    setRemovedDocumentIds([])
    setFormError(null)
    setShowForm(true)
  }

  function changeDates(nextStart: string, nextEnd: string) {
    setFormStart(nextStart)
    setFormEnd(nextEnd)
    if (!nextStart || !nextEnd) return
    if (nextStart === nextEnd) {
      const value = formFirstDay === 'ALL' ? 'ALL' : formFirstDay
      setFormFirstDay(value)
      setFormLastDay(value)
    } else {
      if (formFirstDay === 'AM') setFormFirstDay('ALL')
      if (formLastDay === 'PM') setFormLastDay('ALL')
    }
  }

  async function closeForm() {
    if (formDocument?.temporary) {
      try {
        await documentsApi.delete(formDocument.id)
      } catch {
        // Document déjà supprimé : on ferme quand même le formulaire.
      }
    }
    setFormDocument(null)
    setRemovedDocumentIds([])
    setShowForm(false)
    setFormReadOnly(false)
    setFormError(null)
  }

  async function handleSave() {
    if (formReadOnly) return
    if (!formStart || !formEnd) {
      setFormError('Les dates de début et de fin sont obligatoires.')
      return
    }
    if (formStart > formEnd) {
      setFormError('La date de fin doit être postérieure ou égale à la date de début.')
      return
    }
    if (editingId == null && formStart < today) {
      setFormError(tr('Unavailability.date.passee'))
      return
    }
    if (formHireDate && formStart < formHireDate) {
      setFormError(tr('Unavailability.date.embauche'))
      return
    }
    if (!isConsultant && editingId == null && formConsultantId == null) {
      setFormError('Sélectionnez un consultant.')
      return
    }
    const selectedType = (types.data ?? []).find((t) => t.name === formType)
    if (selectedType?.documentRequired && !formDocument) {
      setFormError(tr('document.required'))
      return
    }
    const countType = selectedType?.countType ?? 'CALENDAIRE'
    if (!isCountedDate(formStart, countType)) {
      setFormError(tr('Unavailability.debut.jour.non.compte'))
      return
    }
    if (!isCountedDate(formEnd, countType)) {
      setFormError(tr('Unavailability.fin.jour.non.compte'))
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const request = {
        consultantId: isConsultant ? null : formConsultantId,
        socId: user?.socId ?? null,
        type: formType,
        startDate: formStart,
        endDate: formEnd,
        comment: formComment.trim() || null,
        firstDay: formFirstDay,
        lastDay: formLastDay,
        documentId: formDocument?.id ?? null,
        documentComment: formDocument?.comment ?? null,
      }
      if (editingId != null) {
        await unavailabilityApi.update(editingId, request)
      } else {
        await unavailabilityApi.create(request)
      }
      for (const documentId of removedDocumentIds) {
        try {
          await documentsApi.delete(documentId)
        } catch {
          // Document déjà supprimé : l'indisponibilité est bien détachée.
        }
      }
      setRemovedDocumentIds([])
      setFormDocument(null)
      setShowForm(false)
      list.reload()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    } finally {
      setSaving(false)
    }
  }

  async function runAction(
    u: UnavailabilityDto,
    fn: () => Promise<unknown>,
    confirmMsg?: string,
    confirmOptions?: { danger?: boolean; okLabel?: string },
  ) {
    if (confirmMsg && !(await dialog.confirm(confirmMsg, { variant: 'warning', ...confirmOptions }))) return
    try {
      await fn()
      list.reload()
      if (selectedId === u.id) setSelectedId(u.id)
    } catch (err) {
      void dialog.error(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    }
  }

  function handleSubmit(u: UnavailabilityDto) {
    return runAction(u, () => unavailabilityApi.submit(u.id))
  }

  function handleCancel(u: UnavailabilityDto) {
    const validated = u.status === 'VALIDATED'
    return runAction(
      u,
      () => unavailabilityApi.cancel(u.id),
      validated
        ? tr('Unavailability.annuler.validated.confirm')
        : tr('Unavailability.retour.au.brouillon'),
      validated
        ? { danger: true, okLabel: tr('Unavailability.annuler.l.indisponibilite') }
        : undefined,
    )
  }

  async function handleValidate(u: UnavailabilityDto) {
    const comment = await dialog.prompt(tr('Unavailability.commentaire.validation'))
    if (comment === null) return
    return runAction(u, () => unavailabilityApi.validate(u.id, comment))
  }

  async function handleReject(u: UnavailabilityDto) {
    const comment = await dialog.prompt(tr('Unavailability.motif.du.rejet.consultant'))
    if (comment === null) return
    return runAction(u, () => unavailabilityApi.reject(u.id, comment))
  }

  async function handleInvalidate(u: UnavailabilityDto) {
    const comment = await dialog.prompt(tr('Unavailability.motif.de.l.invalidation'))
    if (comment === null) return
    return runAction(u, () => unavailabilityApi.invalidate(u.id, comment))
  }

  function handleDelete(u: UnavailabilityDto) {
    return runAction(
      u,
      () => unavailabilityApi.delete(u.id),
      tr('Unavailability.supprimer.cette.indisponibilite', {
        type: unavailabilityTypeLabel(u.type),
      }),
      { danger: true, okLabel: tr('common.delete') },
    )
  }

  return (
    <div>
      <PageHeader
        title={tr('Unavailability.indisponibilites')}
        titleId="Unavailability.indisponibilites"
        count={filtered.length}
        subtitle={tr('Unavailability.intervalles.d.indisponibilite.des.consultants.conges.maladie')}
        subtitleId="Unavailability.intervalles.d.indisponibilite.des.consultants.conges.maladie"
        actions={
          <IconButton icon="add" label={tr('Unavailability.nouvelle.indisponibilite')} variant="new"
            onClick={openCreate}
            title={isConsultant && !user?.hireDate ? tr('hireDate.required') : undefined}
            id="Unavailability.nouvelle.indisponibilite" />
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {!isConsultant && (
          <div className="max-w-xs flex-1">
            <Select
              id="Unavailability.consultants.filter"
              value={consultantFilter ?? ''}
              onChange={(e) => setConsultantFilter(e.target.value ? Number(e.target.value) : null)}
            >
              <option id="Unavailability.tous.les.consultants" value="">{tr('Unavailability.tous.les.consultants')}</option>
              {consultants.data?.map((c) => (
                <option id={`Unavailability.consultant.option.${c.id}`} key={c.id} value={c.id}>
                  {c.fullName}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className="max-w-[12rem] flex-1">
          <MonthPicker
            id="Unavailability.filtrer.par.mois"
            value={monthFilter}
            onChange={(value) => setMonthFilter(value)}
            placeholder={tr('common.allMonths')}
            title={tr('Unavailability.filtrer.par.mois')}
          />
        </div>
        <div className="min-w-[16rem] flex-1">
          <Input
            id="Unavailability.filtrer.par.type.statut.consultant.ou.dates"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr('Unavailability.filtrer.par.type.statut.consultant.ou.dates')}
          />
        </div>
      </div>

      {list.error && <ErrorBlock message={list.error} />}
      {list.loading && <LoadingBlock />}

      {!list.loading && filtered.length === 0 && (
        <Card className="flex flex-col items-center justify-center py-14">
          <p id={search.trim() ? 'Unavailability.aucune.indisponibilite.filtre' : 'Unavailability.aucune.indisponibilite'} className="text-sm font-medium text-gray-900">
            {search.trim() ? tr('Unavailability.aucune.indisponibilite.filtre') : tr('Unavailability.aucune.indisponibilite')}
          </p>
          <p id={search.trim() ? 'Unavailability.modifiez.votre.recherche' : 'Unavailability.cliquez.sur.nouvelle.indisponibilite'} className="mt-1 text-sm text-gray-500">
            {search.trim()
              ? tr('Unavailability.modifiez.votre.recherche')
              : tr('Unavailability.cliquez.sur.nouvelle.indisponibilite')}
          </p>
        </Card>
      )}

      {!list.loading && filtered.length > 0 && (
        <>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead style={{ backgroundColor: 'var(--table-header)' }}>
                  <tr>
                    <th id="Unavailability.th.index" className="w-12 px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-gray-400">
                      #
                    </th>
                    <th id="Unavailability.consultant.th" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      {tr('Unavailability.consultant')}
                    </th>
                    <th id="Unavailability.type.th" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      {tr('Unavailability.type')}
                    </th>
                    <th id="Unavailability.du.th" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      {tr('Unavailability.du')}
                    </th>
                    <th id="Unavailability.au.th" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      {tr('Unavailability.au')}
                    </th>
                    <th id="Unavailability.duree.th" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      {tr('Unavailability.duree')}
                    </th>
                    <th id="Unavailability.statut.th" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      {tr('Unavailability.statut')}
                    </th>
                    <th id="Unavailability.commentaire.th" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      {tr('Unavailability.commentaire')}
                    </th>
                    <th id="Unavailability.actions.th" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      {tr('Unavailability.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {pageItems.map((u, i) => (
                    <tr
                      id={`Unavailability.row.${u.id}`}
                      key={u.id}
                      onClick={() => handleRowClick(u)}
                      className={`align-top cursor-pointer ${
                        u.id === selectedId
                          ? '[&>td]:border-y-2 [&>td]:border-blue-400 [&>td:first-child]:border-l-2 [&>td:last-child]:border-r-2 [&>td]:bg-blue-50'
                          : 'even:bg-gray-50'
                      }`}
                    >
                      <td id={`Unavailability.row.${u.id}.index`} className="w-12 whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-gray-400">
                        {safePage * pageSize + i + 1}
                      </td>
                      <td id={`Unavailability.row.${u.id}.consultant`} className="px-4 py-3 text-sm text-gray-900">{u.consultantName}</td>
                      <td id={`Unavailability.row.${u.id}.type`} className="px-4 py-3 text-sm text-gray-900">
                        {unavailabilityTypeLabel(u.type)}
                      </td>
                      <td id={`Unavailability.row.${u.id}.start`} className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {formatDate(u.startDate)}
                      </td>
                      <td id={`Unavailability.row.${u.id}.end`} className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {formatDate(u.endDate)}
                      </td>
                      <td id={`Unavailability.row.${u.id}.duration`} className="px-4 py-3 text-sm text-gray-600">{u.durationDays} {tr('Unavailability.j')}</td>
                      <td id={`Unavailability.row.${u.id}.status`} className="px-4 py-3">
                        <Badge id={`Unavailability.row.${u.id}.status.badge`} kind={statusBadge(u.status)}>
                          {dt(UNAVAILABILITY_STATUS_LABELS[u.status] ?? u.status)}
                        </Badge>
                        {u.rejectedReason && (
                          <p id={`Unavailability.row.${u.id}.rejectedReason`} className="mt-1 max-w-40 text-xs text-red-600" title={u.rejectedReason}>
                            {u.rejectedReason}
                          </p>
                        )}
                      </td>
                      <td id={`Unavailability.row.${u.id}.comment`} className="max-w-48 px-4 py-3 text-sm text-gray-600">{u.comment ?? '—'}</td>
                      <td id={`Unavailability.row.${u.id}.actions`} className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {canEdit(u) && (
                            <IconButton
                              icon="edit"
                              label={tr('Unavailability.editer')}
                              variant="primary"
                              onClick={(e) => {
                                e.stopPropagation()
                                openEdit(u)
                              }} id={`Unavailability.editer.${u.id}`} />
                          )}
                          {canSubmit(u) && (
                            <IconButton
                              icon="check"
                              label={tr('Unavailability.soumettre')}
                              onClick={(e) => {
                                e.stopPropagation()
                                void handleSubmit(u)
                              }} id={`Unavailability.soumettre.${u.id}`} />
                          )}
                          {canCancel(u) && (
                            <IconButton
                              icon="cancel"
                              label={u.status === 'VALIDATED'
                                ? tr('Unavailability.annuler.l.indisponibilite')
                                : tr('Unavailability.annuler.la.soumission')}
                              variant="danger"
                              onClick={(e) => {
                                e.stopPropagation()
                                void handleCancel(u)
                              }} id={`Unavailability.annuler.la.soumission.${u.id}`} />
                          )}
                          {canReview(u) && (
                            <>
                              <IconButton
                                icon="check"
                                label={tr('Unavailability.valider')}
                                variant="soft"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  void handleValidate(u)
                                }} id={`Unavailability.valider.${u.id}`} />
                              <IconButton
                                icon="reject"
                                label={tr('Unavailability.rejeter')}
                                variant="danger"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  void handleReject(u)
                                }} id={`Unavailability.rejeter.${u.id}`} />
                            </>
                          )}
                          {canInvalidate(u) && (
                            <IconButton
                              icon="reject"
                              label={tr('Unavailability.invalider')}
                              variant="danger"
                              onClick={(e) => {
                                e.stopPropagation()
                                void handleInvalidate(u)
                              }} id={`Unavailability.invalider.${u.id}`} />
                          )}
                          {canDelete(u) && (
                            <IconButton
                              icon="delete"
                              label={tr('Unavailability.supprimer')}
                              variant="danger"
                              onClick={(e) => {
                                e.stopPropagation()
                                void handleDelete(u)
                              }} id={`Unavailability.supprimer.${u.id}`} />
                          )}
                          <IconButton
                            icon="history"
                            label={tr('Unavailability.historique')}
                            variant="history"
                            onClick={(e) => {
                              e.stopPropagation()
                              setHistoryFor(u)
                            }} id={`Unavailability.historique.${u.id}`} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <InlineButton id="Unavailability.precedent" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
                {tr('Unavailability.precedent')}
              </InlineButton>
              <span id="Unavailability.page" className="text-sm text-gray-500">
                {tr('Unavailability.page')} {safePage + 1} / {totalPages}
              </span>
              <InlineButton id="Unavailability.suivant" disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)}>
                {tr('Unavailability.suivant')}
              </InlineButton>
            </div>
          )}

        </>
      )}

      {showForm && (
        <Card className="mb-4 p-4">
          <h3 id={formReadOnly ? 'Unavailability.detail.indisponibilite.form' : editingId != null ? 'Unavailability.modifier.l.indisponibilite.form' : 'Unavailability.nouvelle.indisponibilite.form'} className="mb-3 text-sm font-semibold text-gray-900">
            {formReadOnly
              ? tr('Unavailability.detail.indisponibilite')
              : editingId != null
                ? tr('Unavailability.modifier.l.indisponibilite')
                : tr('Unavailability.nouvelle.indisponibilite')}
          </h3>
          <div className="flex flex-wrap items-start gap-[30px]">
            <div className="w-full max-w-[28.75rem] space-y-3">
            <div className="flex flex-wrap items-start gap-3">
              {!isConsultant && (
                <div className="w-56 max-w-full">
                  <Field label={tr('Unavailability.consultant')} id="Unavailability.consultant">
                    <Select
                      id="Unavailability.consultant.select"
                      value={formConsultantId ?? ''}
                      onChange={(e) => setFormConsultantId(e.target.value ? Number(e.target.value) : null)}
                      title={tr('Unavailability.consultant')}
                      disabled={formReadOnly}
                    >
                      <option id="Unavailability.consultant.choisir" value="">{tr('Unavailability.choisir')}</option>
                      {consultants.data?.map((c) => (
                        <option id={`Unavailability.consultant.form.option.${c.id}`} key={c.id} value={c.id}>
                          {c.fullName}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              )}
              <div className="w-56 max-w-full">
                <Field label={tr('Unavailability.type')} id="Unavailability.type">
                  <Select id="Unavailability.type.select" value={formType} disabled={formReadOnly} onChange={(e) => setFormType(e.target.value)}>
                    {!formType && <option id="Unavailability.type.choisir" value="">{tr('Unavailability.choisir')}</option>}
                    {formType && !typeOptions.includes(formType) && (
                      <option id="Unavailability.type.current" value={formType}>{unavailabilityTypeLabel(formType)}</option>
                    )}
                    {typeOptions.map((label, index) => (
                      <option id={`Unavailability.type.option.${index}`} key={label} value={label}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>

            <div className="flex flex-wrap items-start gap-3">
              <div className="w-44 max-w-full">
                <Field label={tr('Unavailability.du')} id="Unavailability.du">
                  <Input id="Unavailability.du.input" type="date" value={formStart}
                    title={tr('Unavailability.du')}
                    min={maxIso(today, formHireDate)}
                    disabled={formReadOnly}
                    onChange={(e) => changeDates(e.target.value, formEnd)} />
                </Field>
              </div>
              <div className="w-44 max-w-full">
                <Field label={tr('Unavailability.au')} id="Unavailability.au">
                  <Input id="Unavailability.au.input" type="date" value={formEnd}
                    title={tr('Unavailability.au')}
                    min={maxIso(today, formStart, formHireDate)}
                    disabled={formReadOnly}
                    onChange={(e) => changeDates(formStart, e.target.value)} />
                </Field>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              {formStart && formEnd && formStart === formEnd ? (
                <div className="w-56 max-w-full">
                  <Field label="Demi-journée" id="Unavailability.demiJournee">
                    <Select
                      id="Unavailability.demiJournee.select"
                      value={formFirstDay}
                      disabled={formReadOnly}
                      onChange={(e) => {
                        const value = e.target.value as DayPart
                        setFormFirstDay(value)
                        setFormLastDay(value)
                      }}
                    >
                      <option id="Unavailability.demiJournee.option.ALL" value="ALL">Journée entière</option>
                      <option id="Unavailability.demiJournee.option.AM" value="AM">Matin</option>
                      <option id="Unavailability.demiJournee.option.PM" value="PM">Après-midi</option>
                    </Select>
                  </Field>
                </div>
              ) : (
                <>
                  <div className="w-56 max-w-full">
                    <Field label="Début" id="Unavailability.debutDemiJournee">
                      <Select
                        id="Unavailability.debutDemiJournee.select"
                        value={formFirstDay}
                        disabled={formReadOnly}
                        onChange={(e) => setFormFirstDay(e.target.value as DayPart)}
                      >
                        <option id="Unavailability.debutDemiJournee.option.ALL" value="ALL">Journée entière</option>
                        <option id="Unavailability.debutDemiJournee.option.PM" value="PM">Après-midi</option>
                      </Select>
                    </Field>
                  </div>
                  <div className="w-56 max-w-full">
                    <Field label="Fin" id="Unavailability.finDemiJournee">
                      <Select
                        id="Unavailability.finDemiJournee.select"
                        value={formLastDay}
                        disabled={formReadOnly}
                        onChange={(e) => setFormLastDay(e.target.value as DayPart)}
                      >
                        <option id="Unavailability.finDemiJournee.option.ALL" value="ALL">Journée entière</option>
                        <option id="Unavailability.finDemiJournee.option.AM" value="AM">Matin</option>
                      </Select>
                    </Field>
                  </div>
                </>
              )}
              <p id="Unavailability.duration" className="pb-2 text-sm text-gray-500">
                Durée : {durationFor(formStart, formEnd, formFirstDay, formLastDay, formCountType)} j
              </p>
            </div>

            <div style={{ maxWidth: isConsultant ? '14rem' : '28.75rem' }}>
              <Field label={tr('Unavailability.commentaire')} id="Unavailability.commentaire">
                <Textarea
                  id="Unavailability.commentaire.textarea"
                  rows={1}
                  value={formComment}
                  disabled={formReadOnly}
                  onChange={(e) => setFormComment(e.target.value)}
                  placeholder={tr('Unavailability.motif.remarques')}
                />
              </Field>
            </div>
            </div>

            <div className="min-w-0 flex-1">
              <Field label={tr('document.attachment.add')} id="Unavailability.document">
                <DocumentAttachment
                  value={formDocument}
                  onChange={(document) => {
                    if (!document && formDocument && !formDocument.temporary) {
                      setRemovedDocumentIds((prev) => [...prev, formDocument.id])
                    }
                    setFormDocument(document)
                  }}
                  socId={typesSocId}
                  consultantId={isConsultant ? (user?.consultantId ?? user?.id ?? null) : formConsultantId}
                  disabled={formReadOnly}
                />
              </Field>
            </div>
          </div>

          {editingId == null && previewUnavailability && (
            <div className="mt-4">
              <UnavailabilityCalendar selected={previewUnavailability} unavailabilities={data} />
            </div>
          )}

          {formReadOnly && (
            <p id="Unavailability.lecture.seule" className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
              {tr('Unavailability.lecture.seule')}
            </p>
          )}
          {formError && (
            <div className="mt-3">
              <Alert id="Unavailability.form.error" variant="error">{formError}</Alert>
            </div>
          )}
          <div className="mt-4 flex items-center justify-end gap-2">
            <IconButton
              icon="cancel"
              label={formReadOnly ? tr('common.close') : tr('Unavailability.annuler')}
              onClick={() => void closeForm()}
              disabled={saving} id="Unavailability.annuler" />
            {!formReadOnly && (
              <IconButton
                id={editingId != null ? 'Unavailability.save' : 'Unavailability.create'}
                icon={editingId != null ? 'save' : 'add'}
                label={editingId != null ? 'Enregistrer' : 'Créer'}
                variant="primary"
                onClick={() => void handleSave()}
                disabled={saving || !formIsValid}
                loading={saving}
              />
            )}
          </div>
        </Card>
      )}

      {selected && (
        <div className="mt-4">
          <UnavailabilityCalendar selected={selected} unavailabilities={data} />
        </div>
      )}
      {historyFor && (
        <UnavailabilityHistoryModal
          unavailability={historyFor}
          onClose={() => setHistoryFor(null)}
        />
      )}
    </div>
  )
}

function UnavailabilityHistoryModal({
  unavailability,
  onClose,
}: {
  unavailability: UnavailabilityDto
  onClose: () => void
}) {
  const history = useAsync(
    () => unavailabilityApi.history(unavailability.id),
    [unavailability.id],
  )
  const { user } = useAuth()
  const dt = useDynamicTranslate()
  const historyPage = usePagination(history.data ?? [], user?.pageSize ?? 5)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-lg bg-white p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900" id="Unavailability.historique.de.l.indisponibilite">{tr('Unavailability.historique.de.l.indisponibilite')} ({historyPage.total})</h3>
            <p id="Unavailability.historique.subtitle" className="text-xs text-gray-500">
              {unavailability.consultantName} — {unavailabilityTypeLabel(unavailability.type)}{' '}
              ({unavailability.startDate} → {unavailability.endDate})
            </p>
          </div>
          <IconButton icon="close" label={tr('Unavailability.fermer')} onClick={onClose} id="Unavailability.fermer" />
        </div>

        {history.loading && <LoadingBlock />}
        {history.error && <ErrorBlock message={history.error} />}

        {!history.loading && !history.error && (history.data?.length ?? 0) === 0 && (
          <p id="Unavailability.aucune.modification.enregistree" className="py-6 text-center text-sm text-gray-500">{tr('Unavailability.aucune.modification.enregistree')}</p>
        )}

        {!history.loading && (history.data?.length ?? 0) > 0 && (
          <div className="max-h-96 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead style={{ backgroundColor: 'var(--table-header)' }}>
                <tr>
                  <th id="Unavailability.history.th.index" className="w-10 px-3 py-2 text-right text-xs font-bold uppercase text-gray-400">#</th>
                  <th id="Unavailability.history.date" className="px-3 py-2 text-left text-xs font-bold uppercase text-gray-500">{tr('Unavailability.date')}</th>
                  <th id="Unavailability.history.modifie.par" className="px-3 py-2 text-left text-xs font-bold uppercase text-gray-500">{tr('Unavailability.modifie.par')}</th>
                  <th id="Unavailability.history.commentaire" className="px-3 py-2 text-left text-xs font-bold uppercase text-gray-500">{tr('Unavailability.commentaire')}</th>
                  <th id="Unavailability.history.avant" className="px-3 py-2 text-center text-xs font-bold uppercase text-gray-500">{tr('Unavailability.avant')}</th>
                  <th id="Unavailability.history.apres" className="px-3 py-2 text-center text-xs font-bold uppercase text-gray-500">{tr('Unavailability.apres')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {historyPage.pageItems.map((h: UnavailabilityHistoryDto, i) => (
                  <tr id={`Unavailability.history.row.${h.id}`} key={h.id}>
                    <td id={`Unavailability.history.row.${h.id}.index`} className="w-10 whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums text-gray-400">
                      {historyPage.offset + i + 1}
                    </td>
                    <td id={`Unavailability.history.row.${h.id}.date`} className="whitespace-nowrap px-3 py-2 text-sm text-gray-600">
                      {formatDateTime(h.dateModifIndispo)}
                    </td>
                    <td id={`Unavailability.history.row.${h.id}.modifier`} className="px-3 py-2 text-sm text-gray-900">{h.modifierName ?? '—'}</td>
                    <td id={`Unavailability.history.row.${h.id}.comment`} className="px-3 py-2 text-sm text-gray-600">{h.comment ? dt(h.comment) : '—'}</td>
                    <td id={`Unavailability.history.row.${h.id}.before`} className="px-3 py-2 text-center text-sm text-gray-600">{h.nbEventsBefore} {tr('Unavailability.j')}</td>
                    <td id={`Unavailability.history.row.${h.id}.after`} className="px-3 py-2 text-center text-sm text-gray-600">{h.nbEventsAfter} {tr('Unavailability.j')}</td>
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
      </div>
    </div>
  )
}
