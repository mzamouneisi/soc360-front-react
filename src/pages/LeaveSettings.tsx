import { useState, type FormEvent } from 'react'
import { tr } from '../i18n/translate'
import { useAuth } from '../auth/AuthContext'
import { leaveApi } from '../api/leave'
import { ApiError } from '../api/client'
import { useAsync } from '../lib/useAsync'
import { useSoc } from '../soc/SocContext'
import { Button, Card, Field, Input, RefreshButton, Select } from '../components/ui'
import { ErrorBlock, LoadingBlock, PageHeader, Pagination, Table } from '../components/data'
import { Icon } from '../components/icons'
import { dialog } from '../components/dialog'
import { formatDate, formatDateTime } from '../lib/format'
import { filterRows } from '../lib/tableSearch'
import type {
  LeaveAccrualFrequency,
  LeaveConfigDto,
  LeaveType,
} from '../api/types'

const HISTORY_PAGE_SIZE = 5

const FREQUENCY_LABELS: Record<LeaveAccrualFrequency, string> = {
  MONTHLY: 'Mensuelle',
  QUARTERLY: 'Trimestrielle',
  YEARLY: 'Annuelle',
  ONCE: 'Unique',
}

/** La date d'effet commence par défaut le 1er jour du mois courant. */
function firstDayOfCurrentMonth(): string {
  return `${new Date().toISOString().slice(0, 7)}-01`
}

