import { tr } from '../i18n/translate'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { crasApi } from '../api/cras'
import { activitiesApi } from '../api/activities'
import { holidaysApi } from '../api/holidays'
import { socHolidaysApi } from '../api/socHolidays'
import { ApiError } from '../api/client'
import { useAsync } from '../lib/useAsync'
import { useDynamicTranslate } from '../lib/useDynamicTranslate'
import { usePagination } from '../lib/usePagination'
import { Button, Card, Field, IconButton, InlineButton, Input, RefreshButton, Select, Spinner, Textarea } from '../components/ui'
import { Badge, ErrorBlock, LoadingBlock, Modal, Pagination } from '../components/data'
import { dialog } from '../components/dialog'
import { CraHistoryModal } from '../components/CraHistoryModal'
import {
  CRA_STATUS_LABELS,
  DAY_TYPE_LABELS,
  formatNumber,
  getFormatLocale,
  monthLabel,
  statusBadge,
} from '../lib/format'
import type { CraDto, DayType, ActivityDto, SaveCraRequest } from '../api/types'
import type { ReactNode } from 'react'

interface EditableActivity {
  id: string
  activityId: string
  days: string
  comment: string
  valid: boolean
}

interface EditableDay {
  date: string
  dayType: DayType
  workedHours: string
  comment: string
  activities: EditableActivity[]
}

const DAY_TYPES: DayType[] = ['WORKED', 'WEEKEND', 'PUBLIC_HOLIDAY', 'LEAVE', 'SICK_LEAVE', 'OTHER']
const DAY_VALUES = ['0.5', '1']
const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function dayToEditable(day: CraDto['days'][number]): EditableDay {
  return {
    date: day.date,
    dayType: day.dayType,
    workedHours: day.workedHours != null ? String(day.workedHours) : '',
    comment: day.comment ?? '',
    activities: day.activities.map((a) => ({
      id: String(a.id),
      activityId: String(a.activityId),
      days: a.days != null ? String(a.days) : '1',
      comment: a.comment ?? '',
      valid: a.valid ?? false,
    })),
  }
}

function activityDays(a: EditableActivity): number {
  return a.activityId ? Number(a.days) || 0 : 0
}

function dayTotal(day: EditableDay): number {
  return day.activities.reduce((sum, a) => sum + activityDays(a), 0)
}

function dayIsValid(day: EditableDay): boolean {
  return day.dayType !== 'WORKED' || Math.abs(dayTotal(day) - 1) < 1e-9
}

function allowedDaysFor(day: EditableDay, actIndex: number): string[] {
  const act = day.activities[actIndex]
  const current = act ? activityDays(act) : 0
  const other = dayTotal(day) - current
  const allowed = DAY_VALUES.filter((v) => other + Number(v) <= 1 + 1e-9)
  if (act?.days && !allowed.includes(act.days)) allowed.push(act.days)
  return allowed
}

function formatDays(value: number): string {
  return Number.isInteger(value) ? `${value} j` : `${formatNumber(value)} j`
}

function dayBackground(dayType: DayType | undefined): string {
  switch (dayType) {
    case 'LEAVE':
      return 'bg-yellow-100'
    case 'PUBLIC_HOLIDAY':
      return 'bg-orange-100'
    case 'WORKED':
    case undefined:
      return 'bg-white'
    default:
      return 'bg-gray-50'
  }
}

function activityDayRestriction(
  dayType: DayType,
  activity?: ActivityDto | null,
): string | null {
  if (!activity) return null
  if (dayType === 'WEEKEND' && !activity.weekendAllowed) {
    return 'Cette activité n’autorise pas le week-end.'
  }
  if (dayType === 'PUBLIC_HOLIDAY' && !activity.holidayAllowed) {
    return 'Cette activité n’autorise pas les jours fériés.'
  }
  return null
}

function statusAdjective(status: CraDto['status'], indispo: boolean): string {
  const label = CRA_STATUS_LABELS[status] ?? status
  if (!indispo) return label.toLowerCase()
  switch (status) {
    case 'SUBMITTED':
      return 'soumise'
    case 'VALIDATED':
      return 'validée'
    case 'VALREJ':
      return 'partiellement validée'
    case 'REJECTED':
      return 'rejetée'
    case 'CANCELLED':
      return 'annulée'
    default:
      return label.toLowerCase()
  }
}

function ActivityChip({
  color,
  name,
  days,
  valid,
  onClick,
}: {
  color?: string | null
  name: string
  days: number
  valid?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-1.5 rounded-md bg-gray-100 px-1.5 py-1 text-left text-xs font-medium text-gray-700 transition hover:bg-gray-200"
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: color ?? '#9ca3af' }}
      />
      <span className="truncate">{name}</span>
      <span className="ml-auto shrink-0 text-gray-400">{tr('CraDetail.')}{days}</span>
      {valid && <span className="shrink-0 text-green-600">✓</span>}
    </button>
  )
}

