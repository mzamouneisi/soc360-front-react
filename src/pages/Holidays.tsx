import { tr } from '../i18n/translate'
import { useEffect, useMemo, useState } from 'react'
import { socHolidaysApi } from '../api/socHolidays'
import { holidaysApi } from '../api/holidays'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { Button, Card, Field, IconButton, InlineButton, Input, RefreshButton, Select } from '../components/ui'
import { ErrorBlock, Modal, PageHeader } from '../components/data'
import { dialog } from '../components/dialog'
import type { HolidayPaidStatus, PublicHolidayDto, SocHolidayDto } from '../api/types'
import { monthLabel, weekdayShortLabels } from '../lib/format'

function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function Holidays() {
  const { user } = useAuth()
  const canEdit =
    user?.role === 'ADMIN' || user?.role === 'RESPONSIBLE_SOC' || user?.role === 'MANAGER'

  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [holidays, setHolidays] = useState<SocHolidayDto[]>([])
  const [nationalHolidays, setNationalHolidays] = useState<PublicHolidayDto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorExisting, setEditorExisting] = useState<SocHolidayDto | null>(null)
  const [editorDate, setEditorDate] = useState('')
  const [editorLabel, setEditorLabel] = useState('')
  const [editorPaid, setEditorPaid] = useState<HolidayPaidStatus>('CHOME_PAYE')
  const [editorSaving, setEditorSaving] = useState(false)

  const year = cursor.getFullYear()
  const month = cursor.getMonth()

  useEffect(() => {
    let cancelled = false
    setError(null)
    Promise.all([
      socHolidaysApi.list(year),
      holidaysApi.findByCountryYear('FR', year).catch(() => [] as PublicHolidayDto[]),
    ])
      .then(([socData, publicData]) => {
        if (cancelled) return
        setHolidays(socData)
        setNationalHolidays(publicData)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
      })
    return () => {
      cancelled = true
    }
  }, [year, tick])

  const byDate = useMemo(() => {
    const map = new Map<string, SocHolidayDto>()
    for (const h of holidays) map.set(h.date, h)
    return map
  }, [holidays])

  const nationalByDate = useMemo(() => {
    const map = new Map<string, PublicHolidayDto>()
    for (const h of nationalHolidays) map.set(h.date, h)
    return map
  }, [nationalHolidays])

  const cells = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const offset = (firstDay.getDay() + 6) % 7
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const list: (Date | null)[] = []
    for (let i = 0; i < offset; i++) list.push(null)
    for (let d = 1; d <= daysInMonth; d++) list.push(new Date(year, month, d))
    return list
  }, [year, month])

  function goPrev() {
    setCursor(new Date(year, month - 1, 1))
  }

  function goNext() {
    setCursor(new Date(year, month + 1, 1))
  }

  function goToday() {
    const now = new Date()
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1))
  }

  function toggleDay(date: Date) {
    if (!canEdit) return
    const key = toDateString(date)
    const existing = byDate.get(key) ?? null
    const national = nationalByDate.get(key)
    setEditorExisting(existing)
    setEditorDate(key)
    setEditorLabel(existing?.label ?? national?.label ?? tr('Holidays.jour.ferie'))
    setEditorPaid(existing?.isChomePaye ?? national?.isChomePaye ?? 'CHOME_PAYE')
    setEditorOpen(true)
  }

  async function saveHoliday() {
    setEditorSaving(true)
    setError(null)
    try {
      const label = editorLabel.trim() || tr('Holidays.jour.ferie')
      if (editorExisting) {
        const updated = await socHolidaysApi.update(
          editorExisting.id,
          editorDate,
          label,
          editorPaid,
        )
        setHolidays((prev) => prev.map((h) => (h.id === updated.id ? updated : h)))
        setFeedback(tr('Holidays.jour.ferie.modifie'))
      } else {
        const created = await socHolidaysApi.create(editorDate, label, editorPaid)
        setHolidays((prev) =>
          [...prev.filter((h) => h.date !== created.date), created].sort((a, b) =>
            a.date.localeCompare(b.date),
          ),
        )
        setFeedback(tr('Holidays.jour.ferie.ajoute'))
      }
      setEditorOpen(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    } finally {
      setEditorSaving(false)
    }
  }

  async function deleteHoliday() {
    if (!editorExisting) return
    if (
      !(await dialog.confirm(
        tr('Holidays.supprimer.le.jour.ferie', {
          label: editorExisting.label,
          date: editorDate,
        }),
        { variant: 'warning', danger: true, okLabel: tr('common.delete') },
      ))
    ) {
      return
    }
    try {
      await socHolidaysApi.delete(editorExisting.id)
      setHolidays((prev) => prev.filter((h) => h.id !== editorExisting.id))
      setFeedback(tr('Holidays.jour.ferie.supprime'))
      setEditorOpen(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    }
  }

  async function duplicateToNextYear() {
    if (!canEdit) return
    if (!(await dialog.confirm(tr('Holidays.dupliquer.confirm', { from: year, to: year + 1 }), { variant: 'question' }))) return
    try {
      const copied = await socHolidaysApi.duplicate(year)
      setFeedback(tr('Holidays.dupliquer.resultat', { count: copied, to: year + 1 }))
      if (copied > 0 && month === 11) {
        // reste sur le même mois ; le rechargement de l'année se fera au clic sur "suiv"
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    }
  }

  const today = new Date()

  return (
    <div>
      <PageHeader
        title={tr('Holidays.jours.feries')}
        titleId="Holidays.jours.feries"
        subtitle={canEdit ? tr('Holidays.definissez.les.jours.feries.specifiques.de.la.societe') : undefined}
        subtitleId={canEdit ? 'Holidays.definissez.les.jours.feries.specifiques.de.la.societe' : undefined}
      />

      <Card id="Holidays.calendar" className="max-w-3xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <IconButton icon="chevronLeft" label={tr('Holidays.prec')} variant="soft" onClick={goPrev} id="Holidays.prec" />
            <InlineButton id="Holidays.aujourd.hui" variant="soft" onClick={goToday}>{tr('Holidays.aujourd.hui')}</InlineButton>
            <IconButton icon="chevronRight" label={tr('Holidays.suiv')} variant="soft" onClick={goNext} id="Holidays.suiv" />
            <RefreshButton onClick={() => setTick((t) => t + 1)} label="" />
          </div>
          <h2 id="Holidays.monthLabel" className="text-lg font-semibold text-gray-900">
            {monthLabel(month + 1)} {year}
          </h2>
          {canEdit && (
            <Button id="Holidays.dupliquer.vers" variant="primary" className="w-auto" onClick={duplicateToNextYear}>
              {tr('Holidays.dupliquer.vers')} {year + 1}
            </Button>
          )}
        </div>

        {canEdit && (
          <p id="Holidays.cliquez.sur.un.jour.pour.l.ajouter.comme.jour.ferie.ou.le.su" className="mt-3 text-sm text-gray-500">
            {tr('Holidays.cliquez.sur.un.jour.pour.l.ajouter.comme.jour.ferie.ou.le.su')}
          </p>
        )}

        <div className="mt-4 grid grid-cols-7 gap-1">
          {weekdayShortLabels().map((d) => (
            <div id={`Holidays.weekday.${d}`} key={d} className="px-1 py-2 text-center text-xs font-semibold uppercase text-gray-500">
              {d}
            </div>
          ))}
          {cells.map((date, i) => {
            if (!date) {
              return <div key={`empty-${i}`} className="min-h-16 rounded-lg" />
            }
            const key = toDateString(date)
            const holiday = byDate.get(key)
            const national = nationalByDate.get(key)
            const isToday = key === toDateString(today)
            const paid = holiday?.isChomePaye ?? national?.isChomePaye
            const paidLabel = paid === 'CHOME_NON_PAYE'
              ? tr('Holidays.chome.non.paye')
              : tr('Holidays.chome.paye')
            const title =
              [holiday?.label, national?.label, paidLabel].filter(Boolean).join(' · ') || key
            const colorClass = holiday
              ? 'border-brand-300 bg-brand-50 text-brand-800'
              : national
                ? 'border-yellow-300 bg-yellow-50 text-yellow-800'
                : 'border-gray-200 bg-white text-gray-700 hover:border-brand-300'
            return (
              <button
                id={`Holidays.day.${key}`}
                key={key}
                onClick={() => toggleDay(date)}
                disabled={!canEdit}
                title={title}
                className={`min-h-16 rounded-lg border p-1 text-left text-sm transition ${colorClass} ${
                  isToday ? 'ring-2 ring-brand-500' : ''
                } ${!canEdit ? 'cursor-default' : ''}`}
              >
                <span id={`Holidays.day.${key}.number`} className={`font-medium ${holiday ? 'text-brand-700' : national ? 'text-yellow-700' : ''}`}>
                  {date.getDate()}
                </span>
                {holiday && (
                  <span id={`Holidays.day.${key}.holiday`} className="block truncate text-xs text-brand-600">{holiday.label}</span>
                )}
                {national && (
                  <span id={`Holidays.day.${key}.national`} className="block truncate text-xs text-yellow-600">{national.label}</span>
                )}
                {(holiday || national) && (
                  <span
                    id={`Holidays.day.${key}.paidStatus`}
                    className={`block truncate text-[10px] ${paid === 'CHOME_NON_PAYE' ? 'text-red-600' : 'text-green-700'}`}
                  >
                    {paidLabel}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {error && <ErrorBlock id="Holidays.error" message={error} />}
        {feedback && !error && <p id="Holidays.feedback" className="mt-3 text-sm text-green-600">{feedback}</p>}
      </Card>

      <Modal
        open={editorOpen}
        title={editorExisting ? tr('Holidays.modifier.le.jour.ferie') : tr('Holidays.nouveau.jour.ferie')}
        titleId="Holidays.editor.title"
        onClose={() => setEditorOpen(false)}
        footer={
          <>
            {editorExisting && (
              <IconButton
                id="Holidays.editor.delete"
                icon="delete"
                variant="danger"
                label={tr('Holidays.supprimer')}
                onClick={() => void deleteHoliday()}
              />
            )}
            <Button
              id="Holidays.editor.cancel"
              variant="neutral"
              className="!w-auto"
              onClick={() => setEditorOpen(false)}
            >
              {tr('common.cancel')}
            </Button>
            <Button
              id="Holidays.editor.save"
              className="!w-auto"
              onClick={() => void saveHoliday()}
              disabled={editorSaving}
            >
              {tr('Holidays.enregistrer')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <p id="Holidays.editor.date" className="text-sm font-medium text-gray-700">
              {tr('Holidays.date')}
            </p>
            <p id="Holidays.editor.date.value" className="text-sm text-gray-900">{editorDate}</p>
          </div>
          <Field label={tr('Holidays.libelle')} id="Holidays.libelle">
            <Input
              id="Holidays.libelle.input"
              value={editorLabel}
              title={tr('Holidays.libelle')}
              onChange={(e) => setEditorLabel(e.target.value)}
            />
          </Field>
          <Field label={tr('Holidays.statut')} id="Holidays.statut">
            <Select
              id="Holidays.statut.select"
              value={editorPaid}
              title={tr('Holidays.statut')}
              onChange={(e) => setEditorPaid(e.target.value as HolidayPaidStatus)}
            >
              <option id="Holidays.statut.CHOME_PAYE" value="CHOME_PAYE">
                {tr('Holidays.chome.paye')}
              </option>
              <option id="Holidays.statut.CHOME_NON_PAYE" value="CHOME_NON_PAYE">
                {tr('Holidays.chome.non.paye')}
              </option>
            </Select>
          </Field>
        </div>
      </Modal>
    </div>
  )
}