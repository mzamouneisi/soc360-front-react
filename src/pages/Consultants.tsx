import { tr } from '../i18n/translate'
import { useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { consultantsApi } from '../api/consultants'
import { socsApi } from '../api/socs'
import { ApiError } from '../api/client'
import { Field, IconButton, InlineButton, Input, RefreshButton, Select, Spinner } from '../components/ui'
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
import { dialog } from '../components/dialog'
import { formatDate, formatDateTime, formatMoney } from '../lib/format'
import { useDynamicTranslate } from '../lib/useDynamicTranslate'
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
  salary: string
  currency: string
  nationality: string
  emergencyContact: string
  socId: string
  managerId: string
  username: string
  password: string
  active: boolean
  address: string
  statutProfessionnel: string
  positionProfessionnelle: string
  coefficient: string
  matricule: string
  modePaiement: string
  employee: boolean
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
  salary: '',
  currency: 'EUR',
  nationality: '',
  emergencyContact: '',
  socId: '',
  managerId: '',
  username: '',
  password: '',
  active: true,
  address: '',
  statutProfessionnel: '',
  positionProfessionnelle: '',
  coefficient: '',
  matricule: '',
  modePaiement: 'Virement',
  employee: true,
}

interface AddressSuggestion {
  id: string
  label: string
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrateur',
  CONSULTANT: 'Consultant',
  MANAGER: 'Manager',
  RESPONSIBLE_SOC: 'Responsable société',
}

