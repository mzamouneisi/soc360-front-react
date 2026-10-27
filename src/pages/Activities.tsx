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
import { useDynamicTranslate } from '../lib/useDynamicTranslate'
import { useSoc } from '../soc/SocContext'
import { Field, IconButton, InlineButton, Input, RefreshButton, Select } from '../components/ui'
import { Badge, EmptyState, ErrorBlock, LoadingBlock, Modal, PageHeader, Table } from '../components/data'
import { dialog } from '../components/dialog'
import { formatMoney } from '../lib/format'
import type { ActivityDto, ActivityTypeDto, ProjectDto, SocDto } from '../api/types'

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
  const dt = useDynamicTranslate()
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
  const { data: collaborators } = useAsync(
    () => consultantsApi.collaborators(effectiveSocId ?? undefined),
    [effectiveSocId],
  )
  const { data: socs } = useAsync(
    () => (isAdmin ? socsApi.findAll() : Promise.resolve([] as SocDto[])),
    [isAdmin],
  )
  const { data: filterCollaborators } = useAsync(
    () => consultantsApi.collaborators(effectiveSocId ?? undefined),
    [effectiveSocId],
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
      setFormError(tr('Activities.aucune.societe.associee'))
      return
    }
    if (!form.name.trim() || !form.typeId || !form.projectId) {
      setFormError(tr('Activities.nom.type.projet.obligatoires'))
      return
    }
    if (needsConsultant && !form.consultantId) {
      setFormError(
        isManager
          ? tr('Activities.selectionnez.un.de.vos.collaborateurs')
          : tr('Activities.selectionnez.un.collaborateur'),
      )
      return
    }
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      setFormError(tr('Activities.date.fin.invalide'))
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
      setFormError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(activity: ActivityDto) {
    if (!(await dialog.confirm(tr('Activities.supprimer.l.activite', { name: activity.name }), { variant: 'warning', danger: true, okLabel: tr('common.delete') }))) return
    try {
      await activitiesApi.delete(activity.id)
      setData((prev) => (prev ?? []).filter((a) => a.id !== activity.id))
    } catch (err) {
      void dialog.error(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    }
  }

  return (
    <div>
      <PageHeader
        title={tr('Activities.activites.tarifs')}
        titleId="Activities.activites.tarifs"
        count={(data ?? []).length}
        subtitle={tr('Activities.prestations.facturables.utilisees.dans.les.cra')}
        subtitleId="Activities.prestations.facturables.utilisees.dans.les.cra"
        actions={
          <>
            <RefreshButton onClick={reload} />
            {canEdit ? (
              <>
                <IconButton icon="add" label={tr('Activities.nouvelle.activite')} variant="new" onClick={openCreate} id="Activities.nouvelle.activite" />
                <InlineButton id="Activities.gerer.les.types" className="ml-2" variant="primary" onClick={() => navigate('/types-activites')}>
                  {tr('Activities.gerer.les.types')}
                </InlineButton>
              </>
            ) : null}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-56">
          <Field label={tr('Activities.collaborateur')} id="Activities.collaborateur">
            <Select
              id="Activities.collaborateur.select"
              value={consultantFilter}
              onChange={(e) => setConsultantFilter(e.target.value)}
            >
              <option id="Activities.tous.les.collaborateurs" value="">{tr('Activities.tous.les.collaborateurs')}</option>
              {(filterCollaborators ?? []).map((c) => (
                <option id={`Activities.collaborateur.option.${c.id}`} key={c.id} value={c.id}>
                  {c.fullName}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="w-56">
          <Field label={tr('Activities.type.d.activite')} id="Activities.type.d.activite">
            <Select id="Activities.type.d.activite.select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option id="Activities.tous.les.types" value="">{tr('Activities.tous.les.types')}</option>
              {(filterTypes ?? []).map((t) => (
                <option id={`Activities.type.option.${t.id}`} key={t.id} value={t.id}>
                  {t.labelFr}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {(consultantFilter || typeFilter) && (
          <InlineButton
            id="Activities.reinitialiser"
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
            id={`Activities.type.pill.${t.id}`}
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
              label: tr('Activities.activite'),
              render: (a) => (
                <div>
                  <p id={`Activities.row.${a.id}.name`} className="font-medium text-gray-900">{dt(a.name)}</p>
                  {a.description && <p id={`Activities.row.${a.id}.description`} className="text-xs text-gray-500">{dt(a.description)}</p>}
                </div>
              ),
            },
            {
              key: 'type',
              label: tr('common.type'),
              render: (a) => <Badge id={`Activities.row.${a.id}.type`} kind="info">{a.type ? dt(a.type.labelFr) : '—'}</Badge>,
            },
            {
              key: 'project',
              label: tr('Projects.projet'),
              render: (a) => (
                <div>
                  <p id={`Activities.row.${a.id}.project`} className="font-medium text-gray-900">{a.project?.name ?? '—'}</p>
                  {a.project?.clientName && (
                    <p id={`Activities.row.${a.id}.project.client`} className="text-xs text-gray-500">{a.project.clientName}</p>
                  )}
                </div>
              ),
            },
            {
              key: 'consultant',
              label: tr('Activities.collaborateur'),
              render: (a) => (
                <span id={`Activities.row.${a.id}.consultant`} className="text-gray-700">
                  {a.consultant
                    ? `${a.consultant.firstName} ${a.consultant.lastName}`
                    : '—'}
                </span>
              ),
            },
            {
              key: 'dates',
              label: tr('common.period'),
              render: (a) => (
                <span id={`Activities.row.${a.id}.dates`} className="text-gray-600">
                  {a.startDate ? a.startDate : '—'}
                  {a.endDate ? ` → ${a.endDate}` : a.startDate ? ' →' : ''}
                </span>
              ),
            },
            {
              key: 'price',
              label: tr('Activities.tarif'),
              render: (a) => (
                <span id={`Activities.row.${a.id}.price`} className="font-medium text-gray-900">{formatMoney(a.price, a.currency)}</span>
              ),
            },
            {
              key: 'allowed',
              label: tr('Activities.week.end.jours.feries'),
              render: (a) => (
                <div className="flex flex-col gap-1">
                  <Badge id={`Activities.row.${a.id}.weekend`} kind={a.weekendAllowed ? 'success' : 'muted'}>
                    {tr('Activities.week.end')} : {a.weekendAllowed ? tr('common.yes') : tr('common.no')}
                  </Badge>
                  <Badge id={`Activities.row.${a.id}.holiday`} kind={a.holidayAllowed ? 'success' : 'muted'}>
                    {tr('Activities.jours.feries')} : {a.holidayAllowed ? tr('common.yes') : tr('common.no')}
                  </Badge>
                </div>
              ),
            },
            {
              key: 'soc',
              label: tr('common.company'),
              render: (a) => <span id={`Activities.row.${a.id}.soc`} className="text-gray-500">{a.soc?.name ?? '—'}</span>,
            },
            {
              key: 'active',
              label: tr('common.status'),
              render: (a) => (
                <Badge id={`Activities.row.${a.id}.active`} kind={a.active ? 'success' : 'muted'}>{a.active ? tr('Activities.active') : tr('Activities.inactive')}</Badge>
              ),
            },
            {
              key: 'actions',
              label: '',
              render: (a) =>
                canEdit ? (
                  <div className="flex justify-end gap-1">
                    <IconButton
                      icon="edit"
                      label={tr('common.edit')}
                      onClick={(e) => {
                        e.stopPropagation()
                        openEdit(a)
                      }} id={`common.edit.${a.id}`} />
                    <IconButton
                      icon="delete"
                      label={tr('common.delete')}
                      variant="danger"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(a)
                      }} id={`common.delete.${a.id}`} />
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
          titleId="Activities.aucun.resultat"
          descriptionId="Activities.aucune.activite.ne.correspond.aux.filtres.selectionnes"
          title={tr('Activities.aucun.resultat')}
          description={tr('Activities.aucune.activite.ne.correspond.aux.filtres.selectionnes')}
        />
      )}

      {!loading && data && data.length === 0 && (
        <EmptyState
          titleId="Activities.aucune.activite"
          descriptionId="Activities.creez.des.prestations.facturables.pour.vos.cra"
          title={tr('Activities.aucune.activite')}
          description={tr('Activities.creez.des.prestations.facturables.pour.vos.cra')}
          action={
            canEdit ? (
              <IconButton icon="add" label={tr('Activities.nouvelle.activite')} variant="new" onClick={openCreate} id="Activities.nouvelle.activite.empty" />
            ) : undefined
          }
        />
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        titleId="Activities.modal.title"
        title={editing ? tr('Activities.modifier.activite', { name: editing.name }) : tr('Activities.nouvelle.activite')}
        footer={
          <>
            <IconButton icon="cancel" label={tr('common.cancel')} onClick={() => setModalOpen(false)} id="common.cancel" />
            <IconButton
              id={editing ? 'common.save' : 'common.create'}
              icon={editing ? 'save' : 'add'}
              label={editing ? tr('common.save') : tr('common.create')}
              variant="primary"
              onClick={handleSubmit as never}
              disabled={submitting} loading={submitting}
            />
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div id="Activities.form.error" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {formError}
            </div>
          )}
          {isAdmin && (
            <Field label={tr('Activities.societe')} id="Activities.societe">
              <Select
                id="Activities.societe.select"
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
                <option id="Activities.selectionner" value="">{tr('Activities.selectionner')}</option>
                {(socs ?? []).map((s) => (
                  <option id={`Activities.societe.option.${s.id}`} key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label={tr('Activities.nom')} id="Activities.nom">
            <Input id="Activities.nom.input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label={tr('Activities.description')} id="Activities.description">
            <Input
              id="Activities.description.input"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <Field label={tr('Activities.projet')} id="Activities.projet">
            <Select
              id="Activities.projet.select"
              value={form.projectId}
              onChange={(e) => setForm({ ...form, projectId: e.target.value })}
            >
              <option id="Activities.projet.selectionner" value="">{tr('Activities.selectionner')}</option>
              {(projects ?? []).map((p) => (
                <option id={`Activities.projet.option.${p.id}`} key={p.id} value={p.id}>
                  {p.name}
                  {p.client?.name ? ` — ${p.client.name}` : ''}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label={tr('Activities.type')} id="Activities.type">
              <Select id="Activities.type.select" value={form.typeId} onChange={(e) => setForm({ ...form, typeId: e.target.value })}>
                <option id="Activities.type.selectionner" value="">{tr('Activities.selectionner')}</option>
                {(types ?? []).map((t) => (
                  <option id={`Activities.type.form.option.${t.id}`} key={t.id} value={t.id}>
                    {t.labelFr}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={tr('Activities.prix')} id="Activities.prix">
              <Input
                id="Activities.prix.input"
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </Field>
            <Field label={tr('Activities.devise')} id="Activities.devise">
              <Select
                id="Activities.devise.select"
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              >
                <option id="Activities.devise.option.EUR" value="EUR">{tr('Activities.eur')}</option>
                <option id="Activities.devise.option.USD" value="USD">{tr('Activities.usd')}</option>
                <option id="Activities.devise.option.CHF" value="CHF">{tr('Activities.chf')}</option>
                <option id="Activities.devise.option.GBP" value="GBP">{tr('Activities.gbp')}</option>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={needsConsultant ? tr('Activities.collaborateur.obligatoire') : tr('Activities.collaborateur')} id="Activities.collaborateur.form">
              <Select
                id="Activities.collaborateur.form.select"
                value={form.consultantId}
                onChange={(e) => setForm({ ...form, consultantId: e.target.value })}
              >
                {needsConsultant ? (
                  <option id="Activities.collaborateur.form.selectionner" value="" disabled>
                    {tr('Activities.selectionner')}
                  </option>
                ) : (
                  <option id="Activities.collaborateur.form.aucun" value="">{tr('Activities.aucun')}</option>
                )}
                {(collaborators ?? []).map((c) => (
                  <option id={`Activities.collaborateur.form.option.${c.id}`} key={c.id} value={c.id}>
                    {c.fullName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={tr('Activities.date.de.debut')} id="Activities.date.de.debut">
              <Input
                id="Activities.date.de.debut.input"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </Field>
            <Field label={tr('Activities.date.de.fin.optionnelle')} id="Activities.date.de.fin.optionnelle">
              <Input
                id="Activities.date.de.fin.optionnelle.input"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </Field>
          </div>
          <label id="Activities.activite.active.label" className="flex items-center gap-2 text-sm text-gray-700">
            <input
              id="Activities.activite.active.checkbox"
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            {tr('Activities.activite.active')}
          </label>
          <label id="Activities.activite.possible.le.week.end.label" className="flex items-center gap-2 text-sm text-gray-700">
            <input
              id="Activities.activite.possible.le.week.end.checkbox"
              type="checkbox"
              checked={form.weekendAllowed}
              onChange={(e) => setForm({ ...form, weekendAllowed: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            {tr('Activities.activite.possible.le.week.end')}
          </label>
          <label id="Activities.activite.possible.les.jours.feries.label" className="flex items-center gap-2 text-sm text-gray-700">
            <input
              id="Activities.activite.possible.les.jours.feries.checkbox"
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
