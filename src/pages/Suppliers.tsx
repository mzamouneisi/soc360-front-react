import { tr } from '../i18n/translate'
import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { suppliersApi } from '../api/suppliers'
import { socsApi } from '../api/socs'
import { ApiError } from '../api/client'
import type { CompanyLookup } from '../api/auth'
import { useAsync } from '../lib/useAsync'
import { Button, Field, Input, InlineButton, RefreshButton, Select, Spinner, Textarea } from '../components/ui'
import { Badge, EmptyState, ErrorBlock, LoadingBlock, Modal, PageHeader, Table } from '../components/data'
import { dialog } from '../components/dialog'
import { useSoc } from '../soc/SocContext'
import { socToCompanyLookup } from '../soc/socLookup'
import type { SupplierDto } from '../api/types'

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

export function Suppliers() {
  const { user } = useAuth()
  const { selectedSocId, socs } = useSoc()
  const isAdmin = user?.role === 'ADMIN'
  const canEdit = user?.role === 'ADMIN' || user?.role === 'RESPONSIBLE_SOC'

  const { data, loading, error, reload, setData } = useAsync(
    () => suppliersApi.findAll(selectedSocId ?? user?.socId ?? undefined),
    [selectedSocId, user?.socId],
  )
  const { data: allSocs } = useAsync(() => socsApi.findAll(), [])
  const parentSocs = isAdmin ? (allSocs ?? []) : (socs ?? [])

  const [editing, setEditing] = useState<SupplierDto | null>(null)
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

  function openEdit(supplier: SupplierDto) {
    setForm({
      name: supplier.name,
      contactName: supplier.contactName ?? '',
      contactEmail: supplier.contactEmail ?? '',
      contactPhone: supplier.contactPhone ?? '',
      notes: supplier.notes ?? '',
      socId: String(supplier.soc?.id ?? ''),
      socParentId: String(supplier.socParent?.id ?? (isAdmin ? '' : selectedSocId ?? user?.socId ?? '')),
      active: supplier.active,
    })
    setEditing(supplier)
    setFormError(null)
    setModalOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      setFormError('Le nom du fournisseur est obligatoire')
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
        await suppliersApi.update(editing.id, payload)
      } else {
        await suppliersApi.create(payload)
      }
      setModalOpen(false)
      reload()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Erreur inattendue')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(supplier: SupplierDto) {
    if (!(await dialog.confirm(`Supprimer le fournisseur « ${supplier.name} » ?`, { variant: 'warning', danger: true, okLabel: 'Supprimer' }))) return
    try {
      await suppliersApi.delete(supplier.id)
      setData((data ?? []).filter((s) => s.id !== supplier.id))
    } catch (err) {
      void dialog.error(err instanceof ApiError ? err.message : 'Erreur inattendue')
    }
  }

  return (
    <div>
      <PageHeader
        title={tr('Suppliers.fournisseurs')}
        subtitle={tr('Suppliers.gerez.vos.fournisseurs.et.vos.contacts')}
        actions={
          <>
            <RefreshButton onClick={reload} />
            {canEdit ? (
              <Button className="w-auto" onClick={openCreate}>
                + Nouveau fournisseur
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
          rowKey={(s) => s.id}
          onRowClick={canEdit ? openEdit : undefined}
          rows={data}
          columns={[
            {
              key: 'name',
              label: 'Fournisseur',
              render: (s) => <span className="font-medium text-gray-900">{s.name}</span>,
            },
            {
              key: 'contact',
              label: 'Contact',
              render: (s) => (
                <div>
                  {s.contactName ? <p className="text-gray-900">{s.contactName}</p> : null}
                  {s.contactEmail && <p className="text-xs text-gray-500">{s.contactEmail}</p>}
                  {s.contactPhone && <p className="text-xs text-gray-500">{s.contactPhone}</p>}
                  {!s.contactName && !s.contactEmail && <span className="text-gray-400">—</span>}
                </div>
              ),
            },
            {
              key: 'soc',
              label: 'Société associée',
              render: (s) => <span>{s.soc?.name ?? '—'}</span>,
            },
            {
              key: 'socParent',
              label: 'Société parente',
              render: (s) => <span>{s.socParent?.name ?? '—'}</span>,
            },
            {
              key: 'notes',
              label: 'Notes',
              render: (s) => (
                <span className="line-clamp-2 max-w-56 text-xs text-gray-500">{s.notes ?? '—'}</span>
              ),
            },
            {
              key: 'active',
              label: 'Statut',
              render: (s) => (
                <Badge kind={s.active ? 'success' : 'muted'}>{s.active ? 'Actif' : 'Inactif'}</Badge>
              ),
            },
            {
              key: 'actions',
              label: '',
              render: (s) =>
                canEdit ? (
                  <div className="flex justify-end gap-1">
                    <InlineButton onClick={(e) => { e.stopPropagation(); openEdit(s) }}>
                      Modifier
                    </InlineButton>
                    <InlineButton
                      className="text-red-600 hover:bg-red-50"
                      onClick={(e) => { e.stopPropagation(); handleDelete(s) }}
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
          title={tr('Suppliers.aucun.fournisseur')}
          description={tr('Suppliers.ajoutez.votre.premier.fournisseur.pour.commencer')}
        />
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Modifier ${editing.name}` : 'Nouveau fournisseur'}
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
            <Field label={tr('Suppliers.societe.associee')}>
              <Select value={form.socId} onChange={(e) => void selectCompany(e.target.value)}>
                <option value="">{tr('Suppliers.selectionner')}</option>
                {(allSocs ?? []).map((soc) => <option key={soc.id} value={soc.id}>{soc.name}</option>)}
              </Select>
            </Field>
            <Field label={isAdmin ? 'Société parente' : 'Société parente (société de travail)'}>
              <Select value={form.socParentId} onChange={(e) => setForm({ ...form, socParentId: e.target.value })}>
                <option value="">{tr('Suppliers.aucune')}</option>
                {parentSocs.map((soc) => <option key={soc.id} value={soc.id}>{soc.name}</option>)}
              </Select>
            </Field>
          </div>
          <Field label={tr('Suppliers.nom.du.fournisseur')}>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label={tr('Suppliers.notes.infos.specifiques.pour.votre.societe')}>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder={tr('Suppliers.conditions.particulieres.interlocuteurs.remarques')}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={tr('Suppliers.contact')}>
              <Input
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
              />
            </Field>
            <Field label={tr('Suppliers.telephone')}>
              <Input
                value={form.contactPhone}
                onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
              />
            </Field>
          </div>
          <Field label={tr('Suppliers.e.mail.du.contact')}>
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
            {tr('Suppliers.fournisseur.actif')}
          </label>
        </form>
      </Modal>
    </div>
  )
}
