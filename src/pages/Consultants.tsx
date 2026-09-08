import { useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { consultantsApi } from '../api/consultants'
import { socsApi } from '../api/socs'
import { ApiError } from '../api/client'
import { Button, Field, InlineButton, Input, RefreshButton, Select, Spinner } from '../components/ui'
import {
  Badge,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  Modal,
  PageHeader,
  Pagination,
  Table,
} from '../components/data'
import { formatDate, formatMoney } from '../lib/format'
import { useAsync } from '../lib/useAsync'
import type { ConsultantDto, ManagerSummary, HistoConsultantDto } from '../api/types'
import { useCallback, useEffect } from 'react'
import { useSoc } from '../soc/SocContext'

interface FormState {
  role: string
  firstName: string
  lastName: string
  email: string
  phone: string
  position: string
  hireDate: string
  birthDate: string
  socialNumber: string
  baseSalary: string
  currency: string
  nationality: string
  emergencyContact: string
  socId: string
  managerId: string
  username: string
  password: string
  active: boolean
}

const emptyForm: FormState = {
  role: 'CONSULTANT',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  position: '',
  hireDate: '',
  birthDate: '',
  socialNumber: '',
  baseSalary: '',
  currency: 'EUR',
  nationality: '',
  emergencyContact: '',
  socId: '',
  managerId: '',
  username: '',
  password: '',
  active: true,
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrateur',
  CONSULTANT: 'Consultant',
  MANAGER: 'Manager',
  RESPONSIBLE_SOC: 'Responsable société',
}

export function Consultants() {
  const { user } = useAuth()
  const { selectedSocId: workingSocContextId } = useSoc()
  const isAdmin = user?.role === 'ADMIN'
  const isResponsible = user?.role === 'RESPONSIBLE_SOC'
  const isManager = user?.role === 'MANAGER'
  const isConsultant = user?.role === 'CONSULTANT'
  const canEdit = isAdmin || isResponsible || isManager || isConsultant
  const canCreate = isAdmin || isResponsible || isManager
  const canCreateManager = isAdmin || isResponsible
  const workingSocId = isAdmin ? undefined : (workingSocContextId ?? user?.socId ?? undefined)

  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(0)
  const size = user?.pageSize ?? 5

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search)
      setPage(0)
    }, 350)
    return () => clearTimeout(t)
  }, [search])

  const { data, loading, error, reload, setData } = useAsync(
    () =>
      consultantsApi.findAll({
        socId: workingSocId,
        search: debounced || undefined,
        page,
        size,
      }),
    [workingSocId, debounced, page, size],
  )

  const { data: socs } = useAsync(() => (isAdmin ? socsApi.findAll() : Promise.resolve([])), [isAdmin])

  const [editing, setEditing] = useState<ConsultantDto | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [modalOpen, setModalOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [historyFor, setHistoryFor] = useState<ConsultantDto | null>(null)
  const [historyItems, setHistoryItems] = useState<HistoConsultantDto[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)

  const selectedSocId = form.socId ? Number(form.socId) : null
  const { data: managers } = useAsync(
    () =>
      selectedSocId
        ? consultantsApi.managers(selectedSocId)
        : Promise.resolve([] as ManagerSummary[]),
    [selectedSocId],
  )

  const [importFile, setImportFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<{ imported: number; errors: number; errorLines: string[] } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  const managerOptions = useMemo(() => managers ?? [], [managers])

  function openCreate() {
    setForm({
      ...emptyForm,
      role: 'CONSULTANT',
      socId: isAdmin ? '' : String(workingSocId ?? user?.socId ?? ''),
      managerId: isManager && user?.id != null ? String(user.id) : '',
    })
    setEditing(null)
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(c: ConsultantDto) {
    setForm({
      ...emptyForm,
      role: c.role,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email ?? '',
      phone: c.phone ?? '',
      position: c.position ?? '',
      hireDate: c.hireDate ?? '',
      birthDate: c.birthDate ?? '',
      socialNumber: c.socialNumber ?? '',
      baseSalary: c.baseSalary != null ? String(c.baseSalary) : '',
      currency: c.currency ?? 'EUR',
      nationality: c.nationality ?? '',
      emergencyContact: c.emergencyContact ?? '',
      socId: String(c.socId ?? workingSocId ?? user?.socId ?? ''),
      managerId: c.managerId != null ? String(c.managerId) : '',
      username: c.username ?? '',
      active: c.active,
    })
    setEditing(c)
    setFormError(null)
    setModalOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setFormError('Le prénom et le nom sont obligatoires')
      return
    }
    if (!isAdmin && !form.socId.trim()) {
      setFormError('Sélectionnez la société')
      return
    }
    const creatingPerson = !editing && (form.role === 'MANAGER' || form.role === 'RESPONSIBLE_SOC')
    if (creatingPerson && (!form.username.trim() || !form.email.trim() || !form.password.trim())) {
      setFormError('Ligne de compte : nom d’utilisateur, email et mot de passe sont requis')
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim() || null,
        phone: form.phone || null,
        position: form.position || null,
        hireDate: form.hireDate || null,
        birthDate: form.birthDate || null,
        socialNumber: form.socialNumber || null,
        baseSalary: form.baseSalary ? Number(form.baseSalary) : null,
        currency: form.currency || 'EUR',
        nationality: form.nationality || null,
        emergencyContact: form.emergencyContact || null,
        socId: isAdmin ? Number(form.socId) : Number(workingSocId ?? user?.socId ?? 0),
        managerId: form.managerId ? Number(form.managerId) : null,
        username: form.username.trim() || null,
        password: form.password || null,
        role: form.role,
        active: form.active,
      }
      if (editing) {
        await consultantsApi.update(editing.id, payload)
      } else {
        await consultantsApi.create(payload)
      }
      setModalOpen(false)
      reload()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Erreur inattendue')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(c: ConsultantDto) {
    if (!window.confirm(`Supprimer le collaborateur ${c.firstName} ${c.lastName} ?\nLes CRA, notes de frais et documents associés seront supprimés.`)) return
    try {
      await consultantsApi.delete(c.id)
      setData({ ...data!, items: data?.items.filter((x) => x.id !== c.id) ?? [] })
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : 'Erreur inattendue')
    }
  }

  async function openHistory(c: ConsultantDto) {
    setHistoryFor(c)
    setHistoryItems([])
    setHistoryOpen(true)
    setHistoryLoading(true)
    try {
      const items = await consultantsApi.history(c.id)
      setHistoryItems(items)
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : 'Erreur inattendue')
    } finally {
      setHistoryLoading(false)
    }
  }

  async function handleImport(e: FormEvent) {
    e.preventDefault()
    if (!importFile) return
    setImporting(true)
    setImportError(null)
    setImportResult(null)
    try {
      const result = await consultantsApi.importCsv(importFile, Number(isAdmin ? form.socId : workingSocId ?? user?.socId))
      setImportResult(result)
      reload()
    } catch (err) {
      setImportError(err instanceof ApiError ? err.message : 'Erreur inattendue')
    } finally {
      setImporting(false)
    }
  }

  const loadingOk = useCallback(() => !loading, [loading])

  return (
    <div>
      <PageHeader
        title="Collaborateurs"
        subtitle="Gérez votre équipe de consultants"
        actions={
          <>
            <RefreshButton onClick={reload} />
            {canCreate ? (
              <>
                {canEdit ? (
                  <InlineButton onClick={() => { setImportOpen(true); setImportError(null); setImportResult(null); setImportFile(null); setForm({ ...emptyForm, socId: isAdmin ? '' : String(workingSocId ?? user?.socId ?? '') }) }}>
                    Importer CSV
                  </InlineButton>
                ) : null}
                <Button className="w-auto" onClick={openCreate}>
                  + Nouveau collaborateur
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <div className="mb-4">
        <Input
          placeholder="Rechercher par nom, email, poste…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {error && <ErrorBlock message={error} />}
      {loading && <LoadingBlock />}

      {!loading && data && (
        <>
          <Table
            rowKey={(c) => `${c.role}-${c.id}`}
            onRowClick={canEdit ? (c) => openEdit(c) : undefined}
            rows={data.items}
            columns={[
              {
                key: 'name',
                label: 'Collaborateur',
                render: (c) => (
                  <div>
                    <p className="font-medium text-gray-900">
                      {c.firstName} {c.lastName}
                    </p>
                    <p className="text-xs text-gray-500">{c.position ?? '—'}</p>
                  </div>
                ),
              },
              {
                key: 'username',
                label: 'Username',
                render: (c) => <span className="text-gray-700">@{c.username}</span>,
              },
              {
                key: 'contact',
                label: 'Contact',
                render: (c) => (
                  <div>
                    {c.email && <p className="text-gray-700">{c.email}</p>}
                    {c.phone && <p className="text-xs text-gray-500">{c.phone}</p>}
                    {!c.email && !c.phone && <span className="text-gray-400">—</span>}
                  </div>
                ),
              },
              {
                key: 'role',
                label: 'Rôle',
                render: (c) => (
                  <Badge kind={c.role === 'RESPONSIBLE_SOC' ? 'info' : c.role === 'MANAGER' ? 'warning' : c.role === 'ADMIN' ? 'success' : 'muted'}>
                    {ROLE_LABELS[c.role] ?? c.role}
                  </Badge>
                ),
              },
              {
                key: 'manager',
                label: 'Manager',
                render: (c) => <span>{c.managerName ?? '—'}</span>,
              },
              {
                key: 'salary',
                label: 'Salaire',
                render: (c) => (
                  <span>{formatMoney(c.baseSalary, c.currency ?? 'EUR')}</span>
                ),
              },
              {
                key: 'hire',
                label: 'Embauche',
                render: (c) => <span className="text-gray-500">{formatDate(c.hireDate)}</span>,
              },
              {
                key: 'active',
                label: 'Statut',
                render: (c) => (
                  <Badge kind={c.active ? 'success' : 'muted'}>
                    {c.active ? 'Actif' : 'Inactif'}
                  </Badge>
                ),
              },
              {
                key: 'actions',
                label: '',
                render: (c) => {
                  const isSelf = user != null && c.id === user.id
                  if (!canEdit) return <></>
                  return (
                    <div className="flex justify-end gap-1">
                      <InlineButton onClick={(e) => { e.stopPropagation(); openEdit(c) }}>
                        Modifier
                      </InlineButton>
                      <InlineButton
                        className="text-brand-600 hover:bg-brand-50"
                        onClick={(e) => { e.stopPropagation(); openHistory(c) }}
                      >
                        Historique
                      </InlineButton>
                      {!isSelf && c.role !== 'ADMIN' && (
                        <InlineButton
                          className="text-red-600 hover:bg-red-50"
                          onClick={(e) => { e.stopPropagation(); handleDelete(c) }}
                        >
                          Supprimer
                        </InlineButton>
                      )}
                    </div>
                  )
                },
              },
            ]}
          />
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            onChange={setPage}
          />
        </>
      )}

      {!loading && data && data.items.length === 0 && (
        <EmptyState
          title="Aucun collaborateur"
          description="Ajoutez un collaborateur ou importez un fichier CSV."
        />
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing
          ? `Modifier ${editing.firstName} ${editing.lastName}`
          : form.role === 'RESPONSIBLE_SOC'
            ? 'Nouveau responsable société'
            : form.role === 'MANAGER'
              ? 'Nouveau manager'
              : 'Nouveau collaborateur'}
        size="lg"
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
          {((!editing && canCreateManager) || (editing && canEdit)) && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Type de collaborateur">
                <Select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value, username: '', password: '' })}
                >
                  {!editing && <option value="CONSULTANT">Consultant</option>}
                  <option value="MANAGER">Manager</option>
                  <option value="RESPONSIBLE_SOC">Responsable société</option>
                </Select>
              </Field>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Prénom *">
              <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
            </Field>
            <Field label="Nom *">
              <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Email">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Téléphone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
          </div>
          {editing && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nom d'utilisateur">
                <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              </Field>
            </div>
          )}
          {form.role === 'CONSULTANT' && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Poste">
                  <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
                </Field>
                <Field label="Nationalité">
                  <Input value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} placeholder="FR" />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Date d'embauche">
                  <Input type="date" value={form.hireDate} onChange={(e) => setForm({ ...form, hireDate: e.target.value })} />
                </Field>
                <Field label="Date de naissance">
                  <Input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
                </Field>
              </div>
            </>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {form.role === 'CONSULTANT' && (
              <Field label="N° de sécurité sociale">
                <Input value={form.socialNumber} onChange={(e) => setForm({ ...form, socialNumber: e.target.value })} />
              </Field>
            )}
            <Field label="Manager">
              <Select value={form.managerId} onChange={(e) => setForm({ ...form, managerId: e.target.value })}>
                <option value="">Aucun</option>
                {managerOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {form.role === 'CONSULTANT' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Salaire de base">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.baseSalary}
                  onChange={(e) => setForm({ ...form, baseSalary: e.target.value })}
                />
              </Field>
              <Field label="Devise">
                <Select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="CHF">CHF</option>
                </Select>
              </Field>
            </div>
          )}
          {isAdmin && (
            <Field label="Société">
              <Select value={form.socId} onChange={(e) => setForm({ ...form, socId: e.target.value })}>
                <option value="">Sélectionner…</option>
                {(socs ?? []).map((soc) => (
                  <option key={soc.id} value={soc.id}>
                    {soc.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {!editing && (
            <div className="rounded-lg border border-brand-200 bg-brand-50 p-3">
              <p className="mb-2 text-sm font-medium text-brand-800">
                {form.role === 'MANAGER' || form.role === 'RESPONSIBLE_SOC'
                  ? 'Compte utilisateur *'
                  : 'Compte utilisateur (optionnel)'}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Nom d'utilisateur">
                  <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                </Field>
                <Field label="Email de connexion">
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </Field>
                <Field label="Mot de passe initial">
                  <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </Field>
              </div>
              <p className="mt-2 text-xs text-brand-700">
                Le collaborateur devra changer son mot de passe à la première connexion.
              </p>
            </div>
          )}
        </form>
      </Modal>

      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importer des consultants (CSV)"
        footer={
          <>
            <InlineButton onClick={() => setImportOpen(false)}>Fermer</InlineButton>
            <Button className="w-auto" onClick={handleImport as never} disabled={importing || !importFile}>
              {importing ? <Spinner className="border-white border-t-transparent" /> : 'Importer'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleImport} className="space-y-4">
          <p className="text-sm text-gray-600">
            Format attendu : <code className="rounded bg-gray-100 px-1">prénom,nom,email,téléphone,poste,dateEmbauche(AAAA-MM-JJ),dateNaissance,NSS,salaire,devise,nationalité</code>
          </p>
          {isAdmin && (
            <Field label="Société">
              <Select value={form.socId} onChange={(e) => setForm({ ...form, socId: e.target.value })}>
                <option value="">Sélectionner…</option>
                {(socs ?? []).map((soc) => (
                  <option key={soc.id} value={soc.id}>
                    {soc.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-700"
          />
          {importError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {importError}
            </div>
          )}
          {importResult && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
              {importResult.imported} consultant(s) importé(s), {importResult.errors} erreur(s).
              {importResult.errorLines.length > 0 && (
                <ul className="mt-1 list-inside list-disc text-xs">
                  {importResult.errorLines.slice(0, 5).map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {loadingOk() && null}
        </form>
      </Modal>

      <Modal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title={historyFor ? `Historique de ${historyFor.firstName} ${historyFor.lastName}` : 'Historique'}
        footer={<InlineButton onClick={() => setHistoryOpen(false)}>Fermer</InlineButton>}
      >
        {historyLoading && <LoadingBlock />}
        {!historyLoading && historyItems.length === 0 && (
          <p className="text-sm text-gray-500">Aucune modification enregistrée.</p>
        )}
        {historyItems.length > 0 && (
          <ul className="space-y-3">
            {historyItems.map((h) => (
              <li key={h.id} className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">
                    {h.action === 'CREATE' ? 'Création' : h.action === 'UPDATE' ? 'Modification' : 'Suppression'}
                  </span>
                  <span className="text-xs text-gray-500">{h.dateMaj ? new Date(h.dateMaj).toLocaleString('fr-FR') : ''}</span>
                </div>
                <p className="mt-1 text-xs text-gray-600">
                  Par : {h.userName ?? '—'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  )
}
