import { tr } from '../i18n/translate'
import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { projectsApi } from '../api/projects'
import { clientsApi } from '../api/clients'
import { socsApi } from '../api/socs'
import { ApiError } from '../api/client'
import { useAsync } from '../lib/useAsync'
import { Button, Field, Input, InlineButton, RefreshButton, Select, Spinner, Textarea } from '../components/ui'
import { Badge, ErrorBlock, LoadingBlock, Modal, PageHeader, Table } from '../components/data'
import { formatDate, formatMoney } from '../lib/format'
import type { ProjectDto } from '../api/types'

interface FormState {
  name: string
  description: string
  clientId: string
  socId: string
  startDate: string
  endDate: string
  dailyRate: string
  currency: string
  active: boolean
}

const emptyForm: FormState = {
  name: '',
  description: '',
  clientId: '',
  socId: '',
  startDate: '',
  endDate: '',
  dailyRate: '',
  currency: 'EUR',
  active: true,
}

export function Projects() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const canEdit = user?.role === 'ADMIN' || user?.role === 'RESPONSIBLE_SOC'

  const { data, loading, error, reload, setData } = useAsync(
    () => projectsApi.findAll(isAdmin ? undefined : { socId: user?.socId ?? undefined }),
    [user?.socId, isAdmin],
  )
  const { data: clients } = useAsync(
    () => clientsApi.findAll(isAdmin ? undefined : user?.socId ?? undefined),
    [user?.socId, isAdmin],
  )
  const { data: socs } = useAsync(() => (isAdmin ? socsApi.findAll() : Promise.resolve([])), [isAdmin])

  const [editing, setEditing] = useState<ProjectDto | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function openCreate() {
    setForm({ ...emptyForm, socId: isAdmin ? '' : String(user?.socId ?? '') })
    setEditing(null)
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(project: ProjectDto) {
    setForm({
      name: project.name,
      description: project.description ?? '',
      clientId: String(project.client?.id ?? ''),
      socId: String(project.soc?.id ?? user?.socId ?? ''),
      startDate: project.startDate ?? '',
      endDate: project.endDate ?? '',
      dailyRate: project.dailyRate != null ? String(project.dailyRate) : '',
      currency: project.currency ?? 'EUR',
      active: project.active,
    })
    setEditing(project)
    setFormError(null)
    setModalOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      setFormError('Le nom du projet est obligatoire')
      return
    }
    if (!form.clientId) {
      setFormError('Sélectionnez un client')
      return
    }
    if (isAdmin && !form.socId) {
      setFormError('Sélectionnez la société')
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description || null,
        clientId: Number(form.clientId),
        socId: isAdmin ? Number(form.socId) : user?.socId ?? 0,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        dailyRate: form.dailyRate ? Number(form.dailyRate) : null,
        currency: form.currency || 'EUR',
        active: form.active,
      }
      if (editing) {
        await projectsApi.update(editing.id, payload)
      } else {
        await projectsApi.create(payload)
      }
      setModalOpen(false)
      reload()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Erreur inattendue')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(project: ProjectDto) {
    if (!window.confirm(`Supprimer le projet « ${project.name} » ?`)) return
    try {
      await projectsApi.delete(project.id)
      setData((data ?? []).filter((p) => p.id !== project.id))
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : 'Erreur inattendue')
    }
  }

  return (
    <div>
      <PageHeader
        title={tr('Projects.projets')}
        subtitle={tr('Projects.les.projets.par.client.et.leurs.conditions.commerciales')}
        actions={
          <>
            <RefreshButton onClick={reload} />
            {canEdit ? (
              <Button className="w-auto" onClick={openCreate}>
                + Nouveau projet
              </Button>
            ) : null}
          </>
        }
      />

      {error && <ErrorBlock message={error} />}
      {loading && <LoadingBlock />}
      {!loading && data && (
        <Table
          paginate
          rowKey={(p) => p.id}
          onRowClick={canEdit ? openEdit : undefined}
          rows={data}
          columns={[
            {
              key: 'name',
              label: 'Projet',
              render: (p) => (
                <div>
                  <p className="font-medium text-gray-900">{p.name}</p>
                  {p.description && <p className="text-xs text-gray-500">{p.description}</p>}
                </div>
              ),
            },
            {
              key: 'client',
              label: 'Client',
              render: (p) => <span>{p.client?.name ?? '—'}</span>,
            },
            {
              key: 'dates',
              label: 'Période',
              render: (p) => (
                <span className="text-gray-500">
                  {formatDate(p.startDate)} → {formatDate(p.endDate)}
                </span>
              ),
            },
            {
              key: 'rate',
              label: 'TJM',
              render: (p) => (
                <span className="font-medium text-gray-900">
                  {formatMoney(p.dailyRate, p.currency)}
                </span>
              ),
            },
            {
              key: 'soc',
              label: 'Société',
              render: (p) => (isAdmin ? <span>{p.soc?.name ?? '—'}</span> : <span>—</span>),
            },
            {
              key: 'active',
              label: 'Statut',
              render: (p) => (
                <Badge kind={p.active ? 'success' : 'muted'}>{p.active ? 'Actif' : 'Inactif'}</Badge>
              ),
            },
            {
              key: 'actions',
              label: '',
              render: (p) =>
                canEdit ? (
                  <div className="flex justify-end gap-1">
                    <InlineButton onClick={(e) => { e.stopPropagation(); openEdit(p) }}>
                      Modifier
                    </InlineButton>
                    <InlineButton
                      className="text-red-600 hover:bg-red-50"
                      onClick={(e) => { e.stopPropagation(); handleDelete(p) }}
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Modifier ${editing.name}` : 'Nouveau projet'}
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
          <Field label={tr('Projects.nom.du.projet')}>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label={tr('Projects.description')}>
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={tr('Projects.client')}>
              <Select
                value={form.clientId}
                onChange={(e) => setForm({ ...form, clientId: e.target.value })}
              >
                <option value="">{tr('Projects.selectionner')}</option>
                {(clients ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            {isAdmin && (
              <Field label={tr('Projects.societe')}>
                <Select
                  value={form.socId}
                  onChange={(e) => setForm({ ...form, socId: e.target.value })}
                >
                  <option value="">{tr('Projects.selectionner')}</option>
                  {(socs ?? []).map((soc) => (
                    <option key={soc.id} value={soc.id}>
                      {soc.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={tr('Projects.debut')}>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </Field>
            <Field label={tr('Projects.fin')}>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={tr('Projects.tjm')}>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.dailyRate}
                onChange={(e) => setForm({ ...form, dailyRate: e.target.value })}
              />
            </Field>
            <Field label={tr('Projects.devise')}>
              <Select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              >
                <option value="EUR">{tr('Projects.eur')}</option>
                <option value="USD">{tr('Projects.usd')}</option>
                <option value="CHF">{tr('Projects.chf')}</option>
              </Select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            {tr('Projects.projet.actif')}
          </label>
        </form>
      </Modal>
    </div>
  )
}
