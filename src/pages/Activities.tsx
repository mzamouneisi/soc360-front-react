import { tr } from '../i18n/translate'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { activitiesApi, activityTypesApi } from '../api/activities'
import { projectsApi } from '../api/projects'
import { consultantsApi } from '../api/consultants'
import { socsApi } from '../api/socs'
import { ApiError } from '../api/client'
import { useAsync } from '../lib/useAsync'
import { useSoc } from '../soc/SocContext'
import { Button, Field, InlineButton, Input, RefreshButton, Select, Spinner } from '../components/ui'
import { Badge, EmptyState, ErrorBlock, LoadingBlock, Modal, PageHeader, Table } from '../components/data'
import { dialog } from '../components/dialog'
import { formatMoney } from '../lib/format'
import type { ActivityDto, ActivityTypeDto, ProjectDto, ConsultantSummary, SocDto } from '../api/types'

interface FormState {
  name: string
  description: string
  price: string
  currency: string
  startDate: string
  endDate: string
  typeId: string
  projectId: string
  consultantId: string
  socId: string
  active: boolean
  weekendAllowed: boolean
  holidayAllowed: boolean
}

const emptyForm: FormState = {
  name: '',
  description: '',
  price: '',
  currency: 'EUR',
  startDate: '',
  endDate: '',
  typeId: '',
  projectId: '',
  consultantId: '',
  socId: '',
  active: true,
  weekendAllowed: false,
  holidayAllowed: false,
}

