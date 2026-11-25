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
  LeaveAcquisitionMode,
  LeaveConfigDto,
  LeaveExpirationPolicy,
  LeaveReferencePeriod,
  LeaveType,
} from '../api/types'

const HISTORY_PAGE_SIZE = 5

const FREQUENCY_LABELS: Record<LeaveAccrualFrequency, string> = {
  MONTHLY: 'Mensuelle',
  QUARTERLY: 'Trimestrielle',
  YEARLY: 'Annuelle',
  ONCE: 'Unique',
}

const MODE_LABELS: Record<LeaveAcquisitionMode, string> = {
  START_OF_PERIOD: 'Début de période',
  END_OF_PERIOD: 'Fin de période',
}

const REFERENCE_LABELS: Record<LeaveReferencePeriod, string> = {
  CALENDAR_YEAR: 'Année civile',
  CUSTOM: 'Cycle personnalisé',
}

const EXPIRATION_LABELS: Record<LeaveExpirationPolicy, string> = {
  NONE: 'Aucune expiration',
  AFTER_DURATION: 'Après une durée',
  FIXED_DATE: 'À une date fixe',
  END_OF_REFERENCE_PERIOD: 'Fin de période de référence',
  MONTH_OF_FOLLOWING_PERIOD: 'Mois de la période suivante',
}

const MAX_DAYS_BY_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function maxDayForMonth(month: number): number {
  return MAX_DAYS_BY_MONTH[month - 1] ?? 31
}