function monthDay(month: number | null | undefined, day: number | null | undefined): string {
  if (month == null || day == null) return '—'
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`
}

function emptyForm() {
  return {
    leaveType: 'CP' as LeaveType,
    effectiveDate: firstDayOfCurrentMonth(),
    endDate: '',
    accrualAmount: '1',
    accrualFrequency: 'MONTHLY' as LeaveAccrualFrequency,
    expirationMonths: '12',
    negativeLimit: '0',
    negativeAllowed: true,
    active: true,
  }
}

export function LeaveSettings() {
  const { user } = useAuth()
  const { selectedSocId } = useSoc()
  const socId = selectedSocId ?? user?.socId ?? null

  const { data: configs, loading, error, reload } = useAsync(
    () => (socId ? leaveApi.configs(socId) : Promise.resolve([])),
    [socId],
  )
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [historyOpen, setHistoryOpen] = useState<Record<number, boolean>>({})
  const [historyPages, setHistoryPages] = useState<Record<number, number>>({})
  const [historySearches, setHistorySearches] = useState<Record<number, string>>({})

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    const amount = Number(form.accrualAmount)
    const negativeLimit = Number(form.negativeLimit)
    const expirationMonths = form.expirationMonths === '' ? null : Number(form.expirationMonths)

    if (form.endDate !== '' && form.effectiveDate !== '' && form.endDate < form.effectiveDate) {
      setFormError("La date de fin d'application doit être postérieure ou égale à la date d'effet.")
      return
    }
    if (!Number.isInteger(expirationMonths) && expirationMonths !== null) {
      setFormError("L'expiration (mois) doit être un nombre entier.")
      return
    }
    if (Number.isNaN(amount) || amount <= 0) {
      setFormError('La quantité acquise doit être supérieure à 0.')
      return
    }
    if (Number.isNaN(negativeLimit) || negativeLimit < 0) {
      setFormError('Le seuil négatif ne peut pas être négatif.')
      return
    }
    if (
      expirationMonths !== null &&
      (Number.isNaN(expirationMonths) || expirationMonths < 1 || expirationMonths > 12)
    ) {
      setFormError("L'expiration (mois) doit être comprise entre 1 et 12.")
      return
    }
    setSaving(true)
    try {
      await leaveApi.saveConfig({
        socId,
        leaveType: form.leaveType,
        effectiveDate: form.effectiveDate,
        endDate: form.endDate === '' ? null : form.endDate,
        active: form.active,
        accrualAmount: amount,
        accrualFrequency: form.accrualFrequency,
        expirationMonths,
        negativeLimit,
        negativeAllowed: form.negativeAllowed,
      })
      // Après enregistrement, le formulaire est réinitialisé pour une nouvelle saisie.
      setForm(emptyForm())
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

  async function removeConfig(config: LeaveConfigDto) {
    if (
      !(await dialog.confirm(
        `Supprimer la configuration ${config.leaveType} du ${config.effectiveDate} ?`,
        { variant: 'warning', danger: true, okLabel: 'Supprimer' },
      ))
    ) {
      return
    }
    setDeletingId(config.id)
    try {
      await leaveApi.deleteConfig(config.id)
      reload()
    } catch (err) {
      void dialog.error(err instanceof ApiError ? err.message : 'Erreur')
    } finally {
      setDeletingId(null)
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
            <Field label="Date de fin d'application" id="LeaveSettings.config.endDate.label">
              <Input id="LeaveSettings.config.endDate" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </Field>
            <Field label="Quantité acquise" id="LeaveSettings.config.amount.label">
              <Input id="LeaveSettings.config.amount" type="number" min="0.01" step="any" value={form.accrualAmount} onChange={(e) => setForm({ ...form, accrualAmount: e.target.value })} />
            </Field>
            <Field label="Fréquence" id="LeaveSettings.config.frequency.label">
              <Select id="LeaveSettings.config.frequency" value={form.accrualFrequency} onChange={(e) => setForm({ ...form, accrualFrequency: e.target.value as LeaveAccrualFrequency })}>
                <option id="LeaveSettings.config.frequency.monthly" value="MONTHLY">Mensuelle</option>
                <option id="LeaveSettings.config.frequency.quarterly" value="QUARTERLY">Trimestrielle</option>
                <option id="LeaveSettings.config.frequency.yearly" value="YEARLY">Annuelle</option>
                <option id="LeaveSettings.config.frequency.once" value="ONCE">Unique</option>
              </Select>
            </Field>
            <Field label="Expiration (mois)" id="LeaveSettings.config.expiration.label">
              <Input id="LeaveSettings.config.expiration" type="number" min="1" max="12" step="1" value={form.expirationMonths} onChange={(e) => setForm({ ...form, expirationMonths: e.target.value })} />
            </Field>
            <Field label="Seuil négatif" id="LeaveSettings.config.negative.label">
              <Input id="LeaveSettings.config.negative" type="number" min="0" value={form.negativeLimit} onChange={(e) => setForm({ ...form, negativeLimit: e.target.value })} />
            </Field>
            <Field label="Solde négatif autorisé" id="LeaveSettings.config.negativeAllowed.label">
              <label id="LeaveSettings.config.negativeAllowed.wrapper" className="flex h-full items-center gap-2 text-sm text-gray-700">
                <input
                  id="LeaveSettings.config.negativeAllowed"
                  type="checkbox"
                  checked={form.negativeAllowed}
                  onChange={(e) => setForm({ ...form, negativeAllowed: e.target.checked })}
                />
                {form.negativeAllowed ? 'Oui' : 'Non'}
              </label>
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
          <p id="LeaveSettings.config.creditHint" className="text-xs text-gray-500">
            Les droits sont crédités au jour et au mois de la date d'effet, selon la fréquence choisie.
            La date d'effet commence par défaut le 1er jour du mois.
          </p>
          <p id="LeaveSettings.config.hireDateHint" className="text-xs text-gray-500">
            Les droits sont calculés à partir de la date d'embauche du salarié (ou de la date d'effet si elle est postérieure).
          </p>
          <Button type="submit" id="LeaveSettings.config.submit" disabled={saving}>{saving ? '...' : 'Enregistrer'}</Button>
        </form>
      </Card>

      <Card id="LeaveSettings.configs" className="mb-6 p-5">
        <h2 id="LeaveSettings.configs.title" className="mb-3 text-lg font-semibold text-gray-800">Configurations existantes</h2>
        <Table
          paginate
          paginationId="LeaveSettings.configs"
          searchId="LeaveSettings.configs.search"
          rowKey={(config) => config.id}
          rows={configs ?? []}
          empty={<p id="LeaveSettings.configs.empty" className="text-gray-400">Aucune configuration</p>}
          searchableText={(config) => [
            config.leaveType,
            formatDate(config.effectiveDate),
            config.endDate ? formatDate(config.endDate) : '',
            config.accrualAmount,
            FREQUENCY_LABELS[config.accrualFrequency],
            monthDay(config.acquisitionStartMonth, config.acquisitionStartDay),
            monthDay(config.acquisitionEndMonth, config.acquisitionEndDay),
            monthDay(config.usageStartMonth, config.usageStartDay),
            monthDay(config.usageEndMonth, config.usageEndDay),
            config.expirationMonths ?? '',
            config.carryoverMax,
            config.carryoverExpirationMonths ?? '',
            config.negativeLimit,
            config.negativeAllowed ? 'Oui' : 'Non',
            config.active ? 'Actif' : 'Inactif',
          ].join(' ')}
          columns={[
            {
              key: 'LeaveSettings.configs.col.type',
              label: 'Type',
              render: (config) => (
                <span id={`LeaveSettings.configs.${config.id}.param.type`} className="font-medium">
                  {config.leaveType}
                </span>
              ),
            },
            {
              key: 'LeaveSettings.configs.col.effectiveDate',
              label: "Date d'effet",
              render: (config) => (
                <span id={`LeaveSettings.configs.${config.id}.param.effectiveDate`}>
                  {formatDate(config.effectiveDate)}
                </span>
              ),
            },
            {
              key: 'LeaveSettings.configs.col.endDate',
              label: "Fin d'application",
              render: (config) => (
                <span id={`LeaveSettings.configs.${config.id}.param.endDate`}>
                  {config.endDate ? formatDate(config.endDate) : '—'}
                </span>
              ),
            },
            {
              key: 'LeaveSettings.configs.col.accrualAmount',
              label: 'Quantité acquise',
              render: (config) => (
                <span id={`LeaveSettings.configs.${config.id}.param.accrualAmount`}>
                  {config.accrualAmount}
                </span>
              ),
            },
            {
              key: 'LeaveSettings.configs.col.accrualFrequency',
              label: 'Fréquence',
              render: (config) => (
                <span id={`LeaveSettings.configs.${config.id}.param.accrualFrequency`}>
                  {FREQUENCY_LABELS[config.accrualFrequency]}
                </span>
              ),
            },
            {
              key: 'LeaveSettings.configs.col.acquisitionStart',
              label: "Début d'acquisition",
              render: (config) => (
                <span id={`LeaveSettings.configs.${config.id}.param.acquisitionStart`}>
                  {monthDay(config.acquisitionStartMonth, config.acquisitionStartDay)}
                </span>
              ),
            },
            {
              key: 'LeaveSettings.configs.col.acquisitionEnd',
              label: "Fin d'acquisition",
              render: (config) => (
                <span id={`LeaveSettings.configs.${config.id}.param.acquisitionEnd`}>
                  {monthDay(config.acquisitionEndMonth, config.acquisitionEndDay)}
                </span>
              ),
            },
            {
              key: 'LeaveSettings.configs.col.usageStart',
              label: "Début d'utilisation",
              render: (config) => (
                <span id={`LeaveSettings.configs.${config.id}.param.usageStart`}>
                  {monthDay(config.usageStartMonth, config.usageStartDay)}
                </span>
              ),
            },
            {
              key: 'LeaveSettings.configs.col.usageEnd',
              label: "Fin d'utilisation",
              render: (config) => (
                <span id={`LeaveSettings.configs.${config.id}.param.usageEnd`}>
                  {monthDay(config.usageEndMonth, config.usageEndDay)}
                </span>
              ),
            },
            {
              key: 'LeaveSettings.configs.col.expirationMonths',
              label: 'Expiration (mois)',
              render: (config) => (
                <span id={`LeaveSettings.configs.${config.id}.param.expirationMonths`}>
                  {config.expirationMonths ?? '—'}
                </span>
              ),
            },
            {
              key: 'LeaveSettings.configs.col.carryoverMax',
              label: 'Report maximum',
              render: (config) => (
                <span id={`LeaveSettings.configs.${config.id}.param.carryoverMax`}>
                  {config.carryoverMax}
                </span>
              ),
            },
            {
              key: 'LeaveSettings.configs.col.carryoverExpirationMonths',
              label: 'Expiration du report (mois)',
              render: (config) => (
                <span id={`LeaveSettings.configs.${config.id}.param.carryoverExpirationMonths`}>
                  {config.carryoverExpirationMonths ?? '—'}
                </span>
              ),
            },
            {
              key: 'LeaveSettings.configs.col.negativeLimit',
              label: 'Seuil négatif',
              render: (config) => (
                <span id={`LeaveSettings.configs.${config.id}.param.negativeLimit`}>
                  {config.negativeLimit}
                </span>
              ),
            },
            {
              key: 'LeaveSettings.configs.col.negativeAllowed',
              label: 'Solde négatif autorisé',
              render: (config) => (
                <span id={`LeaveSettings.configs.${config.id}.param.negativeAllowed`}>
                  {config.negativeAllowed ? 'Oui' : 'Non'}
                </span>
              ),
            },
            {
              key: 'LeaveSettings.configs.col.active',
              label: 'Statut',
              render: (config) => (
                <span id={`LeaveSettings.configs.${config.id}.statut`}>
                  {config.active ? 'Actif' : 'Inactif'}
                </span>
              ),
            },
            {
              key: 'LeaveSettings.configs.col.actions',
              label: 'Actions',
              render: (config) => (
                <div className="flex flex-wrap gap-2">
                  {config.deletable && (
                    <Button
                      id={`LeaveSettings.configs.${config.id}.supprimer`}
                      type="button"
                      variant="danger"
                      disabled={deletingId === config.id}
                      className="!w-auto !px-2 !py-1 !text-xs"
                      onClick={() => void removeConfig(config)}
                    >
                      Supprimer
                    </Button>
                  )}
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
                    title={historyOpen[config.id] ? "Masquer l'historique" : "Afficher l'historique"}
                    onClick={() =>
                      setHistoryOpen((prev) => ({ ...prev, [config.id]: !prev[config.id] }))
                    }
                  >
                    <Icon name="history" className="h-4 w-4" />
                    Historique
                  </Button>
                </div>
              ),
            },
          ]}
        />

        {(configs ?? []).filter((config) => historyOpen[config.id]).map((config) => {
          const search = historySearches[config.id] ?? ''
          const filteredActivations = filterRows(
            config.activations,
            search,
            (a) => `${a.actionDate} ${a.action} ${a.userName ?? ''}`,
          )
          const totalPages = Math.max(1, Math.ceil(filteredActivations.length / HISTORY_PAGE_SIZE))
          const page = Math.min(historyPages[config.id] ?? 0, totalPages - 1)
          const pageItems = filteredActivations.slice(
            page * HISTORY_PAGE_SIZE,
            page * HISTORY_PAGE_SIZE + HISTORY_PAGE_SIZE,
          )
          return (
            <div
              id={`LeaveSettings.configs.${config.id}.historique`}
              key={config.id}
              className="mt-3 rounded border border-gray-100 px-3 py-2 text-sm text-gray-700"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p id={`LeaveSettings.configs.${config.id}.historique.titre`} className="text-xs font-semibold text-gray-600">
                  Historique d'activation / désactivation — {config.leaveType} ({formatDate(config.effectiveDate)})
                </p>
                <Button
                  id={`LeaveSettings.configs.${config.id}.historique.fermer`}
                  type="button"
                  className="!w-auto !px-2 !py-1 !text-xs"
                  onClick={() => setHistoryOpen((prev) => ({ ...prev, [config.id]: false }))}
                >
                  Fermer
                </Button>
              </div>
              {config.activations.length > 0 && (
                <div className="mt-1 max-w-xs">
                  <Input
                    id={`LeaveSettings.configs.${config.id}.historique.search`}
                    type="search"
                    className="!py-1 !text-xs"
                    placeholder={tr('common.searchPlaceholder')}
                    aria-label={tr('common.searchPlaceholder')}
                    value={search}
                    onChange={(e) =>
                      setHistorySearches((prev) => ({ ...prev, [config.id]: e.target.value }))
                    }
                  />
                </div>
              )}
              {config.activations.length > 0 && filteredActivations.length === 0 && (
                <p id={`LeaveSettings.configs.${config.id}.historique.search.empty`} className="mt-1 text-xs text-gray-400">
                  {tr('common.noResults')}
                </p>
              )}
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
                      total={filteredActivations.length}
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
          )
        })}
      </Card>
    </div>
  )
}