export function Activities() {
  const { user } = useAuth()
  const { selectedSocId } = useSoc()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'ADMIN'
  const isManager = user?.role === 'MANAGER'
  const isResponsibleSoc = user?.role === 'RESPONSIBLE_SOC'
  const needsConsultant = isManager || isResponsibleSoc
  const canEdit =
    user?.role === 'ADMIN' || user?.role === 'RESPONSIBLE_SOC' || user?.role === 'MANAGER'
  const workingSocId = selectedSocId ?? user?.socId ?? null

  const [form, setForm] = useState<FormState>(emptyForm)
  const [editing, setEditing] = useState<ActivityDto | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [consultantFilter, setConsultantFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const formSocId = form.socId ? Number(form.socId) : null
  const effectiveSocId = isAdmin ? formSocId : workingSocId

  const { data, loading, error, reload, setData } = useAsync(
    () => (workingSocId ? activitiesApi.findAll({ socId: workingSocId }) : activitiesApi.findAll()),
    [workingSocId],
  )
  const { data: types } = useAsync(
    () => (effectiveSocId ? activityTypesApi.findAll(effectiveSocId) : Promise.resolve([] as ActivityTypeDto[])),
    [effectiveSocId],
  )
  const { data: projects } = useAsync(
    () => (effectiveSocId ? projectsApi.findAll({ socId: effectiveSocId }) : Promise.resolve([] as ProjectDto[])),
    [effectiveSocId],
  )
  const { data: consultants } = useAsync(
    () =>
      isManager
        ? consultantsApi.managed()
        : effectiveSocId
          ? consultantsApi.summaries(effectiveSocId)
          : Promise.resolve([] as ConsultantSummary[]),
    [effectiveSocId, isManager],
  )
  const { data: socs } = useAsync(
    () => (isAdmin ? socsApi.findAll() : Promise.resolve([] as SocDto[])),
    [isAdmin],
  )
  const { data: filterConsultants } = useAsync(
    () => consultantsApi.filterList(),
    [user?.role],
    { enabled: !!user && user.role !== 'CONSULTANT' },
  )
  const { data: filterTypes } = useAsync(
    () => (workingSocId ? activityTypesApi.findAll(workingSocId) : Promise.resolve([] as ActivityTypeDto[])),
    [workingSocId],
  )

  if (!user) return null

  const filtered = (data ?? []).filter((a) => {
    if (consultantFilter && String(a.consultant?.id) !== consultantFilter) return false
    if (typeFilter && String(a.type?.id) !== typeFilter) return false
    return true
  })

  function openCreate() {
    setForm({
      ...emptyForm,
      typeId: types?.[0] ? String(types[0].id) : '',
      socId: isAdmin ? '' : String(workingSocId ?? ''),
    })
    setEditing(null)
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(activity: ActivityDto) {
    setForm({
      name: activity.name,
      description: activity.description ?? '',
      price: String(activity.price),
      currency: activity.currency || 'EUR',
      startDate: activity.startDate ?? '',
      endDate: activity.endDate ?? '',
      typeId: activity.type ? String(activity.type.id) : '',
      projectId: activity.project ? String(activity.project.id) : '',
      consultantId: activity.consultant ? String(activity.consultant.id) : '',
      socId: activity.soc ? String(activity.soc.id) : '',
      active: activity.active,
      weekendAllowed: activity.weekendAllowed,
      holidayAllowed: activity.holidayAllowed,
    })
    setEditing(activity)
    setFormError(null)
    setModalOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const socId = isAdmin ? (form.socId ? Number(form.socId) : null) : workingSocId
    if (!socId) {
      setFormError('Aucune société associée à votre compte')
      return
    }
    if (!form.name.trim() || !form.typeId || !form.projectId) {
      setFormError('Nom, type et projet sont obligatoires')
      return
    }
    if (needsConsultant && !form.consultantId) {
      setFormError(
        isManager
          ? 'Sélectionnez un de vos consultants.'
          : 'Sélectionnez un consultant (une activité ne peut pas être sans consultant).',
      )
      return
    }
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      setFormError('La date de fin ne peut pas précéder la date de début')
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description || null,
        price: Number(form.price) || 0,
        currency: form.currency || 'EUR',
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        typeId: Number(form.typeId),
        projectId: Number(form.projectId),
        consultantId: form.consultantId ? Number(form.consultantId) : null,
        socId,
        active: form.active,
        weekendAllowed: form.weekendAllowed,
        holidayAllowed: form.holidayAllowed,
      }
      if (editing) {
        await activitiesApi.update(editing.id, payload)
      } else {
        await activitiesApi.create(payload)
      }
      setModalOpen(false)
      reload()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Erreur inattendue')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(activity: ActivityDto) {
    if (!(await dialog.confirm(`Supprimer l'activité « ${activity.name} » ?`, { variant: 'warning', danger: true, okLabel: 'Supprimer' }))) return
    try {
      await activitiesApi.delete(activity.id)
      setData((prev) => (prev ?? []).filter((a) => a.id !== activity.id))
    } catch (err) {
      void dialog.error(err instanceof ApiError ? err.message : 'Erreur inattendue')
    }
  }

  return (
    <div>
      <PageHeader
        title={tr('Activities.activites.tarifs')}
        subtitle={tr('Activities.prestations.facturables.utilisees.dans.les.cra')}
        actions={
          <>
            <RefreshButton onClick={reload} />
            {canEdit ? (
              <>
                <InlineButton variant="primary" onClick={() => navigate('/types-activites')}>
                  Gérer les types
                </InlineButton>
                <Button className="w-auto" onClick={openCreate}>
                  + Nouvelle activité
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-56">
          <Field label={tr('Activities.consultant')}>
            <Select
              value={consultantFilter}
              onChange={(e) => setConsultantFilter(e.target.value)}
            >
              <option value="">{tr('Activities.tous.les.consultants')}</option>
              {(filterConsultants ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="w-56">
          <Field label={tr('Activities.type.d.activite')}>
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">{tr('Activities.tous.les.types')}</option>
              {(filterTypes ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.labelFr}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {(consultantFilter || typeFilter) && (
          <InlineButton
            className="mb-0.5"
            onClick={() => {
              setConsultantFilter('')
              setTypeFilter('')
            }}
          >
            {tr('Activities.reinitialiser')}
          </InlineButton>
        )}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {(types ?? []).map((t: ActivityTypeDto) => (
          <span
            key={t.id}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: t.color ?? '#94a3b8' }}
            />
            {t.labelFr}
          </span>
        ))}
      </div>

      {error && <ErrorBlock message={error} />}
      {loading && <LoadingBlock />}

      {!loading && filtered.length > 0 && (
        <Table
          paginate
          rowKey={(a) => a.id}
          rows={filtered}
          onRowClick={canEdit ? openEdit : undefined}
          columns={[
            {
              key: 'name',
              label: 'Activité',
              render: (a) => (
                <div>
                  <p className="font-medium text-gray-900">{a.name}</p>
                  {a.description && <p className="text-xs text-gray-500">{a.description}</p>}
                </div>
              ),
            },
            {
              key: 'type',
              label: 'Type',
              render: (a) => <Badge kind="info">{a.type?.labelFr ?? '—'}</Badge>,
            },
            {
              key: 'project',
              label: 'Projet',
              render: (a) => (
                <div>
                  <p className="font-medium text-gray-900">{a.project?.name ?? '—'}</p>
                  {a.project?.clientName && (
                    <p className="text-xs text-gray-500">{a.project.clientName}</p>
                  )}
                </div>
              ),
            },
            {
              key: 'consultant',
              label: 'Consultant',
              render: (a) => (
                <span className="text-gray-700">
                  {a.consultant
                    ? `${a.consultant.firstName} ${a.consultant.lastName}`
                    : '—'}
                </span>
              ),
            },
            {
              key: 'dates',
              label: 'Période',
              render: (a) => (
                <span className="text-gray-600">
                  {a.startDate ? a.startDate : '—'}
                  {a.endDate ? ` → ${a.endDate}` : a.startDate ? ' →' : ''}
                </span>
              ),
            },
            {
              key: 'price',
              label: 'Tarif',
              render: (a) => (
                <span className="font-medium text-gray-900">{formatMoney(a.price, a.currency)}</span>
              ),
            },
            {
              key: 'allowed',
              label: 'Week-end / Jours fériés',
              render: (a) => (
                <div className="flex flex-col gap-1">
                  <Badge kind={a.weekendAllowed ? 'success' : 'muted'}>
                    Week-end : {a.weekendAllowed ? 'Oui' : 'Non'}
                  </Badge>
                  <Badge kind={a.holidayAllowed ? 'success' : 'muted'}>
                    Jours fériés : {a.holidayAllowed ? 'Oui' : 'Non'}
                  </Badge>
                </div>
              ),
            },
            {
              key: 'soc',
              label: 'Société',
              render: (a) => <span className="text-gray-500">{a.soc?.name ?? '—'}</span>,
            },
            {
              key: 'active',
              label: 'Statut',
              render: (a) => (
                <Badge kind={a.active ? 'success' : 'muted'}>{a.active ? 'Active' : 'Inactive'}</Badge>
              ),
            },
            {
              key: 'actions',
              label: '',
              render: (a) =>
                canEdit ? (
                  <div className="flex justify-end gap-1">
                    <InlineButton
                      onClick={(e) => {
                        e.stopPropagation()
                        openEdit(a)
                      }}
                    >
                      Modifier
                    </InlineButton>
                    <InlineButton
                      variant="danger"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(a)
                      }}
                    >
                      Supprimer
                    </InlineButton>
                  </div>
                ) : (
                  <></>
                ),
            },
          ]}
        />
      )}

      {!loading && data && data.length > 0 && filtered.length === 0 && (
        <EmptyState
          title={tr('Activities.aucun.resultat')}
          description={tr('Activities.aucune.activite.ne.correspond.aux.filtres.selectionnes')}
        />
      )}

      {!loading && data && data.length === 0 && (
        <EmptyState
          title={tr('Activities.aucune.activite')}
          description={tr('Activities.creez.des.prestations.facturables.pour.vos.cra')}
          action={
            canEdit ? (
              <Button className="w-auto" onClick={openCreate}>
                + Nouvelle activité
              </Button>
            ) : undefined
          }
        />
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Modifier « ${editing.name} »` : 'Nouvelle activité'}
        footer={
          <>
            <InlineButton onClick={() => setModalOpen(false)}>Annuler</InlineButton>
            <Button className="w-auto" onClick={handleSubmit as never} disabled={submitting}>
              {submitting ? <Spinner className="border-white border-t-transparent" /> : null}
              {editing ? 'Enregistrer' : 'Créer'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {formError}
            </div>
          )}
          {isAdmin && (
            <Field label={tr('Activities.societe')}>
              <Select
                value={form.socId}
                onChange={(e) =>
                  setForm({
                    ...form,
                    socId: e.target.value,
                    typeId: '',
                    projectId: '',
                    consultantId: '',
                  })
                }
              >
                <option value="">{tr('Activities.selectionner')}</option>
                {(socs ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label={tr('Activities.nom')}>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label={tr('Activities.description')}>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <Field label={tr('Activities.projet')}>
            <Select
              value={form.projectId}
              onChange={(e) => setForm({ ...form, projectId: e.target.value })}
            >
              <option value="">{tr('Activities.selectionner')}</option>
              {(projects ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.client?.name ? ` — ${p.client.name}` : ''}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label={tr('Activities.type')}>
              <Select value={form.typeId} onChange={(e) => setForm({ ...form, typeId: e.target.value })}>
                <option value="">{tr('Activities.selectionner')}</option>
                {(types ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.labelFr}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={tr('Activities.prix')}>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </Field>
            <Field label={tr('Activities.devise')}>
              <Select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              >
                <option value="EUR">{tr('Activities.eur')}</option>
                <option value="USD">{tr('Activities.usd')}</option>
                <option value="CHF">{tr('Activities.chf')}</option>
                <option value="GBP">{tr('Activities.gbp')}</option>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={needsConsultant ? 'Consultant *' : 'Consultant'}>
              <Select
                value={form.consultantId}
                onChange={(e) => setForm({ ...form, consultantId: e.target.value })}
              >
                {needsConsultant ? (
                  <option value="" disabled>
                    {tr('Activities.selectionner')}
                  </option>
                ) : (
                  <option value="">{tr('Activities.aucun')}</option>
                )}
                {(consultants ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={tr('Activities.date.de.debut')}>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </Field>
            <Field label={tr('Activities.date.de.fin.optionnelle')}>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            {tr('Activities.activite.active')}
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.weekendAllowed}
              onChange={(e) => setForm({ ...form, weekendAllowed: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            {tr('Activities.activite.possible.le.week.end')}
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.holidayAllowed}
              onChange={(e) => setForm({ ...form, holidayAllowed: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            {tr('Activities.activite.possible.les.jours.feries')}
          </label>
        </form>
      </Modal>
    </div>
  )
}
