import { tr } from '../i18n/translate'
import { useMemo, useRef, useState, useEffect } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useSoc } from '../soc/SocContext'
import { AddSocModal } from '../soc/AddSocModal'
import { SocLogoField } from '../components/SocLogoField'
import { socsApi, type DemoSocDto, type SocDependency } from '../api/socs'
import { ApiError } from '../api/client'
import type { AddSocPayload, SocDto, SocLiteDto } from '../api/types'
import { useAsync } from '../lib/useAsync'
import { isValidWebsite } from '../lib/validation'
import { findCountrySuggestions, isKnownCountry } from '../lib/countries'
import {
  findCityByPostalCode,
  findPostalCodeByCity,
  findStreetSuggestions,
  frenchCityMatchesPostalCode,
  frenchStreetExists,
  isFranceCountry,
} from '../lib/frenchAddress'
import { Button, Card, Field, IconButton, Input, RefreshButton, Spinner, Textarea } from '../components/ui'
import { Badge, EmptyState, ErrorBlock, LoadingBlock, Modal, PageHeader, Table } from '../components/data'
import { FlagField } from '../components/FlagField'
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

const DEPENDENCY_LABEL_KEYS: Record<string, string> = {
  client: 'SocAdmin.dep.client',
  supplier: 'SocAdmin.dep.fournisseur',
  project: 'SocAdmin.dep.projet',
  consultant: 'SocAdmin.dep.consultant',
  activity: 'SocAdmin.dep.activite',
  activity_type: 'SocAdmin.dep.type.d.activite',
  subscription: 'SocAdmin.dep.abonnement',
}