function monthDay(month: number | null | undefined, day: number | null | undefined): string {
  if (month == null || day == null) return '—'
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`
}

/** La date d'effet commence par défaut le 1er janvier de l'année en cours. */
function defaultEffectiveDate(): string {
  return `${new Date().getFullYear()}-01-01`
}

function emptyForm() {
  return {
    leaveType: 'CP' as LeaveType,
    effectiveDate: defaultEffectiveDate(),
    endDate: '',
    active: true,
    accrualAmount: '1',
    accrualFrequency: 'MONTHLY' as LeaveAccrualFrequency,
    acquisitionMode: 'START_OF_PERIOD' as LeaveAcquisitionMode,
    referencePeriod: 'CALENDAR_YEAR' as LeaveReferencePeriod,
    referenceStartMonth: '1',
    referenceStartDay: '1',
    expirationPolicy: 'AFTER_DURATION' as LeaveExpirationPolicy,
    expirationMonths: '12',
    expirationDate: '',
    expirationMonth: '5',
    carryoverAllowed: false,
    carryoverMax: '0',
    carryoverExpirationMonths: '',
    negativeAllowed: true,
    negativeLimit: '0',
  }
}

type LeaveForm = ReturnType<typeof emptyForm>

function formFromConfig(config: LeaveConfigDto): LeaveForm {
  return {
    leaveType: config.leaveType,
    effectiveDate: config.effectiveDate,
    endDate: config.endDate ?? '',
    active: config.active,
    accrualAmount: String(config.accrualAmount),
    accrualFrequency: config.accrualFrequency,
    acquisitionMode: config.acquisitionMode,
    referencePeriod: config.referencePeriod,
    referenceStartMonth: String(config.referenceStartMonth ?? 1),
    referenceStartDay: String(config.referenceStartDay ?? 1),
    expirationPolicy: config.expirationPolicy,
    expirationMonths: config.expirationMonths == null ? '' : String(config.expirationMonths),
    expirationDate: config.expirationDate ?? '',
    expirationMonth: config.expirationMonth == null ? '5' : String(config.expirationMonth),
    carryoverAllowed: config.carryoverAllowed,
    carryoverMax: String(config.carryoverMax),
    carryoverExpirationMonths:
      config.carryoverExpirationMonths == null ? '' : String(config.carryoverExpirationMonths),
    negativeAllowed: config.negativeAllowed,
    negativeLimit: String(config.negativeLimit),
  }
}

function expirationSummary(config: LeaveConfigDto): string {
  switch (config.expirationPolicy) {
    case 'NONE':
      return 'Aucune'
    case 'AFTER_DURATION':
      return config.expirationMonths == null ? '—' : `Après ${config.expirationMonths} mois`
    case 'FIXED_DATE':
      return config.expirationDate ? formatDate(config.expirationDate) : '—'
    case 'END_OF_REFERENCE_PERIOD':
      return 'Fin de période de référence'
    case 'MONTH_OF_FOLLOWING_PERIOD':
      return config.expirationMonth == null ? '—' : `Mois ${config.expirationMonth} (période suivante)`
    default:
      return '—'
  }
}

function referenceSummary(config: LeaveConfigDto): string {
  if (config.referencePeriod === 'CUSTOM') {
    return `Cycle ${monthDay(config.referenceStartMonth, config.referenceStartDay)}`
  }
  return 'Année civile'
}

function reportSummary(config: LeaveConfigDto): string {
  if (!config.carryoverAllowed) return 'Non autorisé'
  const deadline =
    config.carryoverExpirationMonths == null ? '' : ` (échéance ${config.carryoverExpirationMonths} mois)`
  return `Max ${config.carryoverMax} j${deadline}`
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
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [historyOpen, setHistoryOpen] = useState<Record<number, boolean>>({})
  const [historyPages, setHistoryPages] = useState<Record<number, number>>({})
  const [historySearches, setHistorySearches] = useState<Record<number, string>>({})

  function resetForm() {
    setForm(emptyForm())
    setEditingId(null)
    setFormError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    const amount = Number(form.accrualAmount)
    const negativeLimit = Number(form.negativeLimit)
    const carryoverMax = Number(form.carryoverMax)
    const expirationMonths = form.expirationMonths === '' ? null : Number(form.expirationMonths)
    const expirationMonth = form.expirationMonth === '' ? null : Number(form.expirationMonth)
    const carryoverExpirationMonths =
      form.carryoverExpirationMonths === '' ? null : Number(form.carryoverExpirationMonths)

    if (form.endDate !== '' && form.effectiveDate !== '' && form.endDate < form.effectiveDate) {
      setFormError("La date de fin d'application doit être postérieure ou égale à la date d'effet.")
      return
    }
    if (Number.isNaN(amount) || amount <= 0) {
      setFormError('La quantité acquise doit être supérieure à 0.')
      return
    }
    if (form.expirationPolicy === 'AFTER_DURATION') {
      if (expirationMonths == null || !Number.isInteger(expirationMonths) || expirationMonths < 1 || expirationMonths > 120) {
        setFormError("La durée d'expiration doit être comprise entre 1 et 120 mois.")
        return
      }
    }
    if (form.expirationPolicy === 'FIXED_DATE' && form.expirationDate === '') {
      setFormError("La date d'expiration est obligatoire.")
      return
    }
    if (form.expirationPolicy === 'MONTH_OF_FOLLOWING_PERIOD') {
      if (expirationMonth == null || !Number.isInteger(expirationMonth) || expirationMonth < 1 || expirationMonth > 12) {
        setFormError("Le mois d'expiration doit être compris entre 1 et 12.")
        return
      }
    }
    if (form.referencePeriod === 'CUSTOM') {
      const month = Number(form.referenceStartMonth)
      const day = Number(form.referenceStartDay)
      if (!Number.isInteger(month) || month < 1 || month > 12) {
        setFormError('Le mois de début de la période de référence doit être compris entre 1 et 12.')
        return
      }
      if (!Number.isInteger(day) || day < 1 || day > maxDayForMonth(month)) {
        setFormError(`Le jour de début doit être compris entre 1 et ${maxDayForMonth(month)}.`)
        return
      }
    }
    if (form.carryoverAllowed) {
      if (Number.isNaN(carryoverMax) || carryoverMax < 0) {
        setFormError('Le report maximum ne peut pas être négatif.')
        return
      }
      if (carryoverExpirationMonths != null && carryoverExpirationMonths < 0) {
        setFormError("L'échéance du report ne peut pas être négative.")
        return
      }
    }
    if (form.negativeAllowed && (Number.isNaN(negativeLimit) || negativeLimit < 0)) {
      setFormError("Le maximum d'anticipation ne peut pas être négatif.")
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
        acquisitionMode: form.acquisitionMode,
        referencePeriod: form.referencePeriod,
        referenceStartMonth: form.referencePeriod === 'CUSTOM' ? Number(form.referenceStartMonth) : null,
        referenceStartDay: form.referencePeriod === 'CUSTOM' ? Number(form.referenceStartDay) : null,
        expirationPolicy: form.expirationPolicy,
        expirationMonths: form.expirationPolicy === 'AFTER_DURATION' ? expirationMonths : null,
        expirationDate: form.expirationPolicy === 'FIXED_DATE' ? form.expirationDate : null,
        expirationMonth: form.expirationPolicy === 'MONTH_OF_FOLLOWING_PERIOD' ? expirationMonth : null,
        carryoverAllowed: form.carryoverAllowed,
        carryoverMax: form.carryoverAllowed ? carryoverMax : 0,
        carryoverExpirationMonths: form.carryoverAllowed ? carryoverExpirationMonths : null,
        negativeAllowed: form.negativeAllowed,
        negativeLimit: form.negativeAllowed ? negativeLimit : 0,
      })
      resetForm()
      reload()
      dialog.success('Configuration enregistrée')
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(config: LeaveConfigDto) {
    setEditingId(config.id)
    setForm(formFromConfig(config))
    setFormError(null)
  }

  function startDuplicate(config: LeaveConfigDto) {
    setEditingId(null)
    setForm({ ...formFromConfig(config), effectiveDate: defaultEffectiveDate(), active: true })
    setFormError(null)
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

  async function removeConfigCascade(config: LeaveConfigDto) {
    if (
      !(await dialog.confirm(
        `Supprimer en cascade la configuration ${config.leaveType} du ${config.effectiveDate} ? `
          + 'Les droits acquis (lots), les mouvements et l’historique associés seront supprimés définitivement.',
        { variant: 'warning', danger: true, okLabel: 'Supprimer en cascade' },
      ))
    ) {
      return
    }
    setDeletingId(config.id)
    try {
      await leaveApi.deleteConfigCascade(config.id)
      reload()
    } catch (err) {
      void dialog.error(err instanceof ApiError ? err.message : 'Erreur')
    } finally {
      setDeletingId(null)
    }
  }

  const isEdit = editingId !== null

  return (
    <div>
      <PageHeader title="Paramètres congés" titleId="LeaveSettings.title" actions={<RefreshButton onClick={reload} />} />

      {error && <ErrorBlock id="LeaveSettings.error" message={error} />}
      {loading && <LoadingBlock />}

      <div id="LeaveSettings.config" className="mb-6">
        <h3 id="LeaveSettings.config.title" className="mb-3 text-sm font-semibold text-gray-700">
          {isEdit ? 'Modifier une configuration de droits' : 'Nouvelle configuration de droits'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          {formError && <p id="LeaveSettings.formError" className="text-sm text-red-600">{formError}</p>}

          <div className="flex flex-wrap items-stretch gap-3">
          <Card id="LeaveSettings.config.group.general" className="w-fit max-w-full p-3 min-h-[140px]">
            <h4 id="LeaveSettings.config.section.general" className="mb-2 text-sm font-bold text-gray-700">Général</h4>
            <div className="flex flex-wrap gap-2">
              <Field className="w-40" label="Type" id="LeaveSettings.config.type.label">
                <Select id="LeaveSettings.config.type" value={form.leaveType} onChange={(e) => setForm({ ...form, leaveType: e.target.value as LeaveType })}>
                  <option id="LeaveSettings.config.type.cp" value="CP">CP</option>
                  <option id="LeaveSettings.config.type.rtt" value="RTT">RTT</option>
                </Select>
              </Field>
              <Field className="w-40" label="Date d'effet" id="LeaveSettings.config.effectiveDate.label">
                <Input id="LeaveSettings.config.effectiveDate" type="date" value={form.effectiveDate} onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} />
              </Field>
              <Field className="w-40" label="Date de fin d'application" id="LeaveSettings.config.endDate.label">
                <Input id="LeaveSettings.config.endDate" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </Field>
              <Field className="w-40" label="Quantité acquise" id="LeaveSettings.config.amount.label">
                <Input id="LeaveSettings.config.amount" type="number" min="0.01" step="any" value={form.accrualAmount} onChange={(e) => setForm({ ...form, accrualAmount: e.target.value })} />
              </Field>
              <Field className="w-40" label="Fréquence" id="LeaveSettings.config.frequency.label">
                <Select id="LeaveSettings.config.frequency" value={form.accrualFrequency} onChange={(e) => setForm({ ...form, accrualFrequency: e.target.value as LeaveAccrualFrequency })}>
                  <option id="LeaveSettings.config.frequency.monthly" value="MONTHLY">Mensuelle</option>
                  <option id="LeaveSettings.config.frequency.quarterly" value="QUARTERLY">Trimestrielle</option>
                  <option id="LeaveSettings.config.frequency.yearly" value="YEARLY">Annuelle</option>
                  <option id="LeaveSettings.config.frequency.once" value="ONCE">Unique</option>
                </Select>
              </Field>
              <Field className="w-40" label="Active" id="LeaveSettings.config.active.label">
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
          </Card>

          {form.accrualFrequency !== 'ONCE' && (
            <Card id="LeaveSettings.config.group.acquisition" className="w-fit max-w-full p-3 min-h-[140px]">
              <h4 id="LeaveSettings.config.section.acquisition" className="mb-2 text-sm font-bold text-gray-700">Acquisition des droits</h4>
              <div className="flex flex-wrap gap-2">
                <Field className="w-40" label="Mode d'acquisition" id="LeaveSettings.config.acquisitionMode.label">
                  <Select id="LeaveSettings.config.acquisitionMode" value={form.acquisitionMode} onChange={(e) => setForm({ ...form, acquisitionMode: e.target.value as LeaveAcquisitionMode })}>
                    <option id="LeaveSettings.config.acquisitionMode.start" value="START_OF_PERIOD">Début de période</option>
                    <option id="LeaveSettings.config.acquisitionMode.end" value="END_OF_PERIOD">Fin de période</option>
                  </Select>
                </Field>
              </div>
            </Card>
          )}

          <Card id="LeaveSettings.config.group.reference" className="w-fit max-w-full p-3 min-h-[140px]">
            <h4 id="LeaveSettings.config.section.reference" className="mb-2 text-sm font-bold text-gray-700">Période de référence</h4>
            <div className="flex flex-wrap gap-2">
              <Field className="w-40" label="Période de référence" id="LeaveSettings.config.referencePeriod.label">
                <Select id="LeaveSettings.config.referencePeriod" value={form.referencePeriod} onChange={(e) => setForm({ ...form, referencePeriod: e.target.value as LeaveReferencePeriod })}>
                  <option id="LeaveSettings.config.referencePeriod.calendar" value="CALENDAR_YEAR">Année civile</option>
                  <option id="LeaveSettings.config.referencePeriod.custom" value="CUSTOM">Cycle personnalisé</option>
                </Select>
              </Field>
              {form.referencePeriod === 'CUSTOM' && (
                <>
                  <Field className="w-40" label="Mois de début" id="LeaveSettings.config.referenceStartMonth.label">
                    <Input id="LeaveSettings.config.referenceStartMonth" type="number" min="1" max="12" value={form.referenceStartMonth} onChange={(e) => setForm({ ...form, referenceStartMonth: e.target.value })} />
                  </Field>
                  <Field className="w-40" label="Jour de début" id="LeaveSettings.config.referenceStartDay.label">
                    <Input id="LeaveSettings.config.referenceStartDay" type="number" min="1" max="31" value={form.referenceStartDay} onChange={(e) => setForm({ ...form, referenceStartDay: e.target.value })} />
                  </Field>
                </>
              )}
            </div>
          </Card>

          <Card id="LeaveSettings.config.group.expiration" className="w-fit max-w-full p-3 min-h-[140px]">
            <h4 id="LeaveSettings.config.section.expiration" className="mb-2 text-sm font-bold text-gray-700">Expiration</h4>
            <div className="flex flex-wrap gap-2">
              <Field className="w-40" label="Politique d'expiration" id="LeaveSettings.config.expirationPolicy.label">
                <Select id="LeaveSettings.config.expirationPolicy" value={form.expirationPolicy} onChange={(e) => setForm({ ...form, expirationPolicy: e.target.value as LeaveExpirationPolicy })}>
                  <option id="LeaveSettings.config.expirationPolicy.none" value="NONE">Aucune expiration</option>
                  <option id="LeaveSettings.config.expirationPolicy.duration" value="AFTER_DURATION">Après une durée</option>
                  <option id="LeaveSettings.config.expirationPolicy.fixed" value="FIXED_DATE">À une date fixe</option>
                  <option id="LeaveSettings.config.expirationPolicy.referenceEnd" value="END_OF_REFERENCE_PERIOD">Fin de période de référence</option>
                  <option id="LeaveSettings.config.expirationPolicy.followingMonth" value="MONTH_OF_FOLLOWING_PERIOD">Mois de la période suivante</option>
                </Select>
              </Field>
              {form.expirationPolicy === 'AFTER_DURATION' && (
                <Field className="w-40" label="Durée (mois)" id="LeaveSettings.config.expirationMonths.label">
                  <Input id="LeaveSettings.config.expirationMonths" type="number" min="1" max="120" value={form.expirationMonths} onChange={(e) => setForm({ ...form, expirationMonths: e.target.value })} />
                </Field>
              )}
              {form.expirationPolicy === 'FIXED_DATE' && (
                <Field className="w-40" label="Date d'expiration" id="LeaveSettings.config.expirationDate.label">
                  <Input id="LeaveSettings.config.expirationDate" type="date" value={form.expirationDate} onChange={(e) => setForm({ ...form, expirationDate: e.target.value })} />
                </Field>
              )}
              {form.expirationPolicy === 'MONTH_OF_FOLLOWING_PERIOD' && (
                <Field className="w-40" label="Mois de la période suivante" id="LeaveSettings.config.expirationMonth.label">
                  <Input id="LeaveSettings.config.expirationMonth" type="number" min="1" max="12" value={form.expirationMonth} onChange={(e) => setForm({ ...form, expirationMonth: e.target.value })} />
                </Field>
              )}
            </div>
          </Card>

          <Card id="LeaveSettings.config.group.carryover" className="w-fit max-w-full p-3 min-h-[140px]">
            <h4 id="LeaveSettings.config.section.carryover" className="mb-2 text-sm font-bold text-gray-700">Report des droits</h4>
            <div className="flex flex-wrap items-end gap-2">
              <Field className="w-48" label="Autoriser le report" id="LeaveSettings.config.carryoverAllowed.label">
                <label id="LeaveSettings.config.carryoverAllowed.wrapper" className="flex h-full items-center gap-2 text-sm text-gray-700">
                  <input
                    id="LeaveSettings.config.carryoverAllowed"
                    type="checkbox"
                    checked={form.carryoverAllowed}
                    onChange={(e) => setForm({ ...form, carryoverAllowed: e.target.checked })}
                  />
                  {form.carryoverAllowed ? 'Oui' : 'Non'}
                </label>
              </Field>
              {form.carryoverAllowed && (
                <>
                  <Field className="w-48" label="Report maximum (jours)" id="LeaveSettings.config.carryoverMax.label">
                    <Input id="LeaveSettings.config.carryoverMax" type="number" min="0" step="any" value={form.carryoverMax} onChange={(e) => setForm({ ...form, carryoverMax: e.target.value })} />
                  </Field>
                  <Field className="w-56" label="Échéance du report (mois)" id="LeaveSettings.config.carryoverExpirationMonths.label">
                    <Input id="LeaveSettings.config.carryoverExpirationMonths" type="number" min="0" value={form.carryoverExpirationMonths} onChange={(e) => setForm({ ...form, carryoverExpirationMonths: e.target.value })} />
                  </Field>
                </>
              )}
            </div>
          </Card>

          <Card id="LeaveSettings.config.group.negative" className="w-fit max-w-full p-3 min-h-[140px]">
            <h4 id="LeaveSettings.config.section.negative" className="mb-2 text-sm font-bold text-gray-700">Solde négatif</h4>
            <div className="flex flex-wrap gap-2">
              <Field className="w-40" label="Solde négatif autorisé" id="LeaveSettings.config.negativeAllowed.label">
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
              {form.negativeAllowed && (
                <Field className="w-40" label="Maximum d'anticipation (jours)" id="LeaveSettings.config.negativeLimit.label">
                  <Input id="LeaveSettings.config.negativeLimit" type="number" min="0" step="any" value={form.negativeLimit} onChange={(e) => setForm({ ...form, negativeLimit: e.target.value })} />
                </Field>
              )}
            </div>
          </Card>
          </div>

          <p id="LeaveSettings.config.creditHint" className="text-xs text-gray-500">
            Les droits sont crédités au début ou à la fin de chaque période, selon le mode d'acquisition.
            La date d'effet commence par défaut le 1er janvier de l'année en cours.
          </p>
          <p id="LeaveSettings.config.hireDateHint" className="text-xs text-gray-500">
            Les droits sont calculés à partir de la date d'embauche du salarié (ou de la date d'effet si elle est postérieure).
          </p>

          <div className="flex gap-2">
            <Button type="submit" id="LeaveSettings.config.submit" disabled={saving}>{saving ? '...' : 'Enregistrer'}</Button>
            {isEdit && (
              <Button type="button" id="LeaveSettings.config.cancel" variant="neutral" onClick={resetForm}>
                Annuler
              </Button>
            )}
          </div>
        </form>
      </div>

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
            MODE_LABELS[config.acquisitionMode],
            REFERENCE_LABELS[config.referencePeriod],
            referenceSummary(config),
            EXPIRATION_LABELS[config.expirationPolicy],
            expirationSummary(config),
            reportSummary(config),
            config.negativeAllowed ? `${config.negativeLimit}` : 'Non autorisé',
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
              key: 'LeaveSettings.configs.col.acquisition',
              label: 'Acquisition',
              render: (config) => (
                <span id={`LeaveSettings.configs.${config.id}.param.acquisition`}>
                  {config.accrualAmount} j — {FREQUENCY_LABELS[config.accrualFrequency]}
                  {config.accrualFrequency !== 'ONCE' && ` (${MODE_LABELS[config.acquisitionMode]})`}
                </span>
              ),
            },
            {
              key: 'LeaveSettings.configs.col.reference',
              label: 'Période de référence',
              render: (config) => (
                <span id={`LeaveSettings.configs.${config.id}.param.reference`}>
                  {referenceSummary(config)}
                </span>
              ),
            },
            {
              key: 'LeaveSettings.configs.col.expiration',
              label: 'Expiration',
              render: (config) => (
                <span id={`LeaveSettings.configs.${config.id}.param.expiration`}>
                  {expirationSummary(config)}
                </span>
              ),
            },
            {
              key: 'LeaveSettings.configs.col.report',
              label: 'Report',
              render: (config) => (
                <span id={`LeaveSettings.configs.${config.id}.param.report`}>
                  {reportSummary(config)}
                </span>
              ),
            },
            {
              key: 'LeaveSettings.configs.col.negative',
              label: 'Anticipation',
              render: (config) => (
                <span id={`LeaveSettings.configs.${config.id}.param.negative`}>
                  {config.negativeAllowed ? `${config.negativeLimit} j` : 'Non autorisé'}
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
                  <Button
                    id={`LeaveSettings.configs.${config.id}.modifier`}
                    type="button"
                    className="!w-auto !px-2 !py-1 !text-xs"
                    onClick={() => startEdit(config)}
                  >
                    Modifier
                  </Button>
                  <Button
                    id={`LeaveSettings.configs.${config.id}.dupliquer`}
                    type="button"
                    className="!w-auto !px-2 !py-1 !text-xs"
                    onClick={() => startDuplicate(config)}
                  >
                    Dupliquer
                  </Button>
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
                  <Button
                    id={`LeaveSettings.configs.${config.id}.supprimerCascade`}
                    type="button"
                    variant="danger"
                    disabled={deletingId === config.id}
                    className="!w-auto !px-2 !py-1 !text-xs"
                    title="Supprimer la configuration et tous ses droits acquis"
                    onClick={() => void removeConfigCascade(config)}
                  >
                    Supprimer en cascade
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
