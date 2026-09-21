import { tr } from '../i18n/translate'
import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { clientsApi } from '../api/clients'
import { socsApi } from '../api/socs'
import { ApiError } from '../api/client'
import type { CompanyLookup } from '../api/auth'
import { useAsync } from '../lib/useAsync'
import { Button, Field, Input, InlineButton, RefreshButton, Select, Spinner, Textarea } from '../components/ui'
import { Badge, EmptyState, ErrorBlock, LoadingBlock, Modal, PageHeader, Table } from '../components/data'
import { useSoc } from '../soc/SocContext'
import { socToCompanyLookup } from '../soc/socLookup'
import type { ClientDto } from '../api/types'

interface FormState {
  name: string
  contactName: string
  contactEmail: string
  contactPhone: string
  notes: string
  socId: string
  socParentId: string
  active: boolean
}

const emptyForm: FormState = {
  name: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  notes: '',
  socId: '',
  socParentId: '',
  active: true,
}

function companyEmail(company: CompanyLookup): string {
  const domain = domainOf(company.website || '')
  return `contact@${domain || (company.name ?? '').toLowerCase().replace(/[^a-z0-9]/gi, '') || 'contact'}`
}

function domainOf(website: string): string {
  try {
    const host = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`).hostname
    return host.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export function Clients() {
  const { user } = useAuth()
  const { selectedSocId, socs } = useSoc()
  const isAdmin = user?.role === 'ADMIN'
  const canEdit = user?.role === 'ADMIN' || user?.role === 'RESPONSIBLE_SOC'

  const { data, loading, error, reload, setData } = useAsync(
    () => clientsApi.findAll(selectedSocId ?? user?.socId ?? undefined),
    [selectedSocId, user?.socId],
  )
  const { data: allSocs } = useAsync(() => socsApi.findAll(), [])
  const parentSocs = isAdmin ? (allSocs ?? []) : (socs ?? [])

  const [editing, setEditing] = useState<ClientDto | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function applyCompany(company: CompanyLookup | null) {
    if (!company) return
    setForm((f) => ({
      ...f,
      name: company.name?.trim() || f.name,
      contactName: company.gerant?.trim() || f.contactName,
      contactEmail: companyEmail(company),
      contactPhone: company.tel?.trim() || f.contactPhone,
    }))
  }

  function selectCompany(value: string) {
    setForm((f) => ({ ...f, socId: value }))
    if (!value) return
    const soc = (allSocs ?? []).find((e) => e.id === Number(value))
    applyCompany(soc ? socToCompanyLookup(soc) : null)
  }

  function openCreate() {
    setForm({ ...emptyForm, socParentId: isAdmin ? '' : String(selectedSocId ?? user?.socId ?? '') })
    setEditing(null)
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(client: ClientDto) {
    setForm({
      name: client.name,
      contactName: client.contactName ?? '',
      contactEmail: client.contactEmail ?? '',
      contactPhone: client.contactPhone ?? '',
      notes: client.notes ?? '',
      socId: String(client.soc?.id ?? ''),
      socParentId: String(client.socParent?.id ?? (isAdmin ? '' : selectedSocId ?? user?.socId ?? '')),
      active: client.active,
    })
    setEditing(client)
    setFormError(null)
    setModalOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      setFormError('Le nom du client est obligatoire')
      return
    }
    if (!form.socId) {
      setFormError('Sélectionnez la société associée')
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      const payload = {
        name: form.name.trim(),
        contactName: form.contactName || null,
        contactEmail: form.contactEmail || null,
        contactPhone: form.contactPhone || null,
        notes: form.notes.trim() || null,
        socId: Number(form.socId),
        socParentId: form.socParentId ? Number(form.socParentId) : null,
        active: form.active,
      }
      if (editing) {
        await clientsApi.update(editing.id, payload)
      } else {
        await clientsApi.create(payload)
      }
      setModalOpen(false)
      reload()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Erreur inattendue')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(client: ClientDto) {
    if (!window.confirm(`Supprimer le client « ${client.name} » ?`)) return
    try {
      await clientsApi.delete(client.id)
      setData((data ?? []).filter((c) => c.id !== client.id))
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : 'Erreur inattendue')
    }
  }

  return (
    <div>
      <PageHeader
        title={tr('Clients.clients')}
        subtitle={tr('Clients.gerez.vos.clients.et.vos.contacts')}
        actions={
          <>
            <RefreshButton onClick={reload} />
            {canEdit ? (
              <Button className="w-auto" onClick={openCreate}>
                + Nouveau client
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
          rowKey={(c) => c.id}
          onRowClick={canEdit ? openEdit : undefined}
          rows={data}
          columns={[
            {
              key: 'name',
              label: 'Client',
              render: (c) => <span className="font-medium text-gray-900">{c.name}</span>,
            },
            {
              key: 'contact',
              label: 'Contact',
              render: (c) => (
                <div>
                  {c.contactName ? <p className="text-gray-900">{c.contactName}</p> : null}
                  {c.contactEmail && <p className="text-xs text-gray-500">{c.contactEmail}</p>}
                  {c.contactPhone && <p className="text-xs text-gray-500">{c.contactPhone}</p>}
                  {!c.contactName && !c.contactEmail && <span className="text-gray-400">—</span>}
                </div>
              ),
            },
            {
              key: 'soc',
              label: 'Société associée',
              render: (c) => <span>{c.soc?.name ?? '—'}</span>,
            },
            {
              key: 'socParent',
              label: 'Société parente',
              render: (c) => <span>{c.socParent?.name ?? '—'}</span>,
            },
            {
              key: 'notes',
              label: 'Notes',
              render: (c) => (
                <span className="line-clamp-2 max-w-56 text-xs text-gray-500">{c.notes ?? '—'}</span>
              ),
            },
            {
              key: 'active',
              label: 'Statut',
              render: (c) => (
                <Badge kind={c.active ? 'success' : 'muted'}>{c.active ? 'Actif' : 'Inactif'}</Badge>
              ),
            },
            {
              key: 'actions',
              label: '',
              render: (c) =>
                canEdit ? (
                  <div className="flex justify-end gap-1">
                    <InlineButton onClick={(e) => { e.stopPropagation(); openEdit(c) }}>
                      Modifier
                    </InlineButton>
                    <InlineButton
                      className="text-red-600 hover:bg-red-50"
                      onClick={(e) => { e.stopPropagation(); handleDelete(c) }}
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
      {!loading && data?.length === 0 && (
        <EmptyState
          title={tr('Clients.aucun.client')}
          description={tr('Clients.ajoutez.votre.premier.client.pour.commencer')}
        />
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Modifier ${editing.name}` : 'Nouveau client'}
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={tr('Clients.societe.associee')}>
              <Select value={form.socId} onChange={(e) => void selectCompany(e.target.value)}>
                <option value="">{tr('Clients.selectionner')}</option>
                {(allSocs ?? []).map((soc) => <option key={soc.id} value={soc.id}>{soc.name}</option>)}
              </Select>
            </Field>
            <Field label={isAdmin ? 'Société parente' : 'Société parente (société de travail)'}>
              <Select value={form.socParentId} onChange={(e) => setForm({ ...form, socParentId: e.target.value })}>
                <option value="">{tr('Clients.aucune')}</option>
                {parentSocs.map((soc) => <option key={soc.id} value={soc.id}>{soc.name}</option>)}
              </Select>
            </Field>
          </div>
          <Field label={tr('Clients.nom.du.client')}>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label={tr('Clients.notes.infos.specifiques.pour.votre.societe')}>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder={tr('Clients.conditions.particulieres.interlocuteurs.remarques')}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={tr('Clients.contact')}>
              <Input
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
              />
            </Field>
            <Field label={tr('Clients.telephone')}>
              <Input
                value={form.contactPhone}
                onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
              />
            </Field>
          </div>
          <Field label={tr('Clients.e.mail.du.contact')}>
            <Input
              type="email"
              value={form.contactEmail}
              onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            {tr('Clients.client.actif')}
          </label>
        </form>
      </Modal>
    </div>
  )
}
