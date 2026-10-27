import { tr } from '../i18n/translate'
import { useEffect, useState, type FormEvent } from 'react'
import { authApi, type CompanyLookup } from '../api/auth'
import type { AddSocPayload, SocLiteDto } from '../api/types'
import { Modal } from '../components/data'
import { Button, Field, Input, Textarea } from '../components/ui'
import { dialog } from '../components/dialog'
import { useSoc } from './SocContext'

interface AddSocModalProps {
  open: boolean
  onClose: () => void
  onCreated?: (soc: SocLiteDto) => void
  submit?: (payload: AddSocPayload) => Promise<SocLiteDto>
  defaultMine?: boolean
}

export function AddSocModal({ open, onClose, onCreated, submit, defaultMine = true }: AddSocModalProps) {
  const { addSoc } = useSoc()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [infosWeb, setInfosWeb] = useState('')
  const [siret, setSiret] = useState('')
  const [codeNaf, setCodeNaf] = useState('')
  const [urssaf, setUrssaf] = useState('')
  const [gerant, setGerant] = useState('')
  const [categorieEntreprise, setCategorieEntreprise] = useState('')
  const [dateCreation, setDateCreation] = useState('')
  const [dateFermeture, setDateFermeture] = useState('')
  const [website, setWebsite] = useState('')
  const [street, setStreet] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<CompanyLookup[]>([])
  const [mine, setMine] = useState(defaultMine)

  useEffect(() => {
    if (open) setMine(defaultMine)
  }, [open, defaultMine])

  function reset() {
    setName('')
    setDescription('')
    setInfosWeb('')
    setSiret('')
    setCodeNaf('')
    setUrssaf('')
    setGerant('')
    setCategorieEntreprise('')
    setDateCreation('')
    setDateFermeture('')
    setWebsite('')
    setStreet('')
    setZipCode('')
    setCity('')
    setCountry('')
    setError(null)
    setSearchResults([])
    setMine(defaultMine)
  }

  function close() {
    reset()
    onClose()
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Le nom de la société est obligatoire')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload: AddSocPayload = {
        socName: name.trim(),
        description: description.trim() || undefined,
        infosWeb: infosWeb.trim() || undefined,
        siret: siret.trim() || undefined,
        codeNaf: codeNaf.trim() || undefined,
        urssaf: urssaf.trim() || undefined,
        gerant: gerant.trim() || undefined,
        categorieEntreprise: categorieEntreprise.trim() || undefined,
        dateCreation: dateCreation || undefined,
        dateFermeture: dateFermeture || undefined,
        website: ensureHttps(website) || undefined,
        street: street.trim() || undefined,
        zipCode: zipCode.trim() || undefined,
        city: city.trim() || undefined,
        country: country.trim() || undefined,
        mine,
      }
      const created = submit ? await submit(payload) : await addSoc(payload)
      close()
      onCreated?.(created)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'inscription de la société")
    } finally {
      setSaving(false)
    }
  }

  async function searchCompany() {
    if (!name.trim() && !siret.trim()) {
      setError('Saisissez le nom ou le SIRET de la société')
      return
    }
    setSearching(true)
    setError(null)
    try {
      const companies = await authApi.searchSoc(name.trim() || undefined, siret.trim() || undefined)
      if (companies.length !== 1) {
        setSearchResults(companies)
        return
      }
      const company = companies[0]
      if (company.name) setName(company.name)
      if (company.infosWeb) setInfosWeb(company.infosWeb)
      if (company.siret) setSiret(company.siret)
      if (company.codeNaf) setCodeNaf(company.codeNaf)
      if (company.gerant) setGerant(company.gerant)
      if (company.categorieEntreprise) setCategorieEntreprise(company.categorieEntreprise)
      if (company.dateCreation) setDateCreation(company.dateCreation)
      if (company.dateFermeture) setDateFermeture(company.dateFermeture)
setWebsite(ensureHttps(company.website))
      if (company.street) setStreet(company.street)
      if (company.zipCode) setZipCode(company.zipCode)
      if (company.city) setCity(company.city)
      if (company.country) setCountry(company.country)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recherche impossible')
    } finally {
      setSearching(false)
    }
  }

  async function clearCompanySearch() {
    if (!(await dialog.confirm(tr('AddSocModal.voulez.vous.effacer.tous.les.champs.du.formulaire'), { variant: 'warning', okLabel: 'Effacer' }))) return
    reset()
  }

  function chooseCompany(company: CompanyLookup) {
    if (company.name) setName(company.name)
    if (company.infosWeb) setInfosWeb(company.infosWeb)
    if (company.siret) setSiret(company.siret)
    if (company.codeNaf) setCodeNaf(company.codeNaf)
    if (company.gerant) setGerant(company.gerant)
    if (company.categorieEntreprise) setCategorieEntreprise(company.categorieEntreprise)
    if (company.dateCreation) setDateCreation(company.dateCreation)
    if (company.dateFermeture) setDateFermeture(company.dateFermeture)
    setWebsite(ensureHttps(company.website))
    if (company.street) setStreet(company.street)
    if (company.zipCode) setZipCode(company.zipCode)
    if (company.city) setCity(company.city)
    if (company.country) setCountry(company.country)
    setSearchResults([])
  }

  function ensureHttps(value: string | null | undefined): string {
    const website = value?.trim() ?? ''
    if (!website) return ''
    return /^https?:\/\//i.test(website) ? website.replace(/^http:\/\//i, 'https://') : `https://${website}`
  }

  return (
    <Modal
      open={open}
      title={tr('AddSocModal.inscrire.une.nouvelle.societe')}
      titleId="AddSocModal.inscrire.une.nouvelle.societe"
      onClose={close}
      size="lg"
      footer={
        <>
          <Button id="AddSocModal.annuler" type="button" onClick={close} className="!w-auto !bg-gray-100 !text-gray-700 hover:!bg-gray-200">
            Annuler
          </Button>
          <Button id="AddSocModal.inscrire" type="submit" form="add-soc-form" disabled={saving} className="!w-auto">
            {saving ? 'Enregistrement…' : "Inscrire la société"}
          </Button>
        </>
      }
    >
      <form
        id="add-soc-form"
        onSubmit={handleSubmit}
        className="space-y-4"
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || e.target instanceof HTMLTextAreaElement) {
            return
          }
          e.preventDefault()
          const name2 = (e.target as HTMLInputElement).name
          if (name2 === 'name' || name2 === 'gerant' || name2 === 'siret') {
            searchCompany()
          }
        }}
      >
        {error && (
          <div id="AddSocModal.error" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={tr('AddSocModal.nom.de.la.societe')} id="AddSocModal.nom.de.la.societe">
            <Input id="AddSocModal.nom.de.la.societe.input" value={name} name="name" onChange={(e) => setName(e.target.value)} placeholder={tr('AddSocModal.ex.xyz.consulting')} autoFocus />
          </Field>
          <Field label={tr('AddSocModal.gerant')} id="AddSocModal.gerant">
            <Input id="AddSocModal.gerant.input" value={gerant} name="gerant" onChange={(e) => setGerant(e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label={tr('AddSocModal.siret')} id="AddSocModal.siret">
            <div className="flex flex-wrap gap-2">
              <Input id="AddSocModal.siret.input" className="basis-full" name="siret" value={siret} onChange={(e) => setSiret(e.target.value)} placeholder={tr('AddSocModal.14.chiffres')} />
              <div className="basis-full flex justify-start gap-2">
                <Button id="AddSocModal.rechercher" type="button" onClick={searchCompany} disabled={searching} className="!w-auto whitespace-nowrap">
                  {searching ? 'Recherche…' : 'Rechercher'}
                </Button>
                <Button id="AddSocModal.effacer" type="button" onClick={clearCompanySearch} className="!w-auto whitespace-nowrap !bg-gray-100 !text-gray-700 hover:!bg-gray-200">
                  {tr('AddSocModal.effacer')}
                </Button>
              </div>
            </div>
          </Field>
          <Field label={tr('AddSocModal.code.naf')} id="AddSocModal.code.naf">
            <Input id="AddSocModal.code.naf.input" value={codeNaf} onChange={(e) => setCodeNaf(e.target.value)} placeholder={tr('AddSocModal.ex.6202a')} />
          </Field>
          <Field label={tr('AddSocModal.urssaf')} id="AddSocModal.urssaf">
            <Input id="AddSocModal.urssaf.input" value={urssaf} onChange={(e) => setUrssaf(e.target.value)} />
          </Field>
        </div>

        {!submit && (
          <label id="AddSocModal.c.est.ma.societe" className="flex items-center gap-2 text-sm text-gray-700">
            <input
              id="AddSocModal.c.est.ma.societe.input"
              type="checkbox"
              checked={mine}
              onChange={(e) => setMine(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            {tr('AddSocModal.c.est.ma.societe')}
          </label>
        )}

        <Field label={tr('AddSocModal.description')} id="AddSocModal.description">
          <Textarea
            id="AddSocModal.description.textarea"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={tr('AddSocModal.activite.presentation.de.la.societe')}
          />
        </Field>

        <Field label={tr('AddSocModal.informations.web')} id="AddSocModal.informations.web">
          <Textarea id="AddSocModal.informations.web.textarea" rows={3} value={infosWeb} onChange={(e) => setInfosWeb(e.target.value)} />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label={tr('AddSocModal.categorie.entreprise')} id="AddSocModal.categorie.entreprise">
            <Input id="AddSocModal.categorie.entreprise.input" value={categorieEntreprise} onChange={(e) => setCategorieEntreprise(e.target.value)} />
          </Field>
          <Field label={tr('AddSocModal.date.de.creation')} id="AddSocModal.date.de.creation">
            <Input id="AddSocModal.date.de.creation.input" type="date" value={dateCreation} onChange={(e) => setDateCreation(e.target.value)} />
          </Field>
          <Field label={tr('AddSocModal.date.de.fermeture')} id="AddSocModal.date.de.fermeture">
            <Input id="AddSocModal.date.de.fermeture.input" type="date" value={dateFermeture} onChange={(e) => setDateFermeture(e.target.value)} />
          </Field>
        </div>

        <Field label={tr('AddSocModal.site.web')} id="AddSocModal.site.web">
          <Input
            id="AddSocModal.site.web.input"
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder={tr('AddSocModal.https')}
          />
        </Field>

        <fieldset id="AddSocModal.adresse.fieldset" className="space-y-4 rounded-lg border border-gray-200 p-4">
          <legend id="AddSocModal.adresse" className="px-1 text-sm font-medium text-gray-700">{tr('AddSocModal.adresse')}</legend>
          <Field label={tr('AddSocModal.rue')} id="AddSocModal.rue">
            <Input id="AddSocModal.rue.input" value={street} onChange={(e) => setStreet(e.target.value)} placeholder={tr('AddSocModal.n.et.rue')} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label={tr('AddSocModal.code.postal')} id="AddSocModal.code.postal">
              <Input id="AddSocModal.code.postal.input" value={zipCode} onChange={(e) => setZipCode(e.target.value)} />
            </Field>
            <Field label={tr('AddSocModal.ville')} id="AddSocModal.ville">
              <Input id="AddSocModal.ville.input" value={city} onChange={(e) => setCity(e.target.value)} />
            </Field>
            <Field label={tr('AddSocModal.pays')} id="AddSocModal.pays">
              <Input id="AddSocModal.pays.input" value={country} onChange={(e) => setCountry(e.target.value)} placeholder={tr('AddSocModal.fr')} />
            </Field>
          </div>
        </fieldset>
      </form>
      {searchResults.length > 1 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div id="AddSocModal.resultats.dialog" className="flex h-[600px] w-[600px] max-h-[90vh] max-w-[92vw] flex-col rounded-xl bg-white p-5 shadow-xl" role="dialog" aria-modal="true">
            <h3 id="AddSocModal.choisir.une.societe" className="text-lg font-semibold text-gray-900">{tr('AddSocModal.choisir.une.societe')}</h3>
            <p id="AddSocModal.societes.trouvees" className="mt-1 text-sm text-gray-500">{searchResults.length} {tr('AddSocModal.societes.trouvees')}</p>
            <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
              {searchResults.map((company, index) => (
                <button key={`${company.siret ?? company.name}-${index}`} id={`AddSocModal.resultat.${index}`} type="button" onClick={() => chooseCompany(company)} className="w-full rounded-lg border border-gray-200 p-3 text-left hover:border-brand-500 hover:bg-brand-50">
                  <span id={`AddSocModal.resultat.${index}.name`} className="block font-medium text-gray-900">{company.name ?? 'Société sans nom'}</span>
                  <span id={`AddSocModal.resultat.${index}.detail`} className="text-sm text-gray-500">{company.siret ?? 'SIRET inconnu'} · {company.city ?? 'Ville inconnue'}</span>
                </button>
              ))}
            </div>
            <Button id="AddSocModal.resultats.annuler" type="button" onClick={() => setSearchResults([])} className="mt-4 !w-auto !bg-gray-100 !text-gray-700">{tr('AddSocModal.annuler')}</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