export function SocAdmin({ scope = 'mine' }: { scope?: 'mine' | 'all' }) {
  const { user } = useAuth()
  const { socs: userSocs, refreshSocs } = useSoc()
  const isAdmin = user?.role === 'ADMIN'

  const { data: socs, loading, error, reload, setData } = useAsync(() => socsApi.findAll(), [])
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editingForm, setEditingForm] = useState<{ soc: SocDto; form: EditForm; readOnly: boolean } | null>(null)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<SocDto | null>(null)
  const [dependencies, setDependencies] = useState<SocDependency[]>([])
  const [dependencyLoading, setDependencyLoading] = useState(false)
  const [demoCreating, setDemoCreating] = useState(false)
  const [demoResult, setDemoResult] = useState<DemoSocDto | null>(null)

  const [cityValid, setCityValid] = useState(false)
  const [streetValid, setStreetValid] = useState(false)
  const [streetSuggestions, setStreetSuggestions] = useState<string[]>([])
  const streetTimer = useRef<number | null>(null)
  const cityVerification = useRef(0)
  const streetVerification = useRef(0)

  const editForm = editingForm?.form ?? null
  const editCountry = editForm?.country ?? ''
  const countrySuggestions = findCountrySuggestions(editCountry)
  const countryValid = isKnownCountry(editCountry)
  const editPostalCode = editForm?.zipCode.trim() ?? ''
  const postalCodeValid = !!editPostalCode && (isFranceCountry(editCountry)
    ? /^\d{5}$/.test(editPostalCode)
    : /^[A-Za-z0-9 \-]{2,20}$/.test(editPostalCode))
  const websiteValid = isValidWebsite(editForm?.website ?? '')

  function resetAddressFlags() {
    cityVerification.current += 1
    streetVerification.current += 1
    setCityValid(false)
    setStreetValid(false)
  }

  function updateEditForm(partial: Partial<EditForm>) {
    setEditingForm((previous) => (previous
      ? { ...previous, form: { ...previous.form, ...partial } }
      : previous))
  }

  async function verifyCity(cityValue?: string, postalValue?: string, countryValue?: string) {
    const city = (cityValue ?? editingForm?.form.city ?? '').trim()
    const postalCode = (postalValue ?? editingForm?.form.zipCode ?? '').trim()
    const country = countryValue ?? editingForm?.form.country ?? ''
    if (!city) {
      setCityValid(false)
      return
    }
    if (!isFranceCountry(country)) {
      setCityValid(true)
      return
    }
    if (!/^\d{5}$/.test(postalCode)) {
      setCityValid(false)
      return
    }
    const requestId = ++cityVerification.current
    const matches = await frenchCityMatchesPostalCode(city, postalCode)
    if (cityVerification.current === requestId) {
      setCityValid(matches)
    }
  }

  async function verifyStreet(streetValue?: string, postalValue?: string, countryValue?: string) {
    const street = (streetValue ?? editingForm?.form.street ?? '').trim()
    const postalCode = (postalValue ?? editingForm?.form.zipCode ?? '').trim()
    const country = countryValue ?? editingForm?.form.country ?? ''
    if (!street) {
      setStreetValid(false)
      return
    }
    if (!isFranceCountry(country)) {
      setStreetValid(true)
      return
    }
    if (!/^\d{5}$/.test(postalCode)) {
      setStreetValid(false)
      return
    }
    const requestId = ++streetVerification.current
    const exists = await frenchStreetExists(street, postalCode)
    if (streetVerification.current === requestId) {
      setStreetValid(exists)
    }
  }

  async function handlePostalCodeChange(value: string) {
    resetAddressFlags()
    setStreetSuggestions([])
    updateEditForm({ zipCode: value })
    if (isFranceCountry(editingForm?.form.country ?? '') && /^\d{5}$/.test(value)) {
      const city = await findCityByPostalCode(value)
      if (city) {
        updateEditForm({ city })
        setCityValid(true)
      }
    }
  }

  async function handleCityBlur() {
    if (!editingForm) return
    const city = editingForm.form.city.trim()
    if (!city) {
      setCityValid(false)
      return
    }
    if (!isFranceCountry(editingForm.form.country)) {
      setCityValid(true)
      return
    }
    let postalCode = editingForm.form.zipCode.trim()
    if (!postalCode) {
      const found = await findPostalCodeByCity(city)
      if (found) {
        postalCode = found
        resetAddressFlags()
        updateEditForm({ zipCode: found })
        setCityValid(true)
        return
      }
    }
    await verifyCity(city, postalCode)
  }

  function handleCityChange(value: string) {
    cityVerification.current += 1
    setCityValid(false)
    updateEditForm({ city: value })
  }

  function handleCountryChange(value: string) {
    const country = value.toUpperCase()
    resetAddressFlags()
    updateEditForm({ country })
    if (!isFranceCountry(country)) {
      setStreetSuggestions([])
    }
  }

  function handleStreetChange(value: string) {
    streetVerification.current += 1
    setStreetValid(false)
    updateEditForm({ street: value })
    if (streetTimer.current) {
      window.clearTimeout(streetTimer.current)
    }
    const country = editingForm?.form.country ?? ''
    const postalCode = editingForm?.form.zipCode.trim() ?? ''
    if (!isFranceCountry(country) || !/^\d{5}$/.test(postalCode) || value.trim().length < 3) {
      setStreetSuggestions([])
      return
    }
    const city = editingForm?.form.city ?? ''
    streetTimer.current = window.setTimeout(() => {
      void findStreetSuggestions(value, postalCode, city).then(setStreetSuggestions)
    }, 300)
  }

  useEffect(() => () => {
    if (streetTimer.current) window.clearTimeout(streetTimer.current)
  }, [])

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
      setActionError(err instanceof ApiError ? err.message : tr('SocAdmin.creation.demo.impossible'))
    } finally {
      setDemoCreating(false)
    }
  }

  function openEdit(soc: SocDto) {
    setActionError(null)
    resetAddressFlags()
    setStreetSuggestions([])
    setEditingForm({
      soc,
      readOnly: !canManage(soc),
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
        country: (soc.address?.country ?? '').toUpperCase(),
      },
    })
    // Vérifie ville/rue dès l'ouverture (adresse déjà enregistrée).
    void verifyCity(soc.address?.city ?? '', soc.address?.zipCode ?? '', soc.address?.country ?? '')
    void verifyStreet(soc.address?.street ?? '', soc.address?.zipCode ?? '', soc.address?.country ?? '')
  }

  async function saveEdit() {
    if (!editingForm) return
    const f = editingForm.form
    if (!f.name.trim()) {
      setActionError(tr('SocAdmin.nom.obligatoire'))
      return
    }
    if (f.website.trim() && !isValidWebsite(f.website)) {
      setActionError(tr('SocAdmin.site.web.invalide'))
      return
    }
    const postalCode = f.zipCode.trim()
    if (postalCode && isFranceCountry(f.country) && !/^\d{5}$/.test(postalCode)) {
      setActionError(tr('SocAdmin.code.postal.invalide'))
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
      setActionError(err instanceof ApiError ? err.message : tr('SocAdmin.modification.impossible'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(soc: SocDto) {
    setActionError(null)
    if (!(await dialog.confirm(tr('SocAdmin.supprimer.la.societe', { name: soc.name }), { variant: 'warning', danger: true, okLabel: tr('common.delete') }))) return
    setDependencyLoading(true)
    try {
      const linked = await socsApi.dependencies(soc.id)
      const consultant = linked.find((d) => d.type === 'consultant')
      if (consultant) {
        setActionError(tr('SocAdmin.suppression.consultants', { name: consultant.label }))
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
      setActionError(err instanceof ApiError ? err.message : tr('SocAdmin.suppression.impossible'))
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
      setActionError(err instanceof ApiError ? err.message : tr('SocAdmin.suppression.impossible'))
    } finally {
      setDependencyLoading(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={scope === 'mine' ? tr('SocAdmin.mes.societes') : tr('SocAdmin.toutes.les.societes')}
        titleId={scope === 'mine' ? 'SocAdmin.mes.societes' : 'SocAdmin.toutes.les.societes'}
        count={socs?.length ?? 0}
        subtitle={
          scope === 'mine'
            ? isAdmin
              ? tr('SocAdmin.toutes.les.societes.admin')
              : tr('SocAdmin.societes.liees')
            : tr('SocAdmin.toutes.les.societes.app')
        }
        subtitleId={
          scope === 'mine'
            ? isAdmin
              ? 'SocAdmin.toutes.les.societes.admin'
              : 'SocAdmin.societes.liees'
            : 'SocAdmin.toutes.les.societes.app'
        }
        actions={
          <>
            <RefreshButton onClick={reload} variant="primary" />
            <IconButton icon="add" label={tr('SocAdmin.nouvelle.societe')} variant="new" onClick={() => setAddOpen(true)} id="SocAdmin.nouvelle.societe" />
            {isAdmin && (
              <IconButton icon="add" label={tr('SocAdmin.societe.demo')} variant="new" onClick={() => void createDemoSoc()} disabled={demoCreating} loading={demoCreating} id="SocAdmin.societe.demo" />
            )}
          </>
        }
      />

      {error && <ErrorBlock message={error} />}
      {actionError && <div className="mb-4"><ErrorBlock id="SocAdmin.actionError" message={actionError} /></div>}
      {loading && <LoadingBlock />}

      {!loading && socs && socs.length > 0 && (
        <div className="mb-4">
          <Input
            id="SocAdmin.rechercher.par.nom.siret.ou.gerant"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr('SocAdmin.rechercher.par.nom.siret.ou.gerant')}
            className="max-w-md"
          />
        </div>
      )}

      {!loading && socs !== null && filtered.length === 0 && (
        <EmptyState
          titleId={search ? 'SocAdmin.aucun.resultat' : 'SocAdmin.aucune.societe'}
          descriptionId={search ? 'SocAdmin.aucune.societe.recherche' : 'SocAdmin.aucune.societe.enregistree'}
          title={search ? tr('SocAdmin.aucun.resultat') : tr('SocAdmin.aucune.societe')}
          description={
            search
              ? tr('SocAdmin.aucune.societe.recherche')
              : tr('SocAdmin.aucune.societe.enregistree')
          }
        />
      )}

      {!loading && filtered.length > 0 && (
        <Table
          paginate
          rowKey={(s) => s.id}
          rows={filtered}
          onRowClick={openEdit}
          columns={[
            {
              key: 'name',
              label: tr('common.company'),
              render: (s) => <span id={`SocAdmin.row.${s.id}.name`} className="font-medium text-gray-900">{s.name}</span>,
            },
            {
              key: 'siret',
              label: tr('SocAdmin.siret'),
              render: (s) => <span id={`SocAdmin.row.${s.id}.siret`} className="text-gray-600">{s.siret ?? '—'}</span>,
            },
            {
              key: 'gerant',
              label: tr('SocAdmin.gerant'),
              render: (s) => <span id={`SocAdmin.row.${s.id}.gerant`} className="text-gray-600">{s.gerant ?? '—'}</span>,
            },
            {
              key: 'ville',
              label: tr('SocAdmin.ville'),
              render: (s) => <span id={`SocAdmin.row.${s.id}.ville`} className="text-gray-600">{s.address?.city ?? '—'}</span>,
            },
            {
              key: 'status',
              label: tr('SocAdmin.gere.par.moi'),
              render: (s) =>
                canManage(s) ? (
                  <Badge id={`SocAdmin.row.${s.id}.managed`} kind="success">{tr('common.yes')}</Badge>
                ) : (
                  <Badge id={`SocAdmin.row.${s.id}.managed`} kind="muted">{tr('common.no')}</Badge>
                ),
            },
            {
              key: 'actions',
              label: '',
              render: (s) =>
                canManage(s) ? (
                  <div className="flex justify-end gap-1">
                    <IconButton
                      icon="edit"
                      label={tr('common.edit')}
                      onClick={(e) => {
                        e.stopPropagation()
                        openEdit(s)
                      }} id={`common.edit.${s.id}`} />
                    <IconButton
                      icon="delete"
                      label={tr('common.delete')}
                      variant="danger"
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleDelete(s)
                      }} id={`common.delete.${s.id}`} />
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
          titleId="SocAdmin.modifier.societe"
          title={tr('SocAdmin.modifier.societe', { name: editingForm.soc.name })}
          size="lg"
          footer={
            editingForm.readOnly ? (
              <IconButton icon="close" label={tr('common.close')} type="button" onClick={() => setEditingForm(null)} id="SocAdmin.detail.fermer" />
            ) : (
              <>
                <IconButton icon="cancel" label={tr('common.cancel')} type="button" onClick={() => setEditingForm(null)} id="common.cancel" />
                <IconButton
                  icon="save"
                  label={tr('common.save')}
                  variant="primary"
                  type="button"
                  disabled={saving} loading={saving}
                  onClick={() => void saveEdit()} id="common.save" />
              </>
            )
          }
        >
          <fieldset disabled={editingForm.readOnly} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={tr('SocAdmin.nom.de.la.societe')} id="SocAdmin.nom.de.la.societe">
              <Input id="SocAdmin.nom.de.la.societe.input" value={editingForm.form.name} onChange={(e) => setEditingForm({ ...editingForm, form: { ...editingForm.form, name: e.target.value } })} />
            </Field>
            <Field label={tr('SocAdmin.siret')} id="SocAdmin.siret">
              <Input id="SocAdmin.siret.input" value={editingForm.form.siret} onChange={(e) => setEditingForm({ ...editingForm, form: { ...editingForm.form, siret: e.target.value } })} />
            </Field>
            <Field label={tr('SocAdmin.gerant')} id="SocAdmin.gerant">
              <Input id="SocAdmin.gerant.input" value={editingForm.form.gerant} onChange={(e) => setEditingForm({ ...editingForm, form: { ...editingForm.form, gerant: e.target.value } })} />
            </Field>
            <Field label={tr('SocAdmin.code.naf')} id="SocAdmin.code.naf">
              <Input id="SocAdmin.code.naf.input" value={editingForm.form.codeNaf} onChange={(e) => setEditingForm({ ...editingForm, form: { ...editingForm.form, codeNaf: e.target.value } })} />
            </Field>
            <Field label={tr('SocAdmin.urssaf')} id="SocAdmin.urssaf">
              <Input id="SocAdmin.urssaf.input" value={editingForm.form.urssaf} onChange={(e) => setEditingForm({ ...editingForm, form: { ...editingForm.form, urssaf: e.target.value } })} />
            </Field>
            <Field label={tr('SocAdmin.categorie.entreprise')} id="SocAdmin.categorie.entreprise">
              <Input id="SocAdmin.categorie.entreprise.input" value={editingForm.form.categorieEntreprise} onChange={(e) => setEditingForm({ ...editingForm, form: { ...editingForm.form, categorieEntreprise: e.target.value } })} />
            </Field>
            <Field label={tr('SocAdmin.date.de.creation')} id="SocAdmin.date.de.creation">
              <Input id="SocAdmin.date.de.creation.input" type="date" value={editingForm.form.dateCreation} onChange={(e) => setEditingForm({ ...editingForm, form: { ...editingForm.form, dateCreation: e.target.value } })} />
            </Field>
            <Field label={tr('SocAdmin.date.de.fermeture')} id="SocAdmin.date.de.fermeture">
              <Input id="SocAdmin.date.de.fermeture.input" type="date" value={editingForm.form.dateFermeture} onChange={(e) => setEditingForm({ ...editingForm, form: { ...editingForm.form, dateFermeture: e.target.value } })} />
            </Field>
            <FlagField label={tr('SocAdmin.site.web')} id="SocAdmin.site.web" valid={websiteValid}>
              <Input id="SocAdmin.site.web.input" type="url" value={editingForm.form.website} onChange={(e) => updateEditForm({ website: e.target.value })} />
            </FlagField>
            <div className="sm:col-span-2">
              <Card id="SocAdmin.adresse.card" className="p-4">
                <h3 id="SocAdmin.adresse" className="text-sm font-semibold text-gray-900">Adresse</h3>
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FlagField label={tr('SocAdmin.pays')} id="SocAdmin.pays" valid={countryValid}>
                    <Input id="SocAdmin.pays.input" list="SocAdmin.pays.suggestions" value={editingForm.form.country} onChange={(e) => handleCountryChange(e.target.value)} />
                    <datalist id="SocAdmin.pays.suggestions">
                      {countrySuggestions.map((country) => (
                        <option key={country} value={country.toUpperCase()} />
                      ))}
                    </datalist>
                  </FlagField>
                  <FlagField label={tr('SocAdmin.code.postal')} id="SocAdmin.code.postal" valid={postalCodeValid}>
                    <Input id="SocAdmin.code.postal.input" value={editingForm.form.zipCode} onChange={(e) => void handlePostalCodeChange(e.target.value)} />
                  </FlagField>
                  <FlagField label={tr('SocAdmin.ville')} id="SocAdmin.ville" valid={cityValid}>
                    <Input id="SocAdmin.ville.input" value={editingForm.form.city} onChange={(e) => handleCityChange(e.target.value)} onBlur={() => void handleCityBlur()} />
                  </FlagField>
                  <FlagField label={tr('SocAdmin.rue')} id="SocAdmin.rue" valid={streetValid}>
                    <div className="relative">
                      <Input id="SocAdmin.rue.input" autoComplete="off" value={editingForm.form.street} onChange={(e) => handleStreetChange(e.target.value)} onBlur={() => void verifyStreet()} />
                      {streetSuggestions.length > 0 && (
                        <ul id="SocAdmin.rue.suggestions" className="mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow">
                          {streetSuggestions.map((suggestion, index) => (
                            <li key={suggestion}>
                              <button
                                type="button"
                                id={`SocAdmin.rue.suggestion.${index}`}
                                className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                  updateEditForm({ street: suggestion })
                                  setStreetSuggestions([])
                                  void verifyStreet(suggestion)
                                }}
                              >
                                {suggestion}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </FlagField>
                </div>
              </Card>
            </div>
            <div className="sm:col-span-2">
              <Field label={tr('SocAdmin.description')} id="SocAdmin.description">
                <Textarea id="SocAdmin.description.textarea" rows={3} value={editingForm.form.description} onChange={(e) => setEditingForm({ ...editingForm, form: { ...editingForm.form, description: e.target.value } })} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label={tr('SocAdmin.informations.web')} id="SocAdmin.informations.web">
                <Textarea id="SocAdmin.informations.web.textarea" rows={3} value={editingForm.form.infosWeb} onChange={(e) => setEditingForm({ ...editingForm, form: { ...editingForm.form, infosWeb: e.target.value } })} />
              </Field>
            </div>
            {user?.role === 'RESPONSIBLE_SOC' && (
              <div className="sm:col-span-2">
                <SocLogoField
                  socId={editingForm.soc.id}
                  hasLogo={editingForm.soc.hasLogo ?? false}
                  socName={editingForm.soc.name}
                  disabled={editingForm.readOnly}
                  onChange={(saved) => {
                    setEditingForm({ ...editingForm, soc: saved })
                    setData((prev) => (prev ?? []).map((s) => (s.id === saved.id ? saved : s)))
                    void refreshSocs()
                  }}
                />
              </div>
            )}
          </fieldset>
        </Modal>
      )}

      {deleting && (
        <Modal
          open
          onClose={() => setDeleting(null)}
          titleId="SocAdmin.supprimer.la.societe.modal"
          title={tr('SocAdmin.supprimer.la.societe', { name: deleting.name })}
          footer={
            <>
              <IconButton icon="cancel" label={tr('common.cancel')} type="button" onClick={() => setDeleting(null)} disabled={dependencyLoading} id="SocAdmin.delete.cancel" />
              <Button id="SocAdmin.tout.supprimer" type="button" variant="danger" className="!w-auto" onClick={() => void confirmDeleteAll()} disabled={dependencyLoading}>
                {dependencyLoading ? <Spinner className="border-white border-t-transparent" /> : null}
                {tr('SocAdmin.tout.supprimer')}
              </Button>
            </>
          }
        >
          <div id="SocAdmin.attention.cette.societe.sera.supprimee.avec.tous.ses.objets." className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {tr('SocAdmin.attention.cette.societe.sera.supprimee.avec.tous.ses.objets.')}
          </div>
          <p id="SocAdmin.objets.lies" className="mt-3 text-sm font-medium text-gray-700">{tr('SocAdmin.objets.lies')}{dependencies.length})</p>
          <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
            {dependencies.map((item) => (
              <div key={`${item.type}-${item.id}`} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
                <span id={`SocAdmin.dependency.${item.type}.${item.id}.label`} className="truncate text-sm text-gray-700">{item.label}</span>
                <span id={`SocAdmin.dependency.${item.type}.${item.id}.type`} className="ml-auto shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                  {tr(DEPENDENCY_LABEL_KEYS[item.type] ?? item.type)}
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
          titleId="SocAdmin.societe.demo.creee"
          title={tr('SocAdmin.societe.demo.creee', { number: demoResult.number })}
          footer={
            <IconButton icon="close" label={tr('common.close')} type="button" onClick={() => setDemoResult(null)} id="common.close" />
          }
        >
          <div className="space-y-2 text-sm">
            <Row id="SocAdmin.societe.demo.socName" label={tr('SocAdmin.societe')} value={demoResult.socName} />
            <Row id="SocAdmin.societe.demo.username" label={tr('SocAdmin.responsable')} value={demoResult.username} />
            <Row id="SocAdmin.societe.demo.password" label={tr('SocAdmin.mot.de.passe')} value={demoResult.password} />
            <Row id="SocAdmin.societe.demo.clientName" label={tr('SocAdmin.client')} value={demoResult.clientName} />
            <Row id="SocAdmin.societe.demo.projectName" label={tr('SocAdmin.projet')} value={demoResult.projectName} />
            <Row id="SocAdmin.societe.demo.activityName" label={tr('SocAdmin.activite.mission')} value={demoResult.activityName} />
            <Row id="SocAdmin.societe.demo.consultantName" label={tr('SocAdmin.consultant')} value={demoResult.consultantName} />
          </div>
        </Modal>
      )}
    </div>
  )
}

function Row({ id, label, value }: { id?: string; label: string; value: string }) {
  return (
    <div id={id} className="flex items-start gap-2 rounded-lg border border-gray-200 px-3 py-2">
      <span id={id ? `${id}.label` : undefined} className="w-32 shrink-0 font-medium text-gray-500">{label}</span>
      <span id={id ? `${id}.value` : undefined} className="font-mono text-gray-900">{value}</span>
    </div>
  )
}
