import { useEffect, useMemo, useState } from 'react'
import { ApiError } from '../api/client'
import { unavailabilityApi } from '../api/unavailability'
import { consultantsApi } from '../api/consultants'
import type {
  ConsultantSummary,
  UnavailabilityDto,
  UnavailabilityHistoryDto,
  UnavailabilityType,
} from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Badge, ErrorBlock, LoadingBlock, PageHeader } from '../components/data'
import { Alert, Button, Card, Field, InlineButton, Input, Select, Textarea } from '../components/ui'
import {
  formatDate,
  formatDateTime,
  statusBadge,
  UNAVAILABILITY_STATUS_LABELS,
  UNAVAILABILITY_TYPE_LABELS,
} from '../lib/format'
import { useAsync } from '../lib/useAsync'
import { UnavailabilityCalendar } from './UnavailabilityCalendar'

const TYPES = Object.keys(UNAVAILABILITY_TYPE_LABELS) as UnavailabilityType[]

export function Unavailability() {
  const { user } = useAuth()
  const isConsultant = user?.role === 'CONSULTANT'
  const isAdmin = user?.role === 'ADMIN'

  const [consultantFilter, setConsultantFilter] = useState<number | null>(null)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formConsultantId, setFormConsultantId] = useState<number | null>(null)
  const [formType, setFormType] = useState<UnavailabilityType>('CONGE_PAYE')
  const [formStart, setFormStart] = useState('')
  const [formEnd, setFormEnd] = useState('')
  const [formComment, setFormComment] = useState('')
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

  useEffect(() => {
    setPage(0)
    setSelectedId(null)
  }, [search, consultantFilter])

  const data = list.data ?? []
  const selected = useMemo(() => data.find((u) => u.id === selectedId) ?? null, [list.data, selectedId])

  if (!user) return null

  const filtered = search.trim()
    ? data.filter((u) => {
        const q = search.trim().toLowerCase()
        const type = (UNAVAILABILITY_TYPE_LABELS[u.type] ?? u.type).toLowerCase()
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
    : data

  const pageSize = user?.pageSize ?? 5
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages - 1)
  const pageItems = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize)

  const canEdit = (u: UnavailabilityDto) =>
    isConsultant ? u.status === 'DRAFT' || u.status === 'REJECTED' : true
  const canSubmit = (u: UnavailabilityDto) => u.status === 'DRAFT' || u.status === 'REJECTED'
  const canDelete = (u: UnavailabilityDto) => u.status === 'DRAFT' || u.status === 'REJECTED'
  const canCancel = (u: UnavailabilityDto) => u.status === 'SUBMITTED'
  const canReview = (u: UnavailabilityDto) => !isConsultant && u.status === 'SUBMITTED'

  function openCreate() {
    const today = new Date()
    const end = new Date(today)
    end.setDate(end.getDate() + 7)
    setEditingId(null)
    setFormConsultantId(consultantFilter)
    setFormType('CONGE_PAYE')
    setFormStart(today.toISOString().slice(0, 10))
    setFormEnd(end.toISOString().slice(0, 10))
    setFormComment('')
    setFormError(null)
    setShowForm(true)
  }

  function openEdit(u: UnavailabilityDto) {
    setEditingId(u.id)
    setFormConsultantId(u.consultantId)
    setFormType(u.type)
    setFormStart(u.startDate)
    setFormEnd(u.endDate)
    setFormComment(u.comment ?? '')
    setFormError(null)
    setShowForm(true)
  }

  async function handleSave() {
    if (!formStart || !formEnd) {
      setFormError('Les dates de début et de fin sont obligatoires.')
      return
    }
    if (formStart > formEnd) {
      setFormError('La date de fin doit être postérieure ou égale à la date de début.')
      return
    }
    if (!isConsultant && editingId == null && formConsultantId == null) {
      setFormError('Sélectionnez un consultant.')
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
      }
      if (editingId != null) {
        await unavailabilityApi.update(editingId, request)
      } else {
        await unavailabilityApi.create(request)
      }
      setShowForm(false)
      list.reload()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Erreur inattendue')
    } finally {
      setSaving(false)
    }
  }

  async function runAction(
    u: UnavailabilityDto,
    fn: () => Promise<unknown>,
    confirmMsg?: string,
  ) {
    if (confirmMsg && !window.confirm(confirmMsg)) return
    try {
      await fn()
      list.reload()
      if (selectedId === u.id) setSelectedId(u.id)
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : 'Erreur inattendue')
    }
  }

  function handleSubmit(u: UnavailabilityDto) {
    return runAction(u, () => unavailabilityApi.submit(u.id))
  }

  function handleCancel(u: UnavailabilityDto) {
    return runAction(
      u,
      () => unavailabilityApi.cancel(u.id),
      'Retourner cette indisponibilité au brouillon ? Elle restera modifiable.',
    )
  }

  function handleValidate(u: UnavailabilityDto) {
    const comment = window.prompt('Commentaire de validation à envoyer au consultant :')
    if (comment === null) return
    return runAction(u, () => unavailabilityApi.validate(u.id, comment))
  }

  function handleReject(u: UnavailabilityDto) {
    const comment = window.prompt('Motif du rejet à envoyer au consultant :')
    if (comment === null) return
    return runAction(u, () => unavailabilityApi.reject(u.id, comment))
  }

  function handleDelete(u: UnavailabilityDto) {
    return runAction(
      u,
      () => unavailabilityApi.delete(u.id),
      `Supprimer cette indisponibilité (${UNAVAILABILITY_TYPE_LABELS[u.type] ?? u.type}) ?`,
    )
  }

  return (
    <div>
      <PageHeader
        title="Indisponibilités"
        subtitle="Intervalles d'indisponibilité des consultants (congés, maladie, maternité…)"
        actions={
          <Button className="w-auto" onClick={openCreate} variant="yellow">
            Nouvelle indisponibilité
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {!isConsultant && (
          <div className="max-w-xs flex-1">
            <Select
              value={consultantFilter ?? ''}
              onChange={(e) => setConsultantFilter(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Tous les consultants</option>
              {consultants.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className="min-w-[16rem] flex-1">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrer par type, statut, consultant ou dates…"
          />
        </div>
      </div>

      {showForm && (
        <Card className="mb-4 p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">
            {editingId != null ? 'Modifier l’indisponibilité' : 'Nouvelle indisponibilité'}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {!isConsultant && (
              <Field label="Consultant">
                <Select
                  value={formConsultantId ?? ''}
                  onChange={(e) => setFormConsultantId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">— Choisir —</option>
                  {consultants.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Type">
              <Select value={formType} onChange={(e) => setFormType(e.target.value as UnavailabilityType)}>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {UNAVAILABILITY_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Du">
              <Input type="date" value={formStart} onChange={(e) => setFormStart(e.target.value)} />
            </Field>
            <Field label="Au">
              <Input type="date" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} />
            </Field>
            <Field label="Commentaire">
              <Textarea
                rows={1}
                value={formComment}
                onChange={(e) => setFormComment(e.target.value)}
                placeholder="Motif, remarques…"
              />
            </Field>
          </div>
          {formError && (
            <div className="mt-3">
              <Alert variant="error">{formError}</Alert>
            </div>
          )}
          <div className="mt-4 flex items-center justify-end gap-2">
            <InlineButton onClick={() => setShowForm(false)} disabled={saving}>
              Annuler
            </InlineButton>
            <Button className="w-auto" onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Enregistrement…' : editingId != null ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </Card>
      )}

      {list.error && <ErrorBlock message={list.error} />}
      {list.loading && <LoadingBlock />}

      {!list.loading && filtered.length === 0 && (
        <Card className="flex flex-col items-center justify-center py-14">
          <p className="text-sm font-medium text-gray-900">
            {search.trim() ? 'Aucune indisponibilité ne correspond au filtre' : 'Aucune indisponibilité'}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {search.trim()
              ? 'Modifiez votre recherche.'
              : 'Cliquez sur « Nouvelle indisponibilité » pour en déclarer une.'}
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
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      Consultant
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      Du
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      Au
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      Durée
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      Statut
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      Commentaire
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {pageItems.map((u) => (
                    <tr
                      key={u.id}
                      onClick={() => setSelectedId(u.id)}
                      className={`align-top cursor-pointer ${
                        u.id === selectedId
                          ? '[&>td]:border-y-2 [&>td]:border-blue-400 [&>td:first-child]:border-l-2 [&>td:last-child]:border-r-2 [&>td]:bg-blue-50'
                          : 'even:bg-gray-50'
                      }`}
                    >
                      <td className="px-4 py-3 text-sm text-gray-900">{u.consultantName}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {UNAVAILABILITY_TYPE_LABELS[u.type] ?? u.type}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {formatDate(u.startDate)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {formatDate(u.endDate)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{u.durationDays} j</td>
                      <td className="px-4 py-3">
                        <Badge kind={statusBadge(u.status)}>
                          {UNAVAILABILITY_STATUS_LABELS[u.status] ?? u.status}
                        </Badge>
                        {u.rejectedReason && (
                          <p className="mt-1 max-w-40 text-xs text-red-600" title={u.rejectedReason}>
                            {u.rejectedReason}
                          </p>
                        )}
                      </td>
                      <td className="max-w-48 px-4 py-3 text-sm text-gray-600">{u.comment ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {canEdit(u) && (
                            <InlineButton
                              onClick={(e) => {
                                e.stopPropagation()
                                openEdit(u)
                              }}
                            >
                              Éditer
                            </InlineButton>
                          )}
                          {canSubmit(u) && (
                            <InlineButton
                              onClick={(e) => {
                                e.stopPropagation()
                                void handleSubmit(u)
                              }}
                            >
                              Soumettre
                            </InlineButton>
                          )}
                          {canCancel(u) && (
                            <InlineButton
                              onClick={(e) => {
                                e.stopPropagation()
                                void handleCancel(u)
                              }}
                            >
                              Annuler la soumission
                            </InlineButton>
                          )}
                          {canReview(u) && (
                            <>
                              <InlineButton
                                className="border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  void handleValidate(u)
                                }}
                              >
                                Valider
                              </InlineButton>
                              <InlineButton
                                className="border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  void handleReject(u)
                                }}
                              >
                                Rejeter
                              </InlineButton>
                            </>
                          )}
                          {canDelete(u) && (
                            <InlineButton
                              className="border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                              onClick={(e) => {
                                e.stopPropagation()
                                void handleDelete(u)
                              }}
                            >
                              Supprimer
                            </InlineButton>
                          )}
                          <InlineButton
                            onClick={(e) => {
                              e.stopPropagation()
                              setHistoryFor(u)
                            }}
                          >
                            Historique
                          </InlineButton>
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
              <InlineButton disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
                ← Précédent
              </InlineButton>
              <span className="text-sm text-gray-500">
                Page {safePage + 1} / {totalPages}
              </span>
              <InlineButton disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)}>
                Suivant →
              </InlineButton>
            </div>
          )}

          {selected && (
            <div className="mt-4">
              <UnavailabilityCalendar selected={selected} unavailabilities={data} />
            </div>
          )}
        </>
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-lg bg-white p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Historique de l’indisponibilité</h3>
            <p className="text-xs text-gray-500">
              {unavailability.consultantName} — {UNAVAILABILITY_TYPE_LABELS[unavailability.type]}{' '}
              ({unavailability.startDate} → {unavailability.endDate})
            </p>
          </div>
          <InlineButton onClick={onClose}>Fermer</InlineButton>
        </div>

        {history.loading && <LoadingBlock />}
        {history.error && <ErrorBlock message={history.error} />}

        {!history.loading && !history.error && (history.data?.length ?? 0) === 0 && (
          <p className="py-6 text-center text-sm text-gray-500">Aucune modification enregistrée.</p>
        )}

        {!history.loading && (history.data?.length ?? 0) > 0 && (
          <div className="max-h-96 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead style={{ backgroundColor: 'var(--table-header)' }}>
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-bold uppercase text-gray-500">Date</th>
                  <th className="px-3 py-2 text-left text-xs font-bold uppercase text-gray-500">Modifié par</th>
                  <th className="px-3 py-2 text-left text-xs font-bold uppercase text-gray-500">Commentaire</th>
                  <th className="px-3 py-2 text-center text-xs font-bold uppercase text-gray-500">Avant</th>
                  <th className="px-3 py-2 text-center text-xs font-bold uppercase text-gray-500">Après</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {history.data?.map((h: UnavailabilityHistoryDto) => (
                  <tr key={h.id}>
                    <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-600">
                      {formatDateTime(h.dateModifIndispo)}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900">{h.modifierName ?? '—'}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{h.comment ?? '—'}</td>
                    <td className="px-3 py-2 text-center text-sm text-gray-600">{h.nbEventsBefore} j</td>
                    <td className="px-3 py-2 text-center text-sm text-gray-600">{h.nbEventsAfter} j</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}