export function CraDetail({
  id,
  onClose,
  onChange,
}: {
  id: number
  onClose?: () => void
  onChange?: () => void
}) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const dt = useDynamicTranslate()

  const { data: cra, loading, error, setData, reload } = useAsync(
    () => crasApi.getById(id),
    [id],
  )

  const { data: activities } = useAsync(
    () => {
      const params: { socId?: number; consultantId?: number } = {}
      if (user?.socId) params.socId = user.socId
      if (cra?.consultantId) params.consultantId = cra.consultantId
      return activitiesApi.findAll(params)
    },
    [user?.socId, cra?.consultantId],
  )

  const [tab, setTab] = useState<'calendar' | 'ligne'>('calendar')
  const [days, setDays] = useState<EditableDay[]>([])
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [eventModal, setEventModal] = useState<number | null>(null)
  const [fillMonthOpen, setFillMonthOpen] = useState(false)
  const [fillRangeOpen, setFillRangeOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [holidays, setHolidays] = useState<Map<string, string>>(new Map())
  const [rangeModal, setRangeModal] = useState<'validate' | 'invalidate' | null>(null)
  const [sending, setSending] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [sendBackOpen, setSendBackOpen] = useState(false)
  const [restrictionDialog, setRestrictionDialog] = useState<string | null>(null)

  useEffect(() => {
    if (cra) setDays(cra.days.map(dayToEditable))
  }, [cra])

  useEffect(() => {
    if (!cra) return
    let cancelled = false
    setHolidays(new Map())
    Promise.all([
      holidaysApi.findByCountryYear('FR', cra.year).catch(() => []),
      socHolidaysApi.list(cra.year).catch(() => []),
    ]).then(([national, soc]) => {
      if (cancelled) return
      const map = new Map<string, string>()
      for (const h of national) map.set(h.date, h.label)
      for (const h of soc) map.set(h.date, h.label)
      setHolidays(map)
    })
    return () => {
      cancelled = true
    }
  }, [cra?.year])

  useEffect(() => {
    if (holidays.size === 0) return
    setDays((prev) =>
      prev.map((d) => {
        if (holidays.has(d.date) && d.dayType === 'WORKED' && d.activities.length === 0) {
          return { ...d, dayType: 'PUBLIC_HOLIDAY' }
        }
        return d
      }),
    )
  }, [holidays])

  const activityMap = useMemo(
    () => new Map((activities ?? []).map((a) => [String(a.id), a])),
    [activities],
  )

  const filteredActivities = useMemo(() => {
    const acts = activities ?? []
    if (cra?.type === 'CONGE') {
      return acts.filter((a) => a.indispo)
    }
    return acts.filter((a) => !a.indispo)
  }, [activities, cra?.type])

  const monthActivities = useMemo(() => {
    if (!cra) return []
    const mm = String(cra.month).padStart(2, '0')
    const first = `${cra.year}-${mm}-01`
    const last = `${cra.year}-${mm}-${String(new Date(cra.year, cra.month, 0).getDate()).padStart(2, '0')}`
    const acts = filteredActivities
    const overlapsMonth = (a: ActivityDto) =>
      a.active &&
      (!a.startDate || a.startDate <= last) &&
      (!a.endDate || a.endDate >= first)
    const consultantMonth = acts.filter(
      (a) => a.consultant?.id === cra.consultantId && overlapsMonth(a),
    )
    if (consultantMonth.length > 0) return consultantMonth
    return acts.filter(overlapsMonth)
  }, [filteredActivities, cra])

  const activityRestriction = useMemo(() => {
    for (const d of days) {
      for (const a of d.activities) {
        if (!a.activityId) continue
        const msg = activityDayRestriction(d.dayType, activityMap.get(a.activityId) ?? null)
        if (msg) return msg
      }
    }
    return null
  }, [days, activityMap])

  const incompleteDays = useMemo(() => {
    if (cra?.type === 'CONGE') return []
    return days.filter((d) => !dayIsValid(d))
  }, [days, cra])
  const craValid = incompleteDays.length === 0
  const hasAnyActivity = days.some((d) => d.activities.length > 0)
  const dayPage = usePagination(days, user?.pageSize ?? 5)

  if (!cra) {
    if (loading) return <LoadingBlock />
    if (error) return <ErrorBlock message={error} />
    return null
  }

  const isIndispo = cra.type === 'CONGE'
  const isConsultant = user?.role === 'CONSULTANT'
  const isAdminOrResp = user?.role === 'ADMIN' || user?.role === 'RESPONSIBLE_SOC'
  const isManagerOfConsultant = user?.role === 'MANAGER' && cra.managerId === user.id
  const canValidate = isAdminOrResp || isManagerOfConsultant

  const editable = cra.status === 'DRAFT' || cra.status === 'REJECTED' || cra.status === 'CANCELLED'
  const managerEditsValidated =
    canValidate &&
    (cra.status === 'SUBMITTED' ||
      cra.status === 'PENDING_SEND' ||
      cra.status === 'VALIDATED' ||
      cra.status === 'VALREJ')
  const consultantAddsToValidated = isConsultant && isIndispo && cra.status === 'VALIDATED'
  const consultantEditsSemiValid = isConsultant && cra.status === 'VALREJ'
  const formEditable = editable || managerEditsValidated
  const canAddEvents = formEditable || consultantAddsToValidated || consultantEditsSemiValid

  // Le consultant ne peut pas modifier une activité validée (le manager peut).
  function canModifyActivity(act: EditableActivity): boolean {
    if (!isConsultant) return true
    return !act.valid
  }

  const managerCanAct =
    canValidate &&
    (cra.status === 'SUBMITTED' ||
      cra.status === 'PENDING_SEND' ||
      cra.status === 'VALIDATED' ||
      cra.status === 'VALREJ' ||
      cra.status === 'CANCELLED' ||
      cra.status === 'REJECTED')
  const canCancel = isConsultant && isIndispo && (cra.status === 'VALIDATED' || cra.status === 'SUBMITTED' || cra.status === 'PENDING_SEND')

  const hasInactiveEvent = days.some((d) => d.activities.some((a) => !a.valid))
  const hasActiveEvent = days.some((d) => d.activities.some((a) => a.valid))

  function updateDay(index: number, patch: Partial<EditableDay>) {
    setDays((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)))
  }

  function updateActivity(dayIndex: number, actIndex: number, patch: Partial<EditableActivity>) {
    if (patch.activityId !== undefined) {
      const day = days[dayIndex]
      const activity = activityMap.get(patch.activityId) ?? null
      const restriction = day ? activityDayRestriction(day.dayType, activity) : null
      if (restriction) {
        setRestrictionDialog(restriction)
        return
      }
    }
    if (patch.days !== undefined) {
      const day = days[dayIndex]
      const act = day?.activities[actIndex]
      const current = act ? activityDays(act) : 0
      const other = day ? dayTotal(day) - current : 0
      if (other + Number(patch.days) > 1 + 1e-9) {
        setFormError('Le total du jour ne peut pas dépasser 1 jour.')
        return
      }
    }
    setDays((prev) =>
      prev.map((d, i) =>
        i === dayIndex
          ? {
              ...d,
              activities: d.activities.map((a, j) => (j === actIndex ? { ...a, ...patch } : a)),
            }
          : d,
      ),
    )
  }

  function addActivity(dayIndex: number) {
    const day = days[dayIndex]
    if (!day || dayTotal(day) >= 1) {
      setFormError('Le total du jour ne peut pas dépasser 1 jour.')
      return
    }
    const remaining = 1 - dayTotal(day)
    const defaultDays = remaining >= 1 ? '1' : '0.5'
    setDays((prev) =>
      prev.map((d, i) =>
        i === dayIndex
          ? {
              ...d,
              activities: [
                ...d.activities,
                {
                  id: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                  activityId: '',
                  days: defaultDays,
                  comment: '',
                  valid: false,
                },
              ],
            }
          : d,
      ),
    )
  }

  function removeActivity(dayIndex: number, actIndex: number) {
    setDays((prev) =>
      prev.map((d, i) =>
        i === dayIndex
          ? { ...d, activities: d.activities.filter((_, j) => j !== actIndex) }
          : d,
      ),
    )
  }

  function removeAllEvents() {
    setDays((prev) => prev.map((d) => ({ ...d, activities: [] })))
  }

  function buildSaveRequest(): SaveCraRequest {
    return {
      month: cra!.month,
      year: cra!.year,
      days: days.map((d) => {
        const dayActivities = d.activities
          .filter((a) => a.activityId)
          .map((a) => ({
            activityId: Number(a.activityId),
            hours: 0,
            days: Number(a.days) || 0,
            valid: a.valid,
            comment: a.comment || null,
          }))
        const dayDays = dayActivities.reduce((sum, a) => sum + (a.days ?? 0), 0)
        return {
          date: d.date,
          dayType: d.dayType,
          workedHours: d.dayType === 'WORKED' ? Number(d.workedHours) || 0 : 0,
          hours: dayActivities.length > 0 ? dayDays : null,
          comment: d.comment || null,
          activities: dayActivities,
        }
      }),
    }
  }

  async function doSave(): Promise<boolean> {
    if (!cra) return false
    if (activityRestriction) {
      setRestrictionDialog(activityRestriction)
      setFormError(null)
      return false
    }
    setSaving(true)
    setFormError(null)
    try {
      const updated = await crasApi.save(cra.id, buildSaveRequest())
      setData(updated)
      onChange?.()
      return true
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleSave() {
    await doSave()
  }

  async function handleSubmit() {
    if (!cra) return
    if (!craValid) {
      setFormError('Le CRA est incomplet : chaque jour travaillé doit totaliser 1 jour.')
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      const saved = await doSave()
      if (!saved) return
      const updated = await crasApi.submit(cra.id)
      setData(updated)
      onChange?.()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleValidate() {
    if (!cra) return
    setFormError(null)
    try {
      if (formEditable) {
        const saved = await doSave()
        if (!saved) return
      }
      const updated = await crasApi.validate(cra.id)
      setData(updated)
      onChange?.()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    }
  }

  async function handleToggleValid(cdaId: number, valid: boolean) {
    if (!cra) return
    try {
      const updated = valid
        ? await crasApi.setActivityValid(cra.id, cdaId)
        : await crasApi.setActivityInvalid(cra.id, cdaId)
      setData(updated)
      onChange?.()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    }
  }

  async function handleRange(action: 'validate' | 'invalidate', start: string, end: string) {
    if (!cra) return
    if (!start || !end) {
      setFormError('Indiquez les dates de début et de fin.')
      return
    }
    try {
      const updated =
        action === 'validate'
          ? await crasApi.validateRange(cra.id, start, end)
          : await crasApi.invalidateRange(cra.id, start, end)
      setData(updated)
      onChange?.()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    }
  }

  async function handleInvalidateAll() {
    if (!cra) return
    setFormError(null)
    try {
      if (formEditable) {
        const saved = await doSave()
        if (!saved) return
      }
      const mm = String(cra.month).padStart(2, '0')
      const monthStart = `${cra.year}-${mm}-01`
      const monthEnd = `${cra.year}-${mm}-${String(new Date(cra.year, cra.month, 0).getDate()).padStart(2, '0')}`
      const updated = await crasApi.invalidateRange(cra.id, monthStart, monthEnd)
      setData(updated)
      onChange?.()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    }
  }

  async function handleCancel(comment: string) {
    if (!cra) return
    setSending(true)
    setFormError(null)
    try {
      const updated = await crasApi.cancel(cra.id, comment)
      setData(updated)
      onChange?.()
      setCancelOpen(false)
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    } finally {
      setSending(false)
    }
  }

  async function handleSendBack(comment: string) {
    if (!cra) return
    setSending(true)
    setFormError(null)
    try {
      const saved = await doSave()
      if (!saved) return
      await crasApi.sendBack(cra.id, comment)
      setSendBackOpen(false)
      if (onClose) onClose()
      else navigate(cra.type === 'CONGE' ? '/indispos' : '/cras')
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    } finally {
      setSending(false)
    }
  }

  async function handleDeleteAll() {
    if (!(await dialog.confirm(tr('CraDetail.supprimer.tous.les.evenements.ajoutes'), { variant: 'warning', danger: true, okLabel: tr('common.delete') }))) return
    removeAllEvents()
  }

  function openHistory() {
    if (!cra) return
    setHistoryOpen(true)
  }

  async function handleExportClientPdf() {
    if (!cra) return
    try {
      await crasApi.exportClientPdf(cra.id)
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    }
  }

  async function handleExportCompanyPdf() {
    if (!cra) return
    try {
      await crasApi.exportCompanyPdf(cra.id)
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    }
  }

  function handleFillAllDays(activityId: string) {
    if (!activityId) {
      setFormError(`Aucune activité correspondant à ce mois pour remplir ${isIndispo ? "l'Indispo" : 'le CRA'}.`)
      return
    }
    const emptyDays = days.filter((d) => d.dayType === 'WORKED' && d.activities.length === 0)
    if (emptyDays.length === 0) {
      setFormError('Tous les jours ouvrables du mois sont déjà renseignés.')
    } else {
      setDays((prev) =>
        prev.map((d) => {
          if (d.activities.length > 0 || d.dayType !== 'WORKED') return d
          return {
            ...d,
            activities: [{ id: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`, activityId, days: '1', comment: '', valid: false }],
          }
        }),
      )
      setFormError(null)
    }
    setFillMonthOpen(false)
  }

  function handleFillRange(start: string, end: string, activityId: string) {
    if (!activityId) {
      setFormError('Choisissez une activité.')
      return
    }
    if (!start || !end) {
      setFormError('Indiquez les dates de début et de fin.')
      return
    }
    const fillable = days.filter(
      (d) =>
        d.dayType === 'WORKED' && d.date >= start && d.date <= end && d.activities.length === 0,
    )
    if (fillable.length === 0) {
      setFormError('Aucun jour ouvrable à remplir dans cette plage (déjà renseigné ou week-end).')
      setFillRangeOpen(false)
      return
    }
    setDays((prev) =>
      prev.map((d) => {
        if (d.date < start || d.date > end) return d
        if (d.dayType !== 'WORKED' || d.activities.length > 0) return d
        return {
          ...d,
          activities: [{ id: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`, activityId, days: '1', comment: '', valid: false }],
        }
      }),
    )
    setFormError(null)
    setFillRangeOpen(false)
  }

  const firstDay = new Date(cra.year, cra.month - 1, 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(cra.year, cra.month, 0).getDate()
  const cells: ReactNode[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) cells.push(day)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <button
            onClick={() => (onClose ? onClose() : navigate(cra.type === 'CONGE' ? '/indispos' : '/cras'))}
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            {onClose ? '← Fermer' : cra.type === 'CONGE' ? '← Retour aux Indispos' : '← Retour aux CRA'}
          </button>
          <h2 className="mt-1 text-2xl font-bold text-gray-900">
            {cra.type === 'CONGE' ? 'Indispo de ' : 'CRA de '}{cra.consultantName ?? '—'}
          </h2>
          <p className="text-sm text-gray-500">
            {monthLabel(cra.month)} {cra.year}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton onClick={reload} label="" />
          <Badge kind={statusBadge(cra.status)}>
            {dt(CRA_STATUS_LABELS[cra.status] ?? cra.status)}
          </Badge>
          {canCancel && (
            <IconButton
              icon="cancel"
              label={tr('CraDetail.annuler')}
              variant="danger"
              onClick={() => setCancelOpen(true)}
            />
          )}
          <span className="text-sm text-gray-500">{cra.totalWorkedDays} {tr('CraDetail.j')}</span>
          <IconButton icon="history" label={tr('CraDetail.historique')} variant="history" onClick={openHistory} />
          <InlineButton onClick={handleExportClientPdf}>{tr('CraDetail.export.pdf.client')}</InlineButton>
          <InlineButton onClick={handleExportCompanyPdf}>{tr('CraDetail.export.pdf.ma.societe')}</InlineButton>
        </div>
      </div>

      {formError && <ErrorBlock message={formError} />}

      {cra.status === 'REJECTED' && cra.comment && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>{tr('CraDetail.rejete')}</strong> {cra.comment}
        </div>
      )}

      {cra.status === 'CANCELLED' && cra.comment && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>{tr('CraDetail.annulee')}</strong> {cra.comment}
        </div>
      )}

      {managerCanAct && (cra.status === 'VALIDATED' || cra.status === 'VALREJ') && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          {isIndispo ? tr('CraDetail.cette.indispo') : tr('CraDetail.ce.cra')} {tr('CraDetail.est')} {dt(statusAdjective(cra.status, isIndispo))}.
        </div>
      )}

      {!formEditable && !consultantAddsToValidated && !consultantEditsSemiValid && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          {isIndispo ? tr('CraDetail.cette.indispo') : tr('CraDetail.ce.cra')} {tr('CraDetail.est')} {dt(statusAdjective(cra.status, isIndispo))} {tr('CraDetail.et.n.est.plus.modifiable')}
        </div>
      )}

      {consultantAddsToValidated && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          {tr('CraDetail.cette.indispo.est.validee.vous.pouvez.ajouter.de.nouveaux.ev')}
        </div>
      )}

      {consultantEditsSemiValid && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          {isIndispo ? tr('CraDetail.cette.indispo') : tr('CraDetail.ce.cra')} {tr('CraDetail.est')} {dt(statusAdjective(cra.status, isIndispo))}{tr('CraDetail.vous.pouvez.modifier.les.evenements.non.valides.et.remplir.l')}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-1">
          <button
            onClick={() => setTab('calendar')}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              tab === 'calendar'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tr('CraDetail.calendrier')}
          </button>
          <button
            onClick={() => setTab('ligne')}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              tab === 'ligne'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tr('CraDetail.ligne')}
          </button>
        </div>
        {editable && (
          <div className="flex flex-wrap items-center gap-2">
            <Button className="w-auto" onClick={() => setFillMonthOpen(true)}>
              {tr('CraDetail.remplir.tout.le.mois')}
            </Button>
            <InlineButton onClick={() => setFillRangeOpen(true)}>
              {tr('CraDetail.remplir.une.plage')}
            </InlineButton>
            <InlineButton
              variant="danger"
              onClick={handleDeleteAll}
            >
              {tr('CraDetail.supprimer.tous.les.evenements')}
            </InlineButton>
          </div>
        )}
      </div>

      {!craValid && editable && hasAnyActivity && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>{tr('CraDetail.cra.incomplet')}</strong> {incompleteDays.length} {tr('CraDetail.jour')}
          {incompleteDays.length > 1 ? 's' : ''} {tr('CraDetail.travaille')}
          {incompleteDays.length > 1 ? 's' : ''} {tr('CraDetail.ne.totalise')}
          {incompleteDays.length > 1 ? 'nt' : ''} {tr('CraDetail.pas.1.jour.le.cra.ne.peut.etre.envoye.que.lorsque.chaque.jou')}
        </div>
      )}

      {tab === 'calendar' ? (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-7 gap-px bg-gray-200">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="bg-gray-50 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500"
              >
                {label}
              </div>
            ))}
            {cells.map((dayNum, i) => {
              if (dayNum == null) {
                return <div key={`empty-${i}`} className="bg-white" />
              }
              const date = `${cra.year}-${String(cra.month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
              const dayIndex = days.findIndex((d) => d.date === date)
              const day = dayIndex >= 0 ? days[dayIndex] : null
              return (
                <div
                  key={date}
                  className={`min-h-28 p-1.5 ${dayBackground(day?.dayType)}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500">{dayNum}</span>
                    {canAddEvents &&
                      day &&
                      (day.dayType === 'WORKED' ||
                        day.dayType === 'WEEKEND' ||
                        day.dayType === 'PUBLIC_HOLIDAY') && (
                      <button
                        onClick={() => setEventModal(dayIndex)}
                        className="rounded p-0.5 text-gray-400 transition hover:bg-gray-200 hover:text-gray-600"
                        aria-label={tr('CraDetail.ajouter.un.evenement')}
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2Z" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <div className="mt-1 space-y-1">
                    {day?.activities
                      .filter((act) => act.activityId)
                      .map((act, j) => {
                      const info = activityMap.get(act.activityId)
                      return (
                        <ActivityChip
                          key={j}
                          color={info?.type?.color}
                          name={info?.name ?? 'Activité inconnue'}
                          days={Number(act.days) || 0}
                          valid={act.valid}
                          onClick={
                            canAddEvents && canModifyActivity(act) && dayIndex >= 0
                              ? () => setEventModal(dayIndex)
                              : undefined
                          }
                        />
                      )
                    })}
                    {day && day.dayType !== 'WORKED' && (
                      <span className="block px-1 text-[11px] font-medium text-gray-400">
                        {day.dayType === 'PUBLIC_HOLIDAY' && holidays.has(date)
                          ? holidays.get(date)
                          : DAY_TYPE_LABELS[day.dayType]}{' '}
                        · {formatDays(dayTotal(day))}
                      </span>
                    )}
                    {day?.dayType === 'WORKED' && day.activities.length > 0 && (
                      <span
                        className={`block px-1 text-[11px] font-semibold ${
                          dayIsValid(day) ? 'text-green-600' : 'text-red-500'
                        }`}
                      >
                        {formatDays(dayTotal(day))}
                        {!dayIsValid(day) ? ' — à compléter' : ''}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-400">
            {tr('CraDetail.cliquez.sur.un.jour.travaille.ou.le.symbole.pour.ajouter.mod')}
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-gray-400">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                    {tr('CraDetail.jour.2')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                    {tr('CraDetail.type')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                    {tr('CraDetail.total')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                    {tr('CraDetail.evenements')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                    {tr('CraDetail.commentaire')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {dayPage.pageItems.map((day, idx) => {
                  const i = dayPage.offset + idx
                  const total = dayTotal(day)
                  return (
                    <tr key={day.date} className="align-top">
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-gray-400">
                        {i + 1}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                        {new Date(day.date + 'T00:00:00').toLocaleDateString(getFormatLocale(), {
                          weekday: 'short',
                          day: '2-digit',
                          month: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        {formEditable ? (
                          <Select
                            className="w-36"
                            value={day.dayType}
                            onChange={(e) =>
                              updateDay(i, {
                                dayType: e.target.value as DayType,
                                workedHours:
                                  e.target.value === 'WORKED' ? day.workedHours : '0',
                              })
                            }
                          >
                            {DAY_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {DAY_TYPE_LABELS[t]}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <span className="text-sm">{DAY_TYPE_LABELS[day.dayType]}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-sm font-semibold ${
                            dayIsValid(day) ? 'text-green-600' : 'text-red-500'
                          }`}
                        >
                          {formatDays(total)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-2">
                          {day.activities.map((act, j) => (
                            <div key={j} className="flex flex-wrap items-center gap-2">
                              {canAddEvents && canModifyActivity(act) ? (
                                <>
                                  <Select
                                    className="w-48"
                                    value={act.activityId}
                                    onChange={(e) =>
                                      updateActivity(i, j, { activityId: e.target.value })
                                    }
                                  >
                                    <option value="">{tr('CraDetail.activite')}</option>
                                    {filteredActivities.map((a) => (
                                      <option key={a.id} value={a.id}>
                                        {a.name}
                                      </option>
                                    ))}
                                  </Select>
                                  <Select
                                    className="w-24"
                                    value={act.days}
                                    onChange={(e) => updateActivity(i, j, { days: e.target.value })}
                                  >
                                    {allowedDaysFor(day, j).map((dv) => (
                                      <option key={dv} value={dv}>
                                        {formatDays(Number(dv))}
                                      </option>
                                    ))}
                                  </Select>
                                  <button
                                    onClick={() => removeActivity(i, j)}
                                    className="text-red-500 hover:text-red-700"
                                    aria-label={tr('CraDetail.supprimer.l.evenement')}
                                  >
                                    {tr('CraDetail.')}
                                  </button>
                                </>
                              ) : (
                                <span className="text-sm">
                                  {activityMap.get(act.activityId)?.name ?? 'Activité inconnue'} ·{' '}
                                  {formatDays(Number(act.days) || 0)}
                                  {act.valid ? ' ✓' : ''}
                                </span>
                              )}
                            </div>
                          ))}
                          {canAddEvents && (
                            <button
                              onClick={() => addActivity(i)}
                              disabled={total >= 1}
                              className="text-sm font-medium text-brand-600 hover:text-brand-700 disabled:cursor-not-allowed disabled:text-gray-400"
                            >
                              {tr('CraDetail.ajouter.un.evenement.2')}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {formEditable ? (
                          <input
                            value={day.comment}
                            onChange={(e) => updateDay(i, { comment: e.target.value })}
                            className="w-40 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                            placeholder={tr('CraDetail.commentaire')}
                          />
                        ) : (
                          <span className="text-sm text-gray-600">{day.comment || '—'}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 pb-3">
            <Pagination
              page={dayPage.page}
              totalPages={dayPage.totalPages}
              total={dayPage.total}
              onChange={dayPage.setPage}
            />
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        {canAddEvents && (
          <IconButton
            icon="save"
            label={tr('CraDetail.enregistrer')}
            variant="primary"
            className="flex-1"
            onClick={handleSave}
            disabled={saving} loading={saving}
          />
        )}
        {canAddEvents && !managerCanAct && (
          <IconButton
            icon="check"
            label={tr('CraDetail.soumettre')}
            variant="soft"
            className="flex-1"
            onClick={handleSubmit}
            disabled={submitting || saving || (isIndispo ? false : !craValid)}
            title={
              !isIndispo && !craValid
                ? tr('CraDetail.cra.incomplet.jours')
                : tr('CraDetail.soumettre.pour.validation')
            }
          />
        )}
        {managerCanAct && (
          <>
            <span className="flex-1" title={!hasInactiveEvent ? 'aucun événement à valider' : undefined}>
              <IconButton
                icon="check"
                label={tr('CraDetail.valider.tout')}
                variant="soft"
                className="w-full"
                onClick={handleValidate}
                disabled={!hasInactiveEvent}
              />
            </span>
            <span className="flex-1" title={!hasActiveEvent ? 'aucun événement à invalider' : undefined}>
              <Button
                variant="danger"
                className="w-full"
                onClick={handleInvalidateAll}
                disabled={!hasActiveEvent}
              >
                {tr('CraDetail.invalider.tout')}
              </Button>
            </span>
            <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={() => setSendBackOpen(true)}>
              {tr('CraDetail.envoyer')}
            </Button>
          </>
        )}
      </div>

      {fillMonthOpen && (
        <FillMonthModal
          activities={monthActivities}
          onSelect={handleFillAllDays}
          onClose={() => setFillMonthOpen(false)}
        />
      )}

      {fillRangeOpen && (
        <FillRangeModal
          activities={monthActivities}
          monthStart={`${cra.year}-${String(cra.month).padStart(2, '0')}-01`}
          monthEnd={`${cra.year}-${String(cra.month).padStart(2, '0')}-${String(
            new Date(cra.year, cra.month, 0).getDate(),
          ).padStart(2, '0')}`}
          onFill={handleFillRange}
          onClose={() => setFillRangeOpen(false)}
        />
      )}

      {historyOpen && cra && (
        <CraHistoryModal
          craId={cra.id}
          isIndispo={isIndispo}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      {eventModal !== null && eventModal >= 0 && eventModal < days.length && (
        <EventModal
          day={days[eventModal]}
          editable={canAddEvents}
          formEditable={formEditable}
          isConsultant={isConsultant}
          managerCanAct={managerCanAct}
          activities={filteredActivities}
          onUpdateActivity={(actIndex, patch) => updateActivity(eventModal, actIndex, patch)}
          onAddActivity={() => addActivity(eventModal)}
          onRemoveActivity={(actIndex) => removeActivity(eventModal, actIndex)}
          onToggleValid={(cdaId, valid) => void handleToggleValid(cdaId, valid)}
          onClose={() => setEventModal(null)}
        />
      )}

      {rangeModal && (
        <RangeValidModal
          action={rangeModal}
          monthStart={`${cra.year}-${String(cra.month).padStart(2, '0')}-01`}
          monthEnd={`${cra.year}-${String(cra.month).padStart(2, '0')}-${String(
            new Date(cra.year, cra.month, 0).getDate(),
          ).padStart(2, '0')}`}
          onApply={(start, end) => {
            void handleRange(rangeModal, start, end)
            setRangeModal(null)
          }}
          onClose={() => setRangeModal(null)}
        />
      )}

      {cancelOpen && (
        <CancelModal
          submitting={sending}
          commentRequired={cra.status === 'VALIDATED'}
          onConfirm={(comment) => void handleCancel(comment)}
          onClose={() => setCancelOpen(false)}
        />
      )}

      {sendBackOpen && (
        <SendBackModal
          submitting={sending}
          onConfirm={(comment) => void handleSendBack(comment)}
          onClose={() => setSendBackOpen(false)}
        />
      )}

      {restrictionDialog && (
        <Modal
          open
          title={tr('CraDetail.information')}
          onClose={() => setRestrictionDialog(null)}
          footer={
            <Button className="w-auto" onClick={() => setRestrictionDialog(null)}>
              OK
            </Button>
          }
        >
          <p className="text-sm text-gray-700">{restrictionDialog}</p>
        </Modal>
      )}
    </div>
  )
}

function FillMonthModal({
  activities,
  onSelect,
  onClose,
}: {
  activities: ActivityDto[]
  onSelect: (activityId: string) => void
  onClose: () => void
}) {
  return (
    <Modal
      open
      title={tr('CraDetail.remplir.tout.le.mois')}
      onClose={onClose}
      footer={<IconButton icon="cancel" label="Annuler" onClick={onClose} />}
    >
      <p className="mb-3 text-sm text-gray-500">
        {tr('CraDetail.choisissez.l.activite.a.appliquer.a.tous.les.jours.travaille')}
      </p>
      {activities.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 px-3 py-4 text-center text-sm text-gray-400">
          {tr('CraDetail.aucune.activite.correspondant.a.ce.mois')}
        </p>
      ) : (
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {activities.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onSelect(String(a.id))}
              className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-left text-sm transition hover:bg-gray-50"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: a.type?.color ?? '#9ca3af' }}
              />
              <span className="font-medium text-gray-800">{a.name}</span>
              <span className="ml-auto text-xs text-gray-400">
                {a.startDate ?? '…'} → {a.endDate ?? '…'}
              </span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}

function FillRangeModal({
  activities,
  monthStart,
  monthEnd,
  onFill,
  onClose,
}: {
  activities: ActivityDto[]
  monthStart: string
  monthEnd: string
  onFill: (start: string, end: string, activityId: string) => void
  onClose: () => void
}) {
  const [start, setStart] = useState(monthStart)
  const [end, setEnd] = useState(monthEnd)
  const [activityId, setActivityId] = useState('')

  return (
    <Modal
      open
      title={tr('CraDetail.remplir.une.plage')}
      onClose={onClose}
      footer={
        <>
          <IconButton icon="cancel" label="Annuler" onClick={onClose} />
          <Button className="w-auto" onClick={() => onFill(start, end, activityId)}>
            Remplir
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={tr('CraDetail.date.de.debut')}>
            <Input
              type="date"
              min={monthStart}
              max={monthEnd}
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </Field>
          <Field label={tr('CraDetail.date.de.fin')}>
            <Input
              type="date"
              min={monthStart}
              max={monthEnd}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </Field>
        </div>
        <div>
          <p className="mb-2 text-sm text-gray-500">{tr('CraDetail.activite.2')}</p>
          {activities.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-300 px-3 py-4 text-center text-sm text-gray-400">
              {tr('CraDetail.aucune.activite.correspondant.a.ce.mois')}
            </p>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {activities.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setActivityId(String(a.id))}
                  className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                    activityId === String(a.id)
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: a.type?.color ?? '#9ca3af' }}
                  />
                  <span className="font-medium text-gray-800">{a.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

function EventModal({
  day,
  editable,
  formEditable,
  isConsultant,
  managerCanAct,
  activities,
  onUpdateActivity,
  onAddActivity,
  onRemoveActivity,
  onToggleValid,
  onClose,
}: {
  day: EditableDay
  editable: boolean
  formEditable: boolean
  isConsultant: boolean
  managerCanAct: boolean
  activities: ActivityDto[]
  onUpdateActivity: (actIndex: number, patch: Partial<EditableActivity>) => void
  onAddActivity: () => void
  onRemoveActivity: (actIndex: number) => void
  onToggleValid: (cdaId: number, valid: boolean) => void
  onClose: () => void
}) {
  const total = dayTotal(day)
  const canModify = (act: EditableActivity) => !isConsultant || !act.valid
  return (
    <Modal
      open
      title={`Événements du ${new Date(day.date + 'T00:00:00').toLocaleDateString(getFormatLocale(), {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })}`}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <IconButton icon="close" label="Fermer" onClick={onClose} />
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className={`text-sm font-semibold ${dayIsValid(day) ? 'text-green-600' : 'text-red-500'}`}>
            {formatDays(total)}
            {day.dayType === 'WORKED' && !dayIsValid(day) ? ' — doit totaliser 1 jour' : ''}
          </span>
        </div>

        <div className="space-y-2">
          {day.activities.map((act, j) => {
            const info = activities.find((a) => String(a.id) === act.activityId)
            return (
              <div
                key={j}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 px-3 py-2"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: info?.type?.color ?? '#9ca3af' }}
                />
                {editable && canModify(act) ? (
                  <>
                    <Select
                      className="w-56"
                      value={act.activityId}
                      onChange={(e) => onUpdateActivity(j, { activityId: e.target.value })}
                    >
                      <option value="">{tr('CraDetail.activite')}</option>
                      {activities.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </Select>
                    <Select
                      className="w-28"
                      value={act.days}
                      onChange={(e) => onUpdateActivity(j, { days: e.target.value })}
                    >
                      {allowedDaysFor(day, j).map((dv) => (
                        <option key={dv} value={dv}>
                          {formatDays(Number(dv))}
                        </option>
                      ))}
                    </Select>
                    <input
                      value={act.comment}
                      onChange={(e) => onUpdateActivity(j, { comment: e.target.value })}
                      className="flex-1 min-w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                      placeholder={tr('CraDetail.commentaire')}
                    />
                    <button
                      onClick={() => onRemoveActivity(j)}
                      className="text-red-500 hover:text-red-700"
                      aria-label={tr('CraDetail.supprimer.l.evenement')}
                    >
                      {tr('CraDetail.')}
                    </button>
                  </>
                ) : (
                  <span className="text-sm">
                    {info?.name ?? 'Activité inconnue'} · {formatDays(Number(act.days) || 0)}
                    {act.valid ? ' ✓' : ''}
                    {act.comment ? ` — ${act.comment}` : ''}
                  </span>
                )}
                {managerCanAct && (
                  <label className="ml-auto flex shrink-0 items-center gap-1.5 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={act.valid}
                      onChange={(e) =>
                        formEditable
                          ? onUpdateActivity(j, { valid: e.target.checked })
                          : onToggleValid(Number(act.id), e.target.checked)
                      }
                      className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    {tr('CraDetail.valid')}
                  </label>
                )}
              </div>
            )
          })}
          {day.activities.length === 0 && (
            <p className="rounded-lg border border-dashed border-gray-300 px-3 py-4 text-center text-sm text-gray-400">
              {tr('CraDetail.aucun.evenement.pour.ce.jour')}
            </p>
          )}
        </div>

        {editable && (
          <button
            onClick={onAddActivity}
            disabled={total >= 1}
            className="text-sm font-medium text-brand-600 hover:text-brand-700 disabled:cursor-not-allowed disabled:text-gray-400"
          >
            {tr('CraDetail.ajouter.un.evenement.2')}
          </button>
        )}
      </div>
    </Modal>
  )
}

function RangeValidModal({
  action,
  monthStart,
  monthEnd,
  onApply,
  onClose,
}: {
  action: 'validate' | 'invalidate'
  monthStart: string
  monthEnd: string
  onApply: (start: string, end: string) => void
  onClose: () => void
}) {
  const [start, setStart] = useState(monthStart)
  const [end, setEnd] = useState(monthEnd)
  const label = action === 'validate' ? 'Valider' : 'Invalider'
  return (
    <Modal
      open
      title={`${label} une plage de dates`}
      onClose={onClose}
      footer={
        <>
          <IconButton icon="cancel" label="Annuler" onClick={onClose} />
          <Button className="w-auto" onClick={() => onApply(start, end)}>
            {label}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-gray-500">
        {action === 'validate'
          ? 'Toutes les activités de la plage seront marquées comme validées.'
          : 'Toutes les activités de la plage seront marquées comme non validées.'}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label={tr('CraDetail.date.de.debut')}>
          <Input
            type="date"
            min={monthStart}
            max={monthEnd}
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </Field>
        <Field label={tr('CraDetail.date.de.fin')}>
          <Input
            type="date"
            min={monthStart}
            max={monthEnd}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  )
}

function CancelModal({
  submitting,
  commentRequired = true,
  onConfirm,
  onClose,
}: {
  submitting?: boolean
  commentRequired?: boolean
  onConfirm: (comment: string) => void
  onClose: () => void
}) {
  const [comment, setComment] = useState('')
  const canSubmit = !commentRequired || comment.trim().length > 0
  return (
    <Modal
      open
      title={tr('CraDetail.annuler.l.indispo')}
      onClose={onClose}
      footer={
        <>
          <IconButton icon="cancel" label="Annuler" onClick={onClose} />
          <Button
            variant="danger"
            className="w-auto"
            onClick={() => onConfirm(comment.trim())}
            disabled={!canSubmit || submitting}
          >
            {submitting ? <Spinner className="border-white border-t-transparent" /> : null}
            Confirmer
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-gray-500">
        {commentRequired
          ? 'Indiquez le motif de l\'annulation (obligatoire) :'
          : 'Retirer cette Indispo (elle repassera en brouillon). Motif (facultatif) :'}
      </p>
      <Field label={commentRequired ? 'Commentaire *' : 'Commentaire'}>
        <Input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={tr('CraDetail.motif.de.l.annulation')}
        />
      </Field>
    </Modal>
  )
}

function SendBackModal({
  submitting,
  onConfirm,
  onClose,
}: {
  submitting?: boolean
  onConfirm: (comment: string) => void
  onClose: () => void
}) {
  const [comment, setComment] = useState('')
  const canSubmit = comment.trim().length > 0
  return (
    <Modal
      open
      title={tr('CraDetail.envoyer.au.consultant')}
      onClose={onClose}
      footer={
        <>
          <IconButton icon="cancel" label="Annuler" onClick={onClose} />
          <Button
            className="w-auto"
            onClick={() => onConfirm(comment.trim())}
            disabled={!canSubmit || submitting}
          >
            {submitting ? <Spinner className="border-white border-t-transparent" /> : null}
            Envoyer
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-gray-500">
        {tr('CraDetail.indiquez.un.commentaire.obligatoire')}
      </p>
      <Field label={tr('CraDetail.commentaire.2')}>
        <Textarea
          rows={4}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={tr('CraDetail.commentaire.a.transmettre.au.consultant')}
        />
      </Field>
    </Modal>
  )
}

export function CraDetailRoute() {
  const { id } = useParams<{ id: string }>()
  return <CraDetail id={Number(id)} />
}