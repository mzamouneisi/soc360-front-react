import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { leaveApi } from '../api/leave'
import { ApiError } from '../api/client'
import { useAsync } from '../lib/useAsync'
import { useSoc } from '../soc/SocContext'
import { Button, Card, Field, Input, RefreshButton, Select } from '../components/ui'
import { ErrorBlock, LoadingBlock, PageHeader, Pagination } from '../components/data'
import { Icon } from '../components/icons'
import { dialog } from '../components/dialog'
import { formatDateTime } from '../lib/format'
import type {
  LeaveAccrualFrequency,
  LeaveConfigDto,
  LeaveType,
} from '../api/types'

const HISTORY_PAGE_SIZE = 5

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
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [historyOpen, setHistoryOpen] = useState<Record<number, boolean>>({})
  const [historyPages, setHistoryPages] = useState<Record<number, number>>({})

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

  async function toggleActive(config: LeaveConfigDto) {
    setTogglingId(config.id)
    try {
      await leaveApi.setConfigActive(config.id, !config.active)
      reload()
    } catch (err) {
      void dialog.error(err instanceof ApiError ? err.message : 'Erreur')
    } finally {
      setTogglingId(null)
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
            <Field label="Active" id="LeaveSettings.config.active.label">
              <label id="LeaveSettings.config.active.wrapper" className="flex h-full items-center gap-2 text-sm text-gray-700">
                <input
                  id="LeaveSettings.config.active"
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                {form.active ? 'Oui' : 'Non'}
              </label>
            </Field>
          </div>
          <Button type="submit" id="LeaveSettings.config.submit" disabled={saving}>{saving ? '...' : 'Enregistrer'}</Button>
        </form>
      </Card>

      <Card id="LeaveSettings.configs" className="mb-6 p-5">
        <h3 id="LeaveSettings.configs.title" className="mb-3 text-sm font-semibold text-gray-700">Configurations existantes</h3>
        <div className="space-y-3 text-sm text-gray-700">
          {(configs ?? []).map((config) => {
            const totalPages = Math.max(1, Math.ceil(config.activations.length / HISTORY_PAGE_SIZE))
            const page = Math.min(historyPages[config.id] ?? 0, totalPages - 1)
            const pageItems = config.activations.slice(
              page * HISTORY_PAGE_SIZE,
              page * HISTORY_PAGE_SIZE + HISTORY_PAGE_SIZE,
            )
            const open = historyOpen[config.id] ?? false
            return (
              <div id={`LeaveSettings.configs.${config.id}`} key={config.id} className="rounded border border-gray-100 px-3 py-2">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="font-medium">{config.leaveType}</span>
                  <span>effet {config.effectiveDate}</span>
                  <span>{config.accrualAmount} / {config.accrualFrequency}</span>
                  <span>seuil négatif {config.negativeLimit}</span>
                  <span id={`LeaveSettings.configs.${config.id}.statut`}>{config.active ? 'actif' : 'inactif'}</span>
                  <Button
                    id={`LeaveSettings.configs.${config.id}.toggle`}
                    type="button"
                    disabled={togglingId === config.id}
                    className="!w-auto !px-2 !py-1 !text-xs"
                    onClick={() => void toggleActive(config)}
                  >
                    {config.active ? 'Désactiver' : 'Activer'}
                  </Button>
                  <Button
                    id={`LeaveSettings.configs.${config.id}.historique.toggle`}
                    type="button"
                    className="!w-auto !px-2 !py-1 !text-xs"
                    aria-label="Historique"
                    title={open ? "Masquer l'historique" : "Afficher l'historique"}
                    onClick={() => setHistoryOpen((prev) => ({ ...prev, [config.id]: !open }))}
                  >
                    <Icon name="history" className="h-4 w-4" />
                    Historique
                  </Button>
                </div>

                {open && (
                  <div className="mt-3">
                    <p id={`LeaveSettings.configs.${config.id}.historique.titre`} className="text-xs font-semibold text-gray-600">
                      Historique d'activation / désactivation
                    </p>
                    {config.activations.length > 0 ? (
                      <>
                        <table
                          id={`LeaveSettings.configs.${config.id}.historique.table`}
                          className="mt-1 text-xs"
                          style={{ width: '440px', maxWidth: '100%' }}
                        >
                          <colgroup>
                            <col style={{ width: '150px' }} />
                            <col style={{ width: '110px' }} />
                            <col style={{ width: '180px' }} />
                          </colgroup>
                          <thead>
                            <tr className="text-left text-gray-500">
                              <th id={`LeaveSettings.configs.${config.id}.historique.date.titre`} className="px-2 py-1">Date</th>
                              <th id={`LeaveSettings.configs.${config.id}.historique.statut.titre`} className="px-2 py-1">Statut</th>
                              <th id={`LeaveSettings.configs.${config.id}.historique.user.titre`} className="px-2 py-1">Utilisateur</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pageItems.map((activation) => (
                              <tr id={`LeaveSettings.configs.${config.id}.historique.row.${activation.id}`} key={activation.id}>
                                <td id={`LeaveSettings.configs.${config.id}.historique.row.${activation.id}.date`} className="px-2 py-1">
                                  {formatDateTime(activation.actionDate)}
                                </td>
                                <td id={`LeaveSettings.configs.${config.id}.historique.row.${activation.id}.statut`} className="px-2 py-1">
                                  {activation.action === 'ACTIVATION' ? 'Activation' : 'Désactivation'}
                                </td>
                                <td id={`LeaveSettings.configs.${config.id}.historique.row.${activation.id}.user`} className="px-2 py-1">
                                  {activation.userName ?? '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div style={{ width: '440px', maxWidth: '100%' }}>
                          <Pagination
                            page={page}
                            totalPages={totalPages}
                            total={config.activations.length}
                            onChange={(next) =>
                              setHistoryPages((prev) => ({ ...prev, [config.id]: next }))
                            }
                            idPrefix={`LeaveSettings.configs.${config.id}.historique.pagination`}
                          />
                        </div>
                      </>
                    ) : (
                      <p id={`LeaveSettings.configs.${config.id}.historique.vide`} className="text-xs text-gray-400">Aucun historique</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {(configs ?? []).length === 0 && <p id="LeaveSettings.configs.empty" className="text-gray-400">Aucune configuration</p>}
        </div>
      </Card>
    </div>
  )
}
