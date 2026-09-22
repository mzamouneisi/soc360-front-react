import { tr } from '../i18n/translate'
import { useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useSoc } from '../soc/SocContext'
import { AddSocModal } from '../soc/AddSocModal'
import { socsApi, type DemoSocDto, type SocDependency } from '../api/socs'
import { ApiError } from '../api/client'
import type { AddSocPayload, SocDto, SocLiteDto } from '../api/types'
import { useAsync } from '../lib/useAsync'
import { Button, Field, Input, InlineButton, RefreshButton, Spinner, Textarea } from '../components/ui'
import { Badge, EmptyState, ErrorBlock, LoadingBlock, Modal, PageHeader, Table } from '../components/data'
import { dialog } from '../components/dialog'

interface EditForm {
  name: string
  description: string
  infosWeb: string
  siret: string
  codeNaf: string
  urssaf: string
  gerant: string
  categorieEntreprise: string
  dateCreation: string
  dateFermeture: string
  website: string
  street: string
  zipCode: string
  city: string
  country: string
}

const DEPENDENCY_LABELS: Record<string, string> = {
  client: 'Client',
  supplier: 'Fournisseur',
  project: 'Projet',
  consultant: 'Consultant',
  activity: 'Activité',
  activity_type: "Type d'activité",
  subscription: 'Abonnement',
}

