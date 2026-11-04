import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { leaveApi } from '../api/leave'
import { ApiError } from '../api/client'
import { useAsync } from '../lib/useAsync'
import { useSoc } from '../soc/SocContext'
import { Button, Card, Field, Input, RefreshButton, Select } from '../components/ui'
import { ErrorBlock, LoadingBlock, PageHeader } from '../components/data'
import { dialog } from '../components/dialog'
import type { LeaveAccrualFrequency, LeaveType } from '../api/types'

export function LeaveSettings() {
  const { user } = useAuth()
  const { selectedSocId } = useSoc()
  const socId = selectedSocId ?? user?.socId ?? null

  const { data: configs, loading, error, reload } = useAsync(
    () => (socId ? leaveApi.configs(socId) : Promise.resolve([])),
    [socId],
  )
  const [form, setForm] = useState({
    leaveType: 'CP' as LeaveType,
    effectiveDate: new Date().toISOString().slice(0, 10),
    accrualAmount: '0',
    accrualFrequency: 'MONTHLY' as LeaveAccrualFrequency,
    creditMonth: '1',
    creditDay: '1',
    expirationMonths: '',
    negativeLimit: '0',
    active: true,
  })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      await leaveApi.saveConfig({
        socId,
        leaveType: form.leaveType,
        effectiveDate: form.effectiveDate,
        active: form.active,
        accrualAmount: Number(form.accrualAmount) || 0,
        accrualFrequency: form.accrualFrequency,
        creditMonth: Number(form.creditMonth) || 1,
        creditDay: Number(form.creditDay) || 1,
        expirationMonths: form.expirationMonths ? Number(form.expirationMonths) : null,
        negativeLimit: Number(form.negativeLimit) || 0,
      })
      reload()
      dialog.success('Configuration enregistrée')
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title="Paramètres congés" titleId="LeaveSettings.title" actions={<RefreshButton onClick={reload} />} />

      {error && <ErrorBlock id="LeaveSettings.error" message={error} />}
      {loading && <LoadingBlock />}

      <Card id="LeaveSettings.config" className="mb-6 p-5">
        <h3 id="LeaveSettings.config.title" className="mb-3 text-sm font-semibold text-gray-700">Nouvelle configuration de droits</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          {formError && <p id="LeaveSettings.formError" className="text-sm text-red-600">{formError}</p>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Type" id="LeaveSettings.config.type.label">
              <Select id="LeaveSettings.config.type" value={form.leaveType} onChange={(e) => setForm({ ...form, leaveType: e.target.value as LeaveType })}>
                <option value="CP">CP</option>
                <option value="RTT">RTT</option>
              </Select>
            </Field>
            <Field label="Date d'effet" id="LeaveSettings.config.effectiveDate.label">
              <Input id="LeaveSettings.config.effectiveDate" type="date" value={form.effectiveDate} onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} />
            </Field>
            <Field label="Quantité acquise" id="LeaveSettings.config.amount.label">
              <Input id="LeaveSettings.config.amount" type="number" value={form.accrualAmount} onChange={(e) => setForm({ ...form, accrualAmount: e.target.value })} />
            </Field>
            <Field label="Fréquence" id="LeaveSettings.config.frequency.label">
              <Select id="LeaveSettings.config.frequency" value={form.accrualFrequency} onChange={(e) => setForm({ ...form, accrualFrequency: e.target.value as LeaveAccrualFrequency })}>
                <option value="MONTHLY">Mensuelle</option>
                <option value="YEARLY">Annuelle</option>
                <option value="ONCE">Unique</option>
              </Select>
            </Field>
            <Field label="Mois de crédit" id="LeaveSettings.config.creditMonth.label">
              <Input id="LeaveSettings.config.creditMonth" type="number" value={form.creditMonth} onChange={(e) => setForm({ ...form, creditMonth: e.target.value })} />
            </Field>
            <Field label="Jour de crédit" id="LeaveSettings.config.creditDay.label">
              <Input id="LeaveSettings.config.creditDay" type="number" value={form.creditDay} onChange={(e) => setForm({ ...form, creditDay: e.target.value })} />
            </Field>
            <Field label="Expiration (mois)" id="LeaveSettings.config.expiration.label">
              <Input id="LeaveSettings.config.expiration" type="number" value={form.expirationMonths} onChange={(e) => setForm({ ...form, expirationMonths: e.target.value })} />
            </Field>
            <Field label="Seuil négatif" id="LeaveSettings.config.negative.label">
              <Input id="LeaveSettings.config.negative" type="number" value={form.negativeLimit} onChange={(e) => setForm({ ...form, negativeLimit: e.target.value })} />
            </Field>
          </div>
          <Button type="submit" id="LeaveSettings.config.submit" disabled={saving}>{saving ? '...' : 'Enregistrer'}</Button>
        </form>
      </Card>

      <Card id="LeaveSettings.configs" className="mb-6 p-5">
        <h3 id="LeaveSettings.configs.title" className="mb-3 text-sm font-semibold text-gray-700">Configurations existantes</h3>
        <div className="space-y-2 text-sm text-gray-700">
          {(configs ?? []).map((config) => (
            <div id={`LeaveSettings.configs.${config.id}`} key={config.id} className="flex flex-wrap gap-4 rounded border border-gray-100 px-3 py-2">
              <span className="font-medium">{config.leaveType}</span>
              <span>effet {config.effectiveDate}</span>
              <span>{config.accrualAmount} / {config.accrualFrequency}</span>
              <span>seuil négatif {config.negativeLimit}</span>
              <span>{config.active ? 'actif' : 'inactif'}</span>
            </div>
          ))}
          {(configs ?? []).length === 0 && <p id="LeaveSettings.configs.empty" className="text-gray-400">Aucune configuration</p>}
        </div>
      </Card>
    </div>
  )
}
