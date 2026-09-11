import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useSoc } from '../soc/SocContext'
import { authApi } from '../api/auth'
import { socsApi, type SocDependency } from '../api/socs'
import type { SocDto } from '../api/types'
import { ApiError } from '../api/client'
import { useAsync } from '../lib/useAsync'
import { Button, Card, Field, Input, RefreshButton, Spinner, Textarea } from '../components/ui'
import { Badge, ErrorBlock, LoadingBlock, PageHeader } from '../components/data'
import { ROLE_LABELS, formatDateTime } from '../lib/format'

const DEPENDENCY_LABELS: Record<string, string> = {
  client: 'Client',
  supplier: 'Fournisseur',
  project: 'Projet',
  consultant: 'Consultant',
  activity: 'Activité',
  activity_type: "Type d'activité",
  subscription: 'Abonnement',
}

export function Profile() {
  const { user, refreshMe } = useAuth()
  const { socs, selectedSocId, selectSoc, favoriteSocId, setFavoriteSoc } = useSoc()
  const [favoriting, setFavoriting] = useState<number | null>(null)
  const [editingSoc, setEditingSoc] = useState<SocDto | null>(null)
  const [socSaving, setSocSaving] = useState(false)
  const [socError, setSocError] = useState<string | null>(null)
  const [socMessage, setSocMessage] = useState<string | null>(null)
  const [deletingSoc, setDeletingSoc] = useState<{ id: number; name: string } | null>(null)
  const [dependencies, setDependencies] = useState<SocDependency[]>([])
  const [dependencyLoading, setDependencyLoading] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changing, setChanging] = useState(false)
  const [changeError, setChangeError] = useState<string | null>(null)
  const [changeSuccess, setChangeSuccess] = useState(false)

  const { data: connections, loading: connectionsLoading, reload } = useAsync(
    () => authApi.connections(),
    [],
  )

  if (!user) return null

  async function handleChangePassword() {
    setChangeError(null)
    setChangeSuccess(false)
    if (newPassword.length < 8) {
      setChangeError('Le nouveau mot de passe doit contenir au moins 8 caractères')
      return
    }
    if (newPassword !== confirmPassword) {
      setChangeError('Les mots de passe ne correspondent pas')
      return
    }
    setChanging(true)
    try {
      await authApi.changePassword(currentPassword, newPassword)
      await refreshMe()
      setChangeSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setChangeError(err instanceof ApiError ? err.message : 'Erreur inattendue')
    } finally {
      setChanging(false)
    }
  }

  async function editSoc(id: number) {
    setSocError(null)
    setSocMessage(null)
    try {
      setEditingSoc(await socsApi.getById(id).then((detail) => detail.soc))
    } catch (err) {
      setSocError(err instanceof ApiError ? err.message : 'Impossible de charger la société')
    }
  }

  async function toggleFavorite(id: number) {
    setFavoriting(id)
    try {
      await setFavoriteSoc(id)
    } finally {
      setFavoriting(null)
    }
  }

  async function saveSoc() {
    if (!editingSoc) return
    setSocSaving(true)
    setSocError(null)
    setSocMessage(null)
    try {
      const saved = await socsApi.update(editingSoc.id, editingSoc)
      setEditingSoc(saved)
      setSocMessage('Société mise à jour.')
    } catch (err) {
      setSocError(err instanceof ApiError ? err.message : 'Impossible de modifier la société')
    } finally {
      setSocSaving(false)
    }
  }

  async function deleteSoc(id: number, name: string) {
    if (!window.confirm(`Supprimer la société « ${name} » ?`)) return
    setSocError(null)
    setSocMessage(null)
    try {
      setDependencyLoading(true)
      const linked = await socsApi.dependencies(id)
      if (linked.length > 0) {
        setDeletingSoc({ id, name })
        setDependencies(linked)
        return
      }
      await socsApi.remove(id)
      window.location.reload()
    } catch (err) {
      setSocError(err instanceof ApiError ? err.message : 'Impossible de supprimer la société')
    } finally {
      setDependencyLoading(false)
    }
  }

  async function confirmDeleteAll() {
    if (!deletingSoc) return
    setDependencyLoading(true)
    setSocError(null)
    try {
      await socsApi.removeWithDependencies(deletingSoc.id)
      setDeletingSoc(null)
      window.location.reload()
    } catch (err) {
      setSocError(err instanceof ApiError ? err.message : 'Impossible de supprimer la société')
    } finally {
      setDependencyLoading(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Mon profil"
        subtitle="Informations personnelles, mot de passe et connexions"
        actions={
          <RefreshButton
            onClick={() => {
              void refreshMe()
              reload()
            }}
          />
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-gray-900">Informations</h3>
          <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-gray-500">Nom complet</dt>
              <dd className="text-sm font-medium text-gray-900">
                {user.firstName} {user.lastName}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Identifiant</dt>
              <dd className="text-sm font-medium text-gray-900">{user.username}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">E-mail</dt>
              <dd className="text-sm font-medium text-gray-900">{user.email}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Téléphone</dt>
              <dd className="text-sm font-medium text-gray-900">{user.phone ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Rôle</dt>
              <dd className="text-sm font-medium text-gray-900">
                <Badge kind="info">{ROLE_LABELS[user.role] ?? user.role}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Sociétés</dt>
              <dd className="text-sm font-medium text-gray-900">
                {socs.length > 0 ? (
                  <ul className="space-y-1">
                    {socs.map((e) => (
                      <li key={e.id} className="flex flex-wrap items-center gap-2">
                        <span className={e.id === favoriteSocId ? 'h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500' : 'h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500'} />
                        <span className={e.id === favoriteSocId ? 'font-medium text-amber-600' : undefined}>{e.name}</span>
                        {user.role === 'RESPONSIBLE_SOC' && (
                          <span className="ml-auto flex gap-2">
                            <Button
                              type="button"
                              aria-label={`Sélectionner ${e.name}`}
                              title={e.id === selectedSocId ? 'Société de travail' : 'Travailler avec cette société'}
                              disabled={e.id === selectedSocId}
                              className="!w-auto !bg-gray-100 !px-2 !py-1 !text-xs !text-gray-700"
                              onClick={() => selectSoc(e.id)}
                            >
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill={e.id === selectedSocId ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 6v12M6 12h12" /></svg>
                            </Button>
                            <Button
                              type="button"
                              aria-label={e.id === favoriteSocId ? 'Société favorite' : 'Définir comme favorite'}
                              title={e.id === favoriteSocId ? 'Société favorite' : 'Définir comme favorite'}
                              disabled={favoriting === e.id}
                              className={`!w-auto !px-2 !py-1 !text-xs ${e.id === favoriteSocId ? '!bg-amber-100 !text-amber-600' : '!bg-gray-100 !text-gray-700'}`}
                              onClick={() => void toggleFavorite(e.id)}
                            >
                              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z" clipRule="evenodd" /></svg>
                            </Button>
                            <Button type="button" aria-label={`Modifier ${e.name}`} title="Modifier" className="!w-auto !bg-gray-100 !px-2 !py-1 !text-xs !text-gray-700" onClick={() => void editSoc(e.id)}>
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></svg>
                            </Button>
                            <Button type="button" aria-label={`Supprimer ${e.name}`} title="Supprimer" className="!w-auto !bg-red-600 !px-2 !py-1 !text-xs hover:!bg-red-700" onClick={() => void deleteSoc(e.id, e.name)}>
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="m19 6-1 14H6L5 6" /><path d="M10 11v5M14 11v5" /></svg>
                            </Button>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  user.socName ?? '—'
                )}
              </dd>
            </div>
          </dl>
          {user.manager && (
            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h4 className="text-sm font-semibold text-gray-900">Manager</h4>
              <dl className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-gray-500">Nom complet</dt>
                  <dd className="text-sm font-medium text-gray-900">{user.manager.fullName}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Username</dt>
                  <dd className="text-sm font-medium text-gray-900">{user.manager.username}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">E-mail</dt>
                  <dd className="text-sm font-medium text-gray-900">{user.manager.email}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Téléphone</dt>
                  <dd className="text-sm font-medium text-gray-900">{user.manager.phone ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Rôle</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {user.manager.role ? <Badge kind="warning">{ROLE_LABELS[user.manager.role as keyof typeof ROLE_LABELS] ?? user.manager.role}</Badge> : '—'}
                  </dd>
                </div>
              </dl>
            </div>
          )}
          {user.role === 'RESPONSIBLE_SOC' && editingSoc && (
            <div className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-brand-100 bg-brand-50/40 p-4 sm:grid-cols-2">
              <Field label="Nom de la société"><Input value={editingSoc.name} onChange={(e) => setEditingSoc({ ...editingSoc, name: e.target.value })} /></Field>
              <Field label="SIRET"><Input value={editingSoc.siret ?? ''} onChange={(e) => setEditingSoc({ ...editingSoc, siret: e.target.value })} /></Field>
              <Field label="Description"><Textarea rows={2} value={editingSoc.description ?? ''} onChange={(e) => setEditingSoc({ ...editingSoc, description: e.target.value })} /></Field>
              <Field label="Informations web"><Textarea rows={2} value={editingSoc.infosWeb ?? ''} onChange={(e) => setEditingSoc({ ...editingSoc, infosWeb: e.target.value })} /></Field>
              <Field label="Site web"><Input type="url" value={editingSoc.website ?? ''} onChange={(e) => setEditingSoc({ ...editingSoc, website: e.target.value })} /></Field>
              <Field label="Gérant"><Input value={editingSoc.gerant ?? ''} onChange={(e) => setEditingSoc({ ...editingSoc, gerant: e.target.value })} /></Field>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="button" className="!w-auto" onClick={() => void saveSoc()} disabled={socSaving}>{socSaving ? <Spinner className="border-white border-t-transparent" /> : null}Enregistrer</Button>
                <Button type="button" className="!w-auto !bg-gray-100 !text-gray-700" onClick={() => setEditingSoc(null)}>Annuler</Button>
              </div>
            </div>
          )}
          {user.role === 'RESPONSIBLE_SOC' && socError && <div className="mt-4"><ErrorBlock message={socError} /></div>}
          {user.role === 'RESPONSIBLE_SOC' && socMessage && <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{socMessage}</div>}
          {deletingSoc && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="flex h-[500px] w-[500px] max-h-[90vh] max-w-[92vw] flex-col rounded-xl bg-white p-5 shadow-xl" role="dialog" aria-modal="true">
                <h3 className="text-lg font-semibold text-gray-900">Supprimer la société « {deletingSoc.name} »</h3>
                <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  Attention : cette société sera supprimée avec tous ses objets liés.
                </div>
                <p className="mt-3 text-sm font-medium text-gray-700">
                  Objets liés ({dependencies.length})
                </p>
                <div className="mt-2 flex-1 space-y-2 overflow-y-auto">
                  {dependencies.map((item) => (
                    <div key={`${item.type}-${item.id}`} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
                      <svg className="h-4 w-4 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9 17H7A5 5 0 0 1 7 7h2" /><path d="M15 7h2a5 5 0 1 1 0 10h-2" /><path d="M8 12h8" /></svg>
                      <span className="truncate text-sm text-gray-700">{item.label}</span>
                      <span className="ml-auto shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                        {DEPENDENCY_LABELS[item.type] ?? item.type}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-end gap-2 border-t border-gray-200 pt-3">
                  <Button type="button" className="!w-auto !bg-gray-100 !text-gray-700" onClick={() => setDeletingSoc(null)} disabled={dependencyLoading}>Annuler</Button>
                  <Button type="button" className="!w-auto !bg-red-600 hover:!bg-red-700" onClick={() => void confirmDeleteAll()} disabled={dependencyLoading}>
                    {dependencyLoading ? <Spinner className="border-white border-t-transparent" /> : null}
                    Tout supprimer
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-semibold text-gray-900">Changer le mot de passe</h3>
          <div className="mt-4 space-y-4">
            {changeSuccess && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                Mot de passe mis à jour.
              </div>
            )}
            {changeError && <ErrorBlock message={changeError} />}
            <Field label="Mot de passe actuel">
              <Input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </Field>
            <Field label="Nouveau mot de passe">
              <Input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </Field>
            <Field label="Confirmation">
              <Input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </Field>
            <Button className="w-auto" onClick={handleChangePassword} disabled={changing}>
              {changing ? <Spinner className="border-white border-t-transparent" /> : null}
              Mettre à jour
            </Button>
          </div>
        </Card>
      </div>

      <Card className="mt-6 p-6">
        <h3 className="text-sm font-semibold text-gray-900">Historique des connexions</h3>
        {connectionsLoading ? (
          <LoadingBlock />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead style={{ backgroundColor: 'var(--table-header)' }}>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                    IP
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                    Navigateur
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                    Statut
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {(connections ?? []).map((c) => (
                  <tr key={c.id} className="even:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700">{formatDateTime(c.loginTime)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{c.ipAddress}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-sm text-gray-500">{c.userAgent}</td>
                    <td className="px-4 py-3">
                      <Badge kind={c.success ? 'success' : 'error'}>
                        {c.success ? 'Succès' : 'Échec'}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {(connections ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400">
                      Aucune connexion enregistrée.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