export function Consultants() {
  const { user } = useAuth()
  const dt = useDynamicTranslate()
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
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([])
  const [addressSearching, setAddressSearching] = useState(false)
  const [addressSearched, setAddressSearched] = useState(false)

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

  const managerOptions = useMemo(
    () => (managers ?? []).filter((m) => m.id !== editing?.id),
    [managers, editing?.id],
  )

  const roleOptions = useMemo(() => {
    const base = isAdmin || isResponsible
      ? ['CONSULTANT', 'MANAGER', 'RESPONSIBLE_SOC']
      : isManager
        ? ['CONSULTANT', 'MANAGER']
        : []
    return base.includes(form.role) ? base : [form.role, ...base]
  }, [isAdmin, isResponsible, isManager, form.role])

  function openCreate() {
    setForm({
      ...emptyForm,
      role: 'CONSULTANT',
      socId: isAdmin ? '' : String(workingSocId ?? user?.socId ?? ''),
      managerId: isManager && user?.id != null ? String(user.id) : '',
    })
    setEditing(null)
    setFormError(null)
    setAddressSuggestions([])
    setAddressSearched(false)
    setModalOpen(true)
  }

  async function searchAddress() {
    const query = form.address.trim()
    if (query.length < 3) {
      setAddressSuggestions([])
      setAddressSearched(false)
      return
    }
    setAddressSearching(true)
    setAddressSearched(true)
    try {
      const response = await fetch(
        `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5`,
      )
      if (!response.ok) {
        setAddressSuggestions([])
        return
      }
      const payload = (await response.json()) as {
        features?: { properties?: { id?: string; label?: string } }[]
      }
      setAddressSuggestions(
        (payload.features ?? [])
          .map((feature) => feature.properties ?? {})
          .filter((props) => props.label)
          .map((props) => ({ id: props.id ?? props.label ?? '', label: props.label ?? '' })),
      )
    } catch {
      setAddressSuggestions([])
    } finally {
      setAddressSearching(false)
    }
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
      salary: c.salary != null ? String(c.salary) : '',
      currency: c.currency ?? 'EUR',
      nationality: c.nationality ?? '',
      emergencyContact: c.emergencyContact ?? '',
      socId: String(c.socId ?? workingSocId ?? user?.socId ?? ''),
      managerId: c.managerId != null ? String(c.managerId) : '',
      username: c.username ?? '',
      active: c.active,
      address: c.address ?? '',
      statutProfessionnel: c.statutProfessionnel ?? '',
      positionProfessionnelle: c.positionProfessionnelle ?? '',
      coefficient: c.coefficient ?? '',
      matricule: c.matricule ?? '',
      modePaiement: c.modePaiement ?? 'Virement',
      employee: c.employee,
    })
    setEditing(c)
    setFormError(null)
    setAddressSuggestions([])
    setAddressSearched(false)
    setModalOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setFormError(tr('Consultants.prenom.nom.obligatoires'))
      return
    }
    if (!isAdmin && !form.socId.trim()) {
      setFormError(tr('Consultants.selectionner.societe'))
      return
    }
    const creatingPerson = !editing && (form.role === 'MANAGER' || form.role === 'RESPONSIBLE_SOC')
    if (creatingPerson && (!form.username.trim() || !form.email.trim() || !form.password.trim())) {
      setFormError(tr('Consultants.ligne.compte.obligatoire'))
      return
    }
    if ((form.role === 'CONSULTANT' || form.role === 'MANAGER') && !form.managerId) {
      setFormError(tr('Consultants.manager.obligatoire'))
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
        salary: form.salary ? Number(form.salary) : null,
        currency: form.currency || 'EUR',
        nationality: form.nationality || null,
        emergencyContact: form.emergencyContact || null,
        socId: isAdmin ? Number(form.socId) : Number(workingSocId ?? user?.socId ?? 0),
        managerId: form.managerId ? Number(form.managerId) : null,
        username: form.username.trim() || null,
        password: form.password || null,
        role: form.role,
        active: form.active,
        address: form.address.trim() || null,
        statutProfessionnel: form.employee ? form.statutProfessionnel.trim() || null : null,
        positionProfessionnelle: form.employee ? form.positionProfessionnelle.trim() || null : null,
        coefficient: form.employee ? form.coefficient.trim() || null : null,
        matricule: form.employee ? form.matricule.trim() || null : null,
        modePaiement: form.modePaiement.trim() || null,
        employee: form.employee,
      }
      if (editing) {
        await consultantsApi.update(editing.id, payload)
      } else {
        await consultantsApi.create(payload)
      }
      setModalOpen(false)
      reload()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(c: ConsultantDto) {
    if (!(await dialog.confirm(tr('Consultants.supprimer.le.collaborateur', { name: `${c.firstName} ${c.lastName}` }), { variant: 'warning', danger: true, okLabel: tr('common.delete') }))) return
    try {
      await consultantsApi.delete(c.id)
      setData({ ...data!, items: data?.items.filter((x) => x.id !== c.id) ?? [] })
    } catch (err) {
      void dialog.error(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
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
      void dialog.error(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
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
      setImportError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    } finally {
      setImporting(false)
    }
  }

  const loadingOk = useCallback(() => !loading, [loading])

  return (
    <div>
      <PageHeader
        title={tr('Consultants.collaborateurs')}
        count={data?.total ?? 0}
        subtitle={tr('Consultants.gerez.votre.equipe.de.consultants')}
        actions={
          <>
            <RefreshButton onClick={reload} />
            {canCreate ? (
              <>
                <IconButton icon="add" label={tr('Consultants.nouveau.collaborateur')} variant="primary" onClick={openCreate} />
                {canEdit ? (
                  <InlineButton className="ml-2" variant="primary" onClick={() => { setImportOpen(true); setImportError(null); setImportResult(null); setImportFile(null); setForm({ ...emptyForm, socId: isAdmin ? '' : String(workingSocId ?? user?.socId ?? '') }) }}>
                    {tr('common.importCsv')}
                  </InlineButton>
                ) : null}
              </>
            ) : null}
          </>
        }
      />

      <div className="mb-4">
        <Input
          placeholder={tr('Consultants.rechercher.par.nom.email.poste')}
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
            startIndex={data.page * size}
            columns={[
              {
                key: 'name',
                label: tr('Consultants.collaborateur'),
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
                label: tr('Consultants.nom.d.utilisateur'),
                render: (c) => <span className="text-gray-700">@{c.username}</span>,
              },
              {
                key: 'contact',
                label: tr('Consultants.contact'),
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
                label: tr('common.role'),
                render: (c) => (
                  <Badge kind={c.role === 'RESPONSIBLE_SOC' ? 'info' : c.role === 'MANAGER' ? 'warning' : c.role === 'ADMIN' ? 'success' : 'muted'}>
                    {dt(ROLE_LABELS[c.role] ?? c.role)}
                  </Badge>
                ),
              },
              {
                key: 'manager',
                label: tr('Consultants.manager'),
                render: (c) => <span>{c.managerName ?? '—'}</span>,
              },
              {
                key: 'salary',
                label: tr('Consultants.salaire.de.base'),
                render: (c) => (
                  <span>{formatMoney(c.salary, c.currency ?? 'EUR')}</span>
                ),
              },
              {
                key: 'employee',
                label: tr('Consultants.salarie.label'),
                render: (c) => (
                  <Badge kind={c.employee ? 'success' : 'muted'}>
                    {c.employee ? tr('common.yes') : tr('common.no')}
                  </Badge>
                ),
              },
              {
                key: 'hire',
                label: tr('Consultants.date.d.embauche'),
                render: (c) => <span className="text-gray-500">{formatDate(c.hireDate)}</span>,
              },
              {
                key: 'active',
                label: tr('common.status'),
                render: (c) => (
                  <Badge kind={c.active ? 'success' : 'muted'}>
                    {c.active ? tr('common.active') : tr('common.inactive')}
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
                      <IconButton icon="edit" label={tr('common.edit')} variant="primary" onClick={(e) => { e.stopPropagation(); openEdit(c) }} />
                      <IconButton icon="history" label={tr('common.history')} variant="history" onClick={(e) => { e.stopPropagation(); openHistory(c) }} />
                      {!isSelf && c.role !== 'ADMIN' && (
                        <IconButton icon="delete" label={tr('common.delete')} variant="danger" onClick={(e) => { e.stopPropagation(); handleDelete(c) }} />
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
          title={tr('Consultants.aucun.collaborateur')}
          description={tr('Consultants.ajoutez.un.collaborateur.ou.importez.un.fichier.csv')}
        />
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing
          ? `${tr('common.edit')} ${editing.firstName} ${editing.lastName}`
          : form.role === 'RESPONSIBLE_SOC'
            ? tr('Consultants.nouveau.responsable')
            : form.role === 'MANAGER'
              ? tr('Consultants.nouveau.manager')
              : tr('Consultants.nouveau.collaborateur')}
        size="lg"
        footer={
          <>
            <IconButton icon="cancel" label={tr('common.cancel')} onClick={() => setModalOpen(false)} />
            <IconButton icon={editing ? 'save' : 'add'} label={editing ? tr('common.save') : tr('common.create')} variant="primary" className="w-auto" onClick={handleSubmit as never} disabled={submitting} loading={submitting} />
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
            {((!editing && canCreateManager) || (editing && canEdit)) && (
              <Field label={tr('Consultants.type.de.collaborateur')}>
                <Select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value, username: '', password: '' })}
                >
                  {roleOptions.map((r) => (
                    <option key={r} value={r}>
                      {dt(ROLE_LABELS[r] ?? r)}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <div className="flex items-end">
              <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.employee}
                  onChange={(e) => setForm({ ...form, employee: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                {tr('Consultants.salarie.label')}
              </label>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={tr('Consultants.prenom')}>
              <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
            </Field>
            <Field label={tr('Consultants.nom')}>
              <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={tr('Consultants.email')}>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label={tr('Consultants.telephone')}>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
          </div>
          {editing && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={tr('Consultants.nom.d.utilisateur')}>
                <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              </Field>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={tr('Consultants.poste')}>
              <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
            </Field>
            <Field label={tr('Consultants.nationalite')}>
              <Input value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} placeholder={tr('Consultants.fr')} />
            </Field>
          </div>
          <Field label={tr('Consultants.adresse')}>
            <div className="flex items-center gap-2">
              <Input
                value={form.address}
                onChange={(e) => {
                  setForm({ ...form, address: e.target.value })
                  setAddressSuggestions([])
                  setAddressSearched(false)
                }}
                placeholder={tr('Consultants.adresse.placeholder')}
              />
              <InlineButton
                type="button"
                className="shrink-0"
                onClick={() => void searchAddress()}
                disabled={addressSearching}
              >
                {addressSearching ? <Spinner /> : tr('Consultants.adresse.rechercher')}
              </InlineButton>
            </div>
            {addressSuggestions.length > 0 && (
              <ul className="mt-2 divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200">
                {addressSuggestions.map((suggestion) => (
                  <li key={suggestion.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      onClick={() => {
                        setForm({ ...form, address: suggestion.label })
                        setAddressSuggestions([])
                        setAddressSearched(false)
                      }}
                    >
                      {suggestion.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {addressSearched && !addressSearching && addressSuggestions.length === 0 && (
              <p className="mt-1 text-xs text-gray-500">{tr('Consultants.adresse.aucun')}</p>
            )}
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={tr('Consultants.date.d.embauche')}>
              <Input type="date" value={form.hireDate} onChange={(e) => setForm({ ...form, hireDate: e.target.value })} />
            </Field>
            <Field label={tr('Consultants.date.de.naissance')}>
              <Input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={tr('Consultants.n.de.securite.sociale')}>
              <Input value={form.socialNumber} onChange={(e) => setForm({ ...form, socialNumber: e.target.value })} />
            </Field>
            <Field label={tr('Consultants.manager')}>
              <Select value={form.managerId} onChange={(e) => setForm({ ...form, managerId: e.target.value })}>
                <option value="">{tr('Consultants.aucun')}</option>
                {managerOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={form.employee ? tr('Consultants.salaire.de.base') : tr('Consultants.tjm.interne')}>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.salary}
                onChange={(e) => setForm({ ...form, salary: e.target.value })}
              />
            </Field>
            <Field label={tr('Consultants.devise')}>
              <Select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                <option value="EUR">{tr('Consultants.eur')}</option>
                <option value="USD">{tr('Consultants.usd')}</option>
                <option value="CHF">{tr('Consultants.chf')}</option>
              </Select>
            </Field>
          </div>
          <Field label={tr('Consultants.mode.paiement')}>
            <Input
              value={form.modePaiement}
              onChange={(e) => setForm({ ...form, modePaiement: e.target.value })}
            />
          </Field>
          {form.employee && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={tr('Consultants.statut.professionnel')}>
                  <Input
                    value={form.statutProfessionnel}
                    onChange={(e) => setForm({ ...form, statutProfessionnel: e.target.value })}
                  />
                </Field>
                <Field label={tr('Consultants.position')}>
                  <Input
                    value={form.positionProfessionnelle}
                    onChange={(e) => setForm({ ...form, positionProfessionnelle: e.target.value })}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={tr('Consultants.coefficient')}>
                  <Input
                    value={form.coefficient}
                    onChange={(e) => setForm({ ...form, coefficient: e.target.value })}
                  />
                </Field>
                <Field label={tr('Consultants.matricule')}>
                  <Input
                    value={form.matricule}
                    onChange={(e) => setForm({ ...form, matricule: e.target.value })}
                  />
                </Field>
              </div>
            </>
          )}
          {isAdmin && (
            <Field label={tr('Consultants.societe')}>
              <Select value={form.socId} onChange={(e) => setForm({ ...form, socId: e.target.value })}>
                <option value="">{tr('Consultants.selectionner')}</option>
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
                  ? tr('Consultants.compte.utilisateur.obligatoire')
                  : tr('Consultants.compte.utilisateur.optionnel')}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label={tr('Consultants.nom.d.utilisateur')}>
                  <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                </Field>
                <Field label={tr('Consultants.email.de.connexion')}>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </Field>
                <Field label={tr('Consultants.mot.de.passe.initial')}>
                  <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </Field>
              </div>
              <p className="mt-2 text-xs text-brand-700">
                {tr('Consultants.le.collaborateur.devra.changer.son.mot.de.passe.a.la.premier')}
              </p>
            </div>
          )}
        </form>
      </Modal>

      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title={tr('Consultants.importer.des.consultants.csv')}
        footer={
          <>
            <IconButton icon="close" label={tr('common.close')} onClick={() => setImportOpen(false)} />
            <IconButton icon="upload" label={tr('Consultants.importer')} variant="primary" className="w-auto" onClick={handleImport as never} disabled={importing || !importFile} loading={importing} />
          </>
        }
      >
        <form onSubmit={handleImport} className="space-y-4">
          <p className="text-sm text-gray-600">
            {tr('Consultants.format.attendu')} <code className="rounded bg-gray-100 px-1">{tr('Consultants.prenom.nom.email.telephone.poste.dateembauche.aaaa.mm.jj.dat')}</code>
          </p>
          {isAdmin && (
            <Field label={tr('Consultants.societe')}>
              <Select value={form.socId} onChange={(e) => setForm({ ...form, socId: e.target.value })}>
                <option value="">{tr('Consultants.selectionner')}</option>
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
              {importResult.imported} {tr('Consultants.consultant.s.importe.s')} {importResult.errors} {tr('Consultants.erreur.s')}
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
        title={historyFor ? tr('Consultants.historique.de', { name: `${historyFor.firstName} ${historyFor.lastName}` }) : tr('common.history')}
        footer={<IconButton icon="close" label={tr('common.close')} onClick={() => setHistoryOpen(false)} />}
      >
        {historyLoading && <LoadingBlock />}
        {!historyLoading && historyItems.length === 0 && (
          <p className="text-sm text-gray-500">{tr('Consultants.aucune.modification.enregistree')}</p>
        )}
        {historyItems.length > 0 && (
          <ul className="space-y-3">
            {historyItems.map((h) => (
              <li key={h.id} className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">
                    {h.action === 'CREATE' ? tr('Consultants.creation') : h.action === 'UPDATE' ? tr('Consultants.modification') : tr('Consultants.suppression')}
                  </span>
                  <span className="text-xs text-gray-500">{h.dateMaj ? formatDateTime(h.dateMaj) : ''}</span>
                </div>
                <p className="mt-1 text-xs text-gray-600">
                  {tr('Consultants.par')} {h.userName ?? '—'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  )
}
