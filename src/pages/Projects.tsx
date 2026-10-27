import { tr } from '../i18n/translate'
import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { projectsApi } from '../api/projects'
import { clientsApi } from '../api/clients'
import { socsApi } from '../api/socs'
import { ApiError } from '../api/client'
import { useAsync } from '../lib/useAsync'
import { Field, IconButton, Input, RefreshButton, Select, Textarea } from '../components/ui'
import { Badge, ErrorBlock, LoadingBlock, Modal, PageHeader, Table } from '../components/data'
import { dialog } from '../components/dialog'
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
      setFormError(tr('Projects.nom.obligatoire'))
      return
    }
    if (!form.clientId) {
      setFormError(tr('Projects.selectionner.client'))
      return
    }
    if (isAdmin && !form.socId) {
      setFormError(tr('Projects.selectionner.societe'))
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
      setFormError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(project: ProjectDto) {
    if (!(await dialog.confirm(tr('Projects.supprimer.le.projet', { name: project.name }), { variant: 'warning', danger: true, okLabel: tr('common.delete') }))) return
    try {
      await projectsApi.delete(project.id)
      setData((data ?? []).filter((p) => p.id !== project.id))
    } catch (err) {
      void dialog.error(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    }
  }

  return (
    <div>
      <PageHeader
        title={tr('Projects.projets')}
        titleId="Projects.projets"
        count={(data ?? []).length}
        subtitle={tr('Projects.les.projets.par.client.et.leurs.conditions.commerciales')}
        subtitleId="Projects.les.projets.par.client.et.leurs.conditions.commerciales"
        actions={
          <>
            <RefreshButton onClick={reload} />
            {canEdit ? (
              <IconButton icon="add" label={tr('Projects.nouveau.projet')} variant="new" onClick={openCreate} id="Projects.nouveau.projet" />
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
              label: tr('Projects.projet'),
              render: (p) => (
                <div>
                  <p id={`Projects.project.${p.id}.name`} className="font-medium text-gray-900">{p.name}</p>
                  {p.description && <p id={`Projects.project.${p.id}.description`} className="text-xs text-gray-500">{p.description}</p>}
                </div>
              ),
            },
            {
              key: 'client',
              label: tr('Projects.client'),
              render: (p) => <span id={`Projects.project.${p.id}.client`}>{p.client?.name ?? '—'}</span>,
            },
            {
              key: 'dates',
              label: tr('common.period'),
              render: (p) => (
                <span id={`Projects.project.${p.id}.dates`} className="text-gray-500">
                  {formatDate(p.startDate)} → {formatDate(p.endDate)}
                </span>
              ),
            },
            {
              key: 'rate',
              label: tr('Projects.tjm'),
              render: (p) => (
                <span id={`Projects.project.${p.id}.rate`} className="font-medium text-gray-900">
                  {formatMoney(p.dailyRate, p.currency)}
                </span>
              ),
            },
            {
              key: 'soc',
              label: tr('common.company'),
              render: (p) => (isAdmin ? <span id={`Projects.project.${p.id}.soc`}>{p.soc?.name ?? '—'}</span> : <span id={`Projects.project.${p.id}.soc`}>—</span>),
            },
            {
              key: 'active',
              label: tr('common.status'),
              render: (p) => (
                <Badge kind={p.active ? 'success' : 'muted'} id={`Projects.project.${p.id}.active`}>{p.active ? tr('common.active') : tr('common.inactive')}</Badge>
              ),
            },
            {
              key: 'actions',
              label: '',
              render: (p) =>
                canEdit ? (
                  <div className="flex justify-end gap-1">
                    <IconButton
                      icon="edit"
                      label={tr('common.edit')}
                      onClick={(e) => { e.stopPropagation(); openEdit(p) }} id={`Projects.project.${p.id}.edit`} />
                    <IconButton
                      icon="delete"
                      label={tr('common.delete')}
                      variant="danger"
                      onClick={(e) => { e.stopPropagation(); handleDelete(p) }} id={`Projects.project.${p.id}.delete`} />
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
        title={editing ? `${tr('common.edit')} ${editing.name}` : tr('Projects.nouveau.projet')}
        titleId="Projects.modal.title"
        footer={
          <>
            <IconButton icon="cancel" label={tr('common.cancel')} onClick={() => setModalOpen(false)} id="common.cancel" />
            <IconButton
              icon={editing ? 'save' : 'add'}
              label={editing ? tr('common.save') : tr('common.create')}
              variant="primary"
              onClick={handleSubmit as never}
              disabled={submitting} loading={submitting}
              id={editing ? 'common.save' : 'common.create'}
            />
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div id="Projects.formError" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {formError}
            </div>
          )}
          <Field label={tr('Projects.nom.du.projet')} id="Projects.nom.du.projet">
            <Input id="Projects.nom.du.projet.input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label={tr('Projects.description')} id="Projects.description">
            <Textarea
              id="Projects.description.textarea"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={tr('Projects.client')} id="Projects.client">
              <Select
                id="Projects.client.select"
                value={form.clientId}
                onChange={(e) => setForm({ ...form, clientId: e.target.value })}
              >
                <option id="Projects.selectionner" value="">{tr('Projects.selectionner')}</option>
                {(clients ?? []).map((c) => (
                  <option key={c.id} id={`Projects.client.select.option.${c.id}`} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            {isAdmin && (
              <Field label={tr('Projects.societe')} id="Projects.societe">
                <Select
                  id="Projects.societe.select"
                  value={form.socId}
                  onChange={(e) => setForm({ ...form, socId: e.target.value })}
                >
                  <option id="Projects.selectionner.2" value="">{tr('Projects.selectionner')}</option>
                  {(socs ?? []).map((soc) => (
                    <option key={soc.id} id={`Projects.societe.select.option.${soc.id}`} value={soc.id}>
                      {soc.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={tr('Projects.debut')} id="Projects.debut">
              <Input
                id="Projects.debut.input"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </Field>
            <Field label={tr('Projects.fin')} id="Projects.fin">
              <Input
                id="Projects.fin.input"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={tr('Projects.tjm')} id="Projects.tjm">
              <Input
                id="Projects.tjm.input"
                type="number"
                step="0.01"
                min="0"
                value={form.dailyRate}
                onChange={(e) => setForm({ ...form, dailyRate: e.target.value })}
              />
            </Field>
            <Field label={tr('Projects.devise')} id="Projects.devise">
              <Select
                id="Projects.devise.select"
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              >
                <option id="Projects.eur" value="EUR">{tr('Projects.eur')}</option>
                <option id="Projects.usd" value="USD">{tr('Projects.usd')}</option>
                <option id="Projects.chf" value="CHF">{tr('Projects.chf')}</option>
              </Select>
            </Field>
          </div>
          <label id="Projects.projet.actif" className="flex items-center gap-2 text-sm text-gray-700">
            <input
              id="Projects.projet.actif.checkbox"
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
