import { tr } from '../i18n/translate'
import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { activityTypesApi } from '../api/activities'
import { ApiError } from '../api/client'
import { useAsync } from '../lib/useAsync'
import { useSoc } from '../soc/SocContext'
import { Button, Field, InlineButton, Input, RefreshButton, Spinner } from '../components/ui'
import { Badge, EmptyState, ErrorBlock, LoadingBlock, Modal, PageHeader, Table } from '../components/data'
import type { ActivityTypeDto, ActivityTypeRequest } from '../api/types'

interface TypeFormState {
  id: number | null
  code: string
  labelFr: string
  labelEn: string
  color: string
}

const emptyTypeForm: TypeFormState = { id: null, code: '', labelFr: '', labelEn: '', color: '#3b82f6' }

export function ActivityTypes() {
  const { user } = useAuth()
  const { selectedSocId } = useSoc()
  const canEdit = user?.role === 'ADMIN' || user?.role === 'RESPONSIBLE_SOC'
  const workingSocId = selectedSocId ?? user?.socId ?? null

  const { data, loading, error, reload } = useAsync(
    () => (workingSocId ? activityTypesApi.findAll(workingSocId, { all: true }) : Promise.resolve([] as ActivityTypeDto[])),
    [workingSocId],
  )

  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<TypeFormState>(emptyTypeForm)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  if (!user) return null

  const filtered = (data ?? []).filter((t) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return t.labelFr.toLowerCase().includes(q) || (t.code ?? '').toLowerCase().includes(q)
  })

  function openCreate() {
    setForm(emptyTypeForm)
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(t: ActivityTypeDto) {
    setForm({
      id: t.id,
      code: t.code,
      labelFr: t.labelFr,
      labelEn: t.labelEn ?? '',
      color: t.color ?? '#3b82f6',
    })
    setFormError(null)
    setModalOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.code.trim() || !form.labelFr.trim()) {
      setFormError('Code et libellé sont obligatoires')
      return
    }
    if (!workingSocId) {
      setFormError('Aucune société associée à votre compte')
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      const body: ActivityTypeRequest = {
        socId: workingSocId,
        code: form.code.trim().toUpperCase(),
        labelFr: form.labelFr.trim(),
        labelEn: form.labelEn.trim() || null,
        color: form.color || null,
        active: true,
      }
      if (form.id != null) {
        await activityTypesApi.update(form.id, body)
      } else {
        await activityTypesApi.create(body)
      }
      setModalOpen(false)
      await reload()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Erreur inattendue')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleActive(t: ActivityTypeDto) {
    const action = t.active ? 'Désactiver' : 'Réactiver'
    if (!window.confirm(`${action} le type « ${t.labelFr} » ?`)) return
    try {
      await activityTypesApi.update(t.id, {
        socId: t.socId,
        code: t.code,
        labelFr: t.labelFr,
        labelEn: t.labelEn ?? null,
        color: t.color ?? null,
        active: !t.active,
      })
      await reload()
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : 'Erreur inattendue')
    }
  }

  async function handleDelete(t: ActivityTypeDto) {
    if (!window.confirm(`Supprimer définitivement le type « ${t.labelFr} » ?`)) return
    try {
      await activityTypesApi.delete(t.id)
      await reload()
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : 'Erreur inattendue')
    }
  }

  return (
    <div>
      <PageHeader
        title={tr('ActivityTypes.types.d.activites')}
        subtitle={tr('ActivityTypes.types.de.prestations.utilises.dans.les.activites.et.les.cra')}
        actions={
          <>
            <RefreshButton onClick={reload} />
            {canEdit && workingSocId ? (
              <Button className="w-auto" onClick={openCreate}>
                + Nouveau type
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-6 max-w-sm">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tr('ActivityTypes.rechercher.un.type')}
          aria-label={tr('ActivityTypes.rechercher.un.type.2')}
        />
      </div>

      {error && <ErrorBlock message={error} />}
      {loading && <LoadingBlock />}

      {!loading && data && data.length > 0 && (
        <Table
          paginate
          rowKey={(t) => t.id}
          rows={filtered}
          onRowClick={canEdit ? openEdit : undefined}
          columns={[
            {
              key: 'name',
              label: 'Type',
              render: (t) => (
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: t.color ?? '#94a3b8' }}
                  />
                  <div>
                    <p className="font-medium text-gray-900">{t.labelFr}</p>
                    {t.labelEn && <p className="text-xs text-gray-500">{t.labelEn}</p>}
                  </div>
                </div>
              ),
            },
            {
              key: 'code',
              label: 'Code',
              render: (t) => <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">{t.code}</code>,
            },
            {
              key: 'soc',
              label: 'Société',
              render: (t) => <span className="text-gray-500">{t.socName ?? '—'}</span>,
            },
            {
              key: 'active',
              label: 'Statut',
              render: (t) => (
                <Badge kind={t.active ? 'success' : 'muted'}>{t.active ? 'Actif' : 'Inactif'}</Badge>
              ),
            },
            {
              key: 'actions',
              label: '',
              render: (t) =>
                canEdit ? (
                  <div className="flex justify-end gap-1">
                    <InlineButton
                      onClick={(e) => {
                        e.stopPropagation()
                        openEdit(t)
                      }}
                    >
                      Modifier
                    </InlineButton>
                    <InlineButton onClick={() => handleToggleActive(t)}>
                      {t.active ? 'Désactiver' : 'Réactiver'}
                    </InlineButton>
                    <InlineButton
                      className="text-red-600 hover:bg-red-50"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(t)
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
        <EmptyState title={tr('ActivityTypes.aucun.resultat')} description={tr('ActivityTypes.aucun.type.ne.correspond.a.la.recherche')} />
      )}

      {!loading && data && data.length === 0 && (
        <EmptyState
          title={tr('ActivityTypes.aucun.type.d.activite')}
          description={tr('ActivityTypes.creez.des.types.de.prestations.pour.vos.activites.et.vos.cra')}
          action={
            canEdit && workingSocId ? (
              <Button className="w-auto" onClick={openCreate}>
                + Nouveau type
              </Button>
            ) : undefined
          }
        />
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.id != null ? 'Modifier le type' : 'Nouveau type d’activité'}
        footer={
          <>
            <InlineButton onClick={() => setModalOpen(false)}>Annuler</InlineButton>
            <Button className="w-auto" onClick={handleSubmit as never} disabled={submitting}>
              {submitting ? <Spinner className="border-white border-t-transparent" /> : null}
              {form.id != null ? 'Enregistrer' : 'Créer'}
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={tr('ActivityTypes.code')}>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder={tr('ActivityTypes.mission')}
              />
            </Field>
            <Field label={tr('ActivityTypes.libelle.fr')}>
              <Input
                value={form.labelFr}
                onChange={(e) => setForm({ ...form, labelFr: e.target.value })}
                placeholder={tr('ActivityTypes.mission.2')}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={tr('ActivityTypes.libelle.en')}>
              <Input
                value={form.labelEn}
                onChange={(e) => setForm({ ...form, labelEn: e.target.value })}
                placeholder={tr('ActivityTypes.mission.2')}
              />
            </Field>
            <Field label={tr('ActivityTypes.couleur')}>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="h-9 w-12 cursor-pointer rounded border border-gray-300"
                />
                <Input
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="max-w-[8rem]"
                />
              </div>
            </Field>
          </div>
        </form>
      </Modal>
    </div>
  )
}