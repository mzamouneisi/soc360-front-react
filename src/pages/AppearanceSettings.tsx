import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { appearanceApi } from '../api/appearance'
import { ApiError } from '../api/client'
import { useAsync } from '../lib/useAsync'
import { applyAppearance } from '../lib/appearance'
import { Button, Card, Field, Input, Select } from '../components/ui'
import { ErrorBlock, LoadingBlock, PageHeader } from '../components/data'
import { dialog } from '../components/dialog'
import type { AppearanceScope } from '../api/types'

const PARAMS: { key: string; label: string }[] = [
  { key: 'primaryColor', label: 'Couleur principale' },
  { key: 'secondaryColor', label: 'Couleur secondaire' },
  { key: 'menuColor', label: 'Couleur du menu' },
  { key: 'backgroundColor', label: 'Couleur de fond' },
  { key: 'buttonStyle', label: 'Style des boutons' },
]

const SCOPE_LABELS: Record<AppearanceScope, string> = {
  USER: 'Ma personnalisation',
  SOC: 'Ma société',
  GLOBAL: 'SOC360 (global)',
}

export function AppearanceSettings({ embedded = false }: { embedded?: boolean } = {}) {
  const { user } = useAuth()

  const scopes = useMemo<AppearanceScope[]>(() => {
    const list: AppearanceScope[] = ['USER']
    if (user?.role === 'RESPONSIBLE_SOC' || user?.role === 'ADMIN') list.push('SOC')
    if (user?.role === 'ADMIN') list.push('GLOBAL')
    return list
  }, [user?.role])

  const effective = useAsync(() => appearanceApi.effective(), [])
  const [scope, setScope] = useState<AppearanceScope>(
    user?.role === 'ADMIN' ? 'GLOBAL' : user?.role === 'RESPONSIBLE_SOC' ? 'SOC' : 'USER',
  )
  const [form, setForm] = useState<Record<string, string>>({})
  const [defined, setDefined] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function loadScope(target: AppearanceScope) {
    setFormError(null)
    try {
      const dto = await appearanceApi.get(target)
      const next: Record<string, string> = {}
      for (const param of PARAMS) {
        next[param.key] = dto.config?.[param.key] ?? ''
      }
      setForm(next)
      setDefined(dto.defined)
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Erreur')
    }
  }

  useEffect(() => {
    void loadScope(scope)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope])

  async function reloadEffective() {
    const eff = await appearanceApi.effective()
    applyAppearance(eff)
    effective.reload()
  }

  async function save() {
    setSaving(true)
    setFormError(null)
    try {
      const config: Record<string, string> = {}
      for (const param of PARAMS) {
        const value = form[param.key]?.trim()
        if (value) config[param.key] = value
      }
      await appearanceApi.save(scope, config)
      await loadScope(scope)
      await reloadEffective()
      dialog.success('Apparence enregistrée')
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  async function reset() {
    const message = scope === 'SOC'
      ? 'Restaurer le paramétrage SOC360 pour la société ? La personnalisation de la société sera supprimée.'
      : 'Restaurer le paramétrage de ma société ? Votre personnalisation individuelle sera supprimée.'
    if (!(await dialog.confirm(message, { variant: 'warning', danger: true, okLabel: 'Restaurer' }))) {
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      await appearanceApi.reset(scope)
      await loadScope(scope)
      await reloadEffective()
      dialog.success('Paramétrage restauré')
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const effectiveKeys = effective.data ? Object.keys(effective.data.config ?? {}).sort() : []

  return (
    <div>
      {!embedded && <PageHeader title="Apparence" titleId="Appearance.title" />}

      {effective.error && <ErrorBlock id="Appearance.error" message={effective.error} />}
      {effective.loading && <LoadingBlock />}

      <Card id="Appearance.effective" className="mb-6 p-4">
        <h2 id="Appearance.effective.title" className="mb-3 text-sm font-bold text-gray-800">
          Apparence effective
        </h2>
        <table id="Appearance.effective.table" className="min-w-full divide-y divide-gray-200 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-500">
              <th id="Appearance.effective.param" className="px-2 py-1">Paramètre</th>
              <th id="Appearance.effective.value" className="px-2 py-1">Valeur</th>
              <th id="Appearance.effective.source" className="px-2 py-1">Origine</th>
            </tr>
          </thead>
          <tbody>
            {effectiveKeys.map((key) => (
              <tr key={key} id={`Appearance.effective.${key}.row`}>
                <td id={`Appearance.effective.${key}.label`} className="px-2 py-1 text-gray-700">
                  {PARAMS.find((p) => p.key === key)?.label ?? key}
                </td>
                <td id={`Appearance.effective.${key}.value`} className="px-2 py-1 font-medium text-gray-900">
                  {effective.data?.config[key]}
                </td>
                <td id={`Appearance.effective.${key}.source`} className="px-2 py-1 text-gray-500">
                  {effective.data?.sources[key] === 'SOC'
                    ? 'Société'
                    : effective.data?.sources[key] === 'USER'
                      ? 'Utilisateur'
                      : 'SOC360'}
                </td>
              </tr>
            ))}
            {effectiveKeys.length === 0 && (
              <tr>
                <td id="Appearance.effective.empty" colSpan={3} className="px-2 py-2 text-gray-400">
                  Aucun paramètre
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card id="Appearance.scope.card" className="p-4">
        <h2 id="Appearance.scope.title" className="mb-3 text-sm font-bold text-gray-800">
          Personnaliser
        </h2>
        {formError && (
          <p id="Appearance.formError" className="mb-2 text-sm text-red-600">
            {formError}
          </p>
        )}
        <div className="mb-3 max-w-xs">
          <Field label="Niveau" id="Appearance.scope.label">
            <Select
              id="Appearance.scope"
              value={scope}
              onChange={(e) => setScope(e.target.value as AppearanceScope)}
            >
              {scopes.map((s) => (
                <option id={`Appearance.scope.${s}`} key={s} value={s}>
                  {SCOPE_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <p id="Appearance.scope.status" className="mb-3 text-xs text-gray-500">
          {defined ? 'Personnalisé' : 'Hérité du niveau supérieur'}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {PARAMS.map((param) => (
            <Field key={param.key} label={param.label} id={`Appearance.${scope}.${param.key}.label`}>
              <Input
                id={`Appearance.${scope}.${param.key}`}
                value={form[param.key] ?? ''}
                placeholder="Hérité si vide"
                onChange={(e) => setForm((prev) => ({ ...prev, [param.key]: e.target.value }))}
              />
            </Field>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <Button id="Appearance.save" type="button" disabled={saving} onClick={() => void save()}>
            {saving ? '...' : 'Enregistrer'}
          </Button>
          {scope !== 'GLOBAL' && (
            <Button
              id="Appearance.reset"
              type="button"
              variant="neutral"
              disabled={saving}
              onClick={() => void reset()}
            >
              {scope === 'SOC' ? 'Restaurer le paramétrage SOC360' : 'Restaurer le paramétrage de ma société'}
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