export function SocAdmin({ scope = 'mine' }: { scope?: 'mine' | 'all' }) {
  const { user } = useAuth()
  const { socs: userSocs } = useSoc()
  const isAdmin = user?.role === 'ADMIN'

  const { data: socs, loading, error, reload, setData } = useAsync(() => socsApi.findAll(), [])
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editingForm, setEditingForm] = useState<{ soc: SocDto; form: EditForm } | null>(null)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<SocDto | null>(null)
  const [dependencies, setDependencies] = useState<SocDependency[]>([])
  const [dependencyLoading, setDependencyLoading] = useState(false)
  const [demoCreating, setDemoCreating] = useState(false)
  const [demoResult, setDemoResult] = useState<DemoSocDto | null>(null)

  const mine = scope === 'mine' && !isAdmin

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = socs ?? []
    if (mine) {
      const mineIds = new Set(userSocs.map((s) => s.id))
      list = list.filter((s) => mineIds.has(s.id))
    }
    if (!q) return list
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.siret ?? '').toLowerCase().includes(q) ||
        (s.gerant ?? '').toLowerCase().includes(q),
    )
  }, [socs, search, mine, userSocs])

  const canManage = (soc: SocDto) => isAdmin || userSocs.some((s) => s.id === soc.id)

  async function createSoc(payload: AddSocPayload): Promise<SocLiteDto> {
    const soc = await socsApi.create({
      name: payload.socName,
      description: payload.description ?? null,
      infosWeb: payload.infosWeb ?? null,
      siret: payload.siret ?? null,
      codeNaf: payload.codeNaf ?? null,
      urssaf: payload.urssaf ?? null,
      gerant: payload.gerant ?? null,
      categorieEntreprise: payload.categorieEntreprise ?? null,
      dateCreation: payload.dateCreation ?? null,
      dateFermeture: payload.dateFermeture ?? null,
      website: payload.website ?? null,
      address:
        payload.street || payload.zipCode || payload.city || payload.country
          ? {
              street: payload.street ?? null,
              zipCode: payload.zipCode ?? null,
              city: payload.city ?? null,
              country: payload.country ?? null,
            }
          : null,
    })
    return { id: soc.id, name: soc.name }
  }

  async function createDemoSoc() {
    setActionError(null)
    setDemoCreating(true)
    try {
      const demo = await socsApi.createDemo()
      setDemoResult(demo)
      reload()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Impossible de créer la société démo')
    } finally {
      setDemoCreating(false)
    }
  }

  function openEdit(soc: SocDto) {
    setActionError(null)
    setEditingForm({
      soc,
      form: {
        name: soc.name,
        description: soc.description ?? '',
        infosWeb: soc.infosWeb ?? '',
        siret: soc.siret ?? '',
        codeNaf: soc.codeNaf ?? '',
        urssaf: soc.urssaf ?? '',
        gerant: soc.gerant ?? '',
        categorieEntreprise: soc.categorieEntreprise ?? '',
        dateCreation: soc.dateCreation ?? '',
        dateFermeture: soc.dateFermeture ?? '',
        website: soc.website ?? '',
        street: soc.address?.street ?? '',
        zipCode: soc.address?.zipCode ?? '',
        city: soc.address?.city ?? '',
        country: soc.address?.country ?? '',
      },
    })
  }

  async function saveEdit() {
    if (!editingForm) return
    const f = editingForm.form
    if (!f.name.trim()) {
      setActionError('Le nom de la société est obligatoire')
      return
    }
    setSaving(true)
    setActionError(null)
    try {
      const saved = await socsApi.update(editingForm.soc.id, {
        name: f.name.trim(),
        description: f.description.trim() || null,
        infosWeb: f.infosWeb.trim() || null,
        siret: f.siret.trim() || null,
        codeNaf: f.codeNaf.trim() || null,
        urssaf: f.urssaf.trim() || null,
        gerant: f.gerant.trim() || null,
        categorieEntreprise: f.categorieEntreprise.trim() || null,
        dateCreation: f.dateCreation || null,
        dateFermeture: f.dateFermeture || null,
        website: f.website.trim() || null,
        address: {
          street: f.street.trim() || null,
          zipCode: f.zipCode.trim() || null,
          city: f.city.trim() || null,
          country: f.country.trim() || null,
        },
      })
      setData((prev) => (prev ?? []).map((s) => (s.id === saved.id ? saved : s)))
      setEditingForm(null)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Impossible de modifier la société')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(soc: SocDto) {
    setActionError(null)
    if (!(await dialog.confirm(`Supprimer la société « ${soc.name} » ?`, { variant: 'warning', danger: true, okLabel: 'Supprimer' }))) return
    setDependencyLoading(true)
    try {
      const linked = await socsApi.dependencies(soc.id)
      const consultant = linked.find((d) => d.type === 'consultant')
      if (consultant) {
        setActionError(`Impossible de supprimer : la société est utilisée par des consultants (« ${consultant.label} »).`)
        return
      }
      if (linked.length > 0) {
        setDeleting(soc)
        setDependencies(linked)
        return
      }
      await socsApi.remove(soc.id)
      setData((prev) => (prev ?? []).filter((s) => s.id !== soc.id))
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Impossible de supprimer la société')
    } finally {
      setDependencyLoading(false)
    }
  }

  async function confirmDeleteAll() {
    if (!deleting) return
    setDependencyLoading(true)
    setActionError(null)
    try {
      await socsApi.removeWithDependencies(deleting.id)
      setData((prev) => (prev ?? []).filter((s) => s.id !== deleting.id))
      setDeleting(null)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Impossible de supprimer la société')
    } finally {
      setDependencyLoading(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={scope === 'mine' ? 'Mes sociétés' : 'Toutes les sociétés'}
        subtitle={
          scope === 'mine'
            ? isAdmin
              ? "Toutes les sociétés de l'application (vue administrateur)"
              : 'Les sociétés liées à votre compte'
            : "Toutes les sociétés de l'application"
        }
        actions={
          <>
            <RefreshButton onClick={reload} />
            <Button className="w-auto" onClick={() => setAddOpen(true)}>
              + Nouvelle société
            </Button>
            {isAdmin && (
              <Button className="w-auto" variant="yellow" onClick={() => void createDemoSoc()} disabled={demoCreating}>
                {demoCreating ? <Spinner className="border-white border-t-transparent" /> : null}
                + Société démo
              </Button>
            )}
          </>
        }
      />

      {error && <ErrorBlock message={error} />}
      {actionError && <div className="mb-4"><ErrorBlock message={actionError} /></div>}
      {loading && <LoadingBlock />}

      {!loading && socs && socs.length > 0 && (
        <div className="mb-4">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr('SocAdmin.rechercher.par.nom.siret.ou.gerant')}
            className="max-w-md"
          />
        </div>
      )}

      {!loading && socs !== null && filtered.length === 0 && (
        <EmptyState
          title={search ? 'Aucun résultat' : 'Aucune société'}
          description={
            search
              ? 'Aucune société ne correspond à votre recherche.'
              : 'Aucune société enregistrée sur la plateforme.'
          }
        />
      )}

      {!loading && filtered.length > 0 && (
        <Table
          paginate
          rowKey={(s) => s.id}
          rows={filtered}
          columns={[
            {
              key: 'name',
              label: 'Société',
              render: (s) => <span className="font-medium text-gray-900">{s.name}</span>,
            },
            {
              key: 'siret',
              label: 'SIRET',
              render: (s) => <span className="text-gray-600">{s.siret ?? '—'}</span>,
            },
            {
              key: 'gerant',
              label: 'Gérant',
              render: (s) => <span className="text-gray-600">{s.gerant ?? '—'}</span>,
            },
            {
              key: 'ville',
              label: 'Ville',
              render: (s) => <span className="text-gray-600">{s.address?.city ?? '—'}</span>,
            },
            {
              key: 'status',
              label: 'Géré par moi',
              render: (s) =>
                canManage(s) ? (
                  <Badge kind="success">Oui</Badge>
                ) : (
                  <Badge kind="muted">Non</Badge>
                ),
            },
            {
              key: 'actions',
              label: '',
              render: (s) =>
                canManage(s) ? (
                  <div className="flex justify-end gap-1">
                    <InlineButton
                      onClick={(e) => {
                        e.stopPropagation()
                        openEdit(s)
                      }}
                    >
                      Modifier
                    </InlineButton>
                    <InlineButton
                      className="text-red-600 hover:bg-red-50"
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleDelete(s)
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

      <AddSocModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        submit={isAdmin ? createSoc : undefined}
        onCreated={() => reload()}
        defaultMine={scope === 'mine'}
      />

      {editingForm && (
        <Modal
          open
          onClose={() => setEditingForm(null)}
          title={`Modifier ${editingForm.soc.name}`}
          size="lg"
          footer={
            <>
              <Button type="button" className="!w-auto !bg-gray-100 !text-gray-700 hover:!bg-gray-200" onClick={() => setEditingForm(null)}>
                Annuler
              </Button>
              <Button type="button" disabled={saving} onClick={() => void saveEdit()} className="!w-auto">
                {saving ? <Spinner className="border-white border-t-transparent" /> : null}
                Enregistrer
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={tr('SocAdmin.nom.de.la.societe')}>
              <Input value={editingForm.form.name} onChange={(e) => setEditingForm({ ...editingForm, form: { ...editingForm.form, name: e.target.value } })} />
            </Field>
            <Field label={tr('SocAdmin.siret')}>
              <Input value={editingForm.form.siret} onChange={(e) => setEditingForm({ ...editingForm, form: { ...editingForm.form, siret: e.target.value } })} />
            </Field>
            <Field label={tr('SocAdmin.gerant')}>
              <Input value={editingForm.form.gerant} onChange={(e) => setEditingForm({ ...editingForm, form: { ...editingForm.form, gerant: e.target.value } })} />
            </Field>
            <Field label={tr('SocAdmin.code.naf')}>
              <Input value={editingForm.form.codeNaf} onChange={(e) => setEditingForm({ ...editingForm, form: { ...editingForm.form, codeNaf: e.target.value } })} />
            </Field>
            <Field label={tr('SocAdmin.urssaf')}>
              <Input value={editingForm.form.urssaf} onChange={(e) => setEditingForm({ ...editingForm, form: { ...editingForm.form, urssaf: e.target.value } })} />
            </Field>
            <Field label={tr('SocAdmin.categorie.entreprise')}>
              <Input value={editingForm.form.categorieEntreprise} onChange={(e) => setEditingForm({ ...editingForm, form: { ...editingForm.form, categorieEntreprise: e.target.value } })} />
            </Field>
            <Field label={tr('SocAdmin.date.de.creation')}>
              <Input type="date" value={editingForm.form.dateCreation} onChange={(e) => setEditingForm({ ...editingForm, form: { ...editingForm.form, dateCreation: e.target.value } })} />
            </Field>
            <Field label={tr('SocAdmin.date.de.fermeture')}>
              <Input type="date" value={editingForm.form.dateFermeture} onChange={(e) => setEditingForm({ ...editingForm, form: { ...editingForm.form, dateFermeture: e.target.value } })} />
            </Field>
            <Field label={tr('SocAdmin.site.web')}>
              <Input type="url" value={editingForm.form.website} onChange={(e) => setEditingForm({ ...editingForm, form: { ...editingForm.form, website: e.target.value } })} />
            </Field>
            <Field label={tr('SocAdmin.rue')}>
              <Input value={editingForm.form.street} onChange={(e) => setEditingForm({ ...editingForm, form: { ...editingForm.form, street: e.target.value } })} />
            </Field>
            <Field label={tr('SocAdmin.code.postal')}>
              <Input value={editingForm.form.zipCode} onChange={(e) => setEditingForm({ ...editingForm, form: { ...editingForm.form, zipCode: e.target.value } })} />
            </Field>
            <Field label={tr('SocAdmin.ville')}>
              <Input value={editingForm.form.city} onChange={(e) => setEditingForm({ ...editingForm, form: { ...editingForm.form, city: e.target.value } })} />
            </Field>
            <Field label={tr('SocAdmin.pays')}>
              <Input value={editingForm.form.country} onChange={(e) => setEditingForm({ ...editingForm, form: { ...editingForm.form, country: e.target.value } })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label={tr('SocAdmin.description')}>
                <Textarea rows={3} value={editingForm.form.description} onChange={(e) => setEditingForm({ ...editingForm, form: { ...editingForm.form, description: e.target.value } })} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label={tr('SocAdmin.informations.web')}>
                <Textarea rows={3} value={editingForm.form.infosWeb} onChange={(e) => setEditingForm({ ...editingForm, form: { ...editingForm.form, infosWeb: e.target.value } })} />
              </Field>
            </div>
          </div>
        </Modal>
      )}

      {deleting && (
        <Modal
          open
          onClose={() => setDeleting(null)}
          title={`Supprimer la société « ${deleting.name} »`}
          footer={
            <>
              <Button type="button" className="!w-auto !bg-gray-100 !text-gray-700 hover:!bg-gray-200" onClick={() => setDeleting(null)} disabled={dependencyLoading}>
                Annuler
              </Button>
              <Button type="button" className="!w-auto !bg-red-600 hover:!bg-red-700" onClick={() => void confirmDeleteAll()} disabled={dependencyLoading}>
                {dependencyLoading ? <Spinner className="border-white border-t-transparent" /> : null}
                Tout supprimer
              </Button>
            </>
          }
        >
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {tr('SocAdmin.attention.cette.societe.sera.supprimee.avec.tous.ses.objets.')}
          </div>
          <p className="mt-3 text-sm font-medium text-gray-700">{tr('SocAdmin.objets.lies')}{dependencies.length})</p>
          <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
            {dependencies.map((item) => (
              <div key={`${item.type}-${item.id}`} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
                <span className="truncate text-sm text-gray-700">{item.label}</span>
                <span className="ml-auto shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                  {DEPENDENCY_LABELS[item.type] ?? item.type}
                </span>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {demoResult && (
        <Modal
          open
          onClose={() => setDemoResult(null)}
          title={`Société démo ${demoResult.number} créée`}
          footer={
            <Button type="button" className="!w-auto" onClick={() => setDemoResult(null)}>
              Fermer
            </Button>
          }
        >
          <div className="space-y-2 text-sm">
            <Row label={tr('SocAdmin.societe')} value={demoResult.socName} />
            <Row label={tr('SocAdmin.responsable')} value={demoResult.username} />
            <Row label={tr('SocAdmin.mot.de.passe')} value={demoResult.password} />
            <Row label={tr('SocAdmin.client')} value={demoResult.clientName} />
            <Row label={tr('SocAdmin.projet')} value={demoResult.projectName} />
            <Row label={tr('SocAdmin.activite.mission')} value={demoResult.activityName} />
            <Row label={tr('SocAdmin.consultant')} value={demoResult.consultantName} />
          </div>
        </Modal>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-gray-200 px-3 py-2">
      <span className="w-32 shrink-0 font-medium text-gray-500">{label}</span>
      <span className="font-mono text-gray-900">{value}</span>
    </div>
  )
}