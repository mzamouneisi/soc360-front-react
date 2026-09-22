import { tr } from '../i18n/translate'
import { useEffect, useMemo, useState } from 'react'
import { socHolidaysApi } from '../api/socHolidays'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { Button, Card, InlineButton, RefreshButton } from '../components/ui'
import { ErrorBlock, PageHeader } from '../components/data'
import { dialog } from '../components/dialog'
import type { SocHolidayDto } from '../api/types'
import { monthLabel } from '../lib/format'

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

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
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const year = cursor.getFullYear()
  const month = cursor.getMonth()

  useEffect(() => {
    let cancelled = false
    setError(null)
    socHolidaysApi
      .list(year)
      .then((data) => {
        if (!cancelled) setHolidays(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Erreur inattendue')
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

  async function toggleDay(date: Date) {
    if (!canEdit) return
    const key = toDateString(date)
    const existing = byDate.get(key)
    if (existing) {
      if (!(await dialog.confirm(`Supprimer le jour férié « ${existing.label} » du ${key} ?`, { variant: 'warning', danger: true, okLabel: 'Supprimer' }))) return
      try {
        await socHolidaysApi.delete(existing.id)
        setHolidays((prev) => prev.filter((h) => h.id !== existing.id))
        setFeedback('Jour férié supprimé.')
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Erreur inattendue')
      }
      return
    }
    const label = await dialog.prompt('Libellé du jour férié :', 'Jour férié')
    if (label === null) return
    try {
      const created = await socHolidaysApi.create(key, label.trim() || 'Jour férié')
      setHolidays((prev) => [...prev, created].sort((a, b) => a.date.localeCompare(b.date)))
      setFeedback('Jour férié ajouté.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inattendue')
    }
  }

  async function duplicateToNextYear() {
    if (!canEdit) return
    if (!(await dialog.confirm(`Dupliquer les jours fériés de ${year} vers ${year + 1} ?`, { variant: 'question' }))) return
    try {
      const copied = await socHolidaysApi.duplicate(year)
      setFeedback(`${copied} jour(s) férié(s) dupliqué(s) vers ${year + 1}.`)
      if (copied > 0 && month === 11) {
        // reste sur le même mois ; le rechargement de l'année se fera au clic sur "suiv"
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inattendue')
    }
  }

  const today = new Date()

  return (
    <div>
      <PageHeader title={tr('Holidays.jours.feries')} subtitle={tr('Holidays.definissez.les.jours.feries.specifiques.de.la.societe')} />

      <Card className="max-w-3xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <InlineButton onClick={goPrev}>{tr('Holidays.prec')}</InlineButton>
            <InlineButton onClick={goToday}>{tr('Holidays.aujourd.hui')}</InlineButton>
            <InlineButton onClick={goNext}>{tr('Holidays.suiv')}</InlineButton>
            <RefreshButton onClick={() => setTick((t) => t + 1)} label="" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">
            {monthLabel(month + 1)} {year}
          </h2>
          {canEdit && (
            <Button variant="primary" className="w-auto" onClick={duplicateToNextYear}>
              {tr('Holidays.dupliquer.vers')} {year + 1}
            </Button>
          )}
        </div>

        {canEdit && (
          <p className="mt-3 text-sm text-gray-500">
            {tr('Holidays.cliquez.sur.un.jour.pour.l.ajouter.comme.jour.ferie.ou.le.su')}
          </p>
        )}

        <div className="mt-4 grid grid-cols-7 gap-1">
          {DAYS_FR.map((d) => (
            <div key={d} className="px-1 py-2 text-center text-xs font-semibold uppercase text-gray-500">
              {d}
            </div>
          ))}
          {cells.map((date, i) => {
            if (!date) {
              return <div key={`empty-${i}`} className="min-h-16 rounded-lg" />
            }
            const key = toDateString(date)
            const holiday = byDate.get(key)
            const isToday = key === toDateString(today)
            return (
              <button
                key={key}
                onClick={() => toggleDay(date)}
                disabled={!canEdit}
                title={holiday ? holiday.label : key}
                className={`min-h-16 rounded-lg border p-1 text-left text-sm transition ${
                  holiday
                    ? 'border-brand-300 bg-brand-50 text-brand-800'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-brand-300'
                } ${isToday ? 'ring-2 ring-brand-500' : ''} ${!canEdit ? 'cursor-default' : ''}`}
              >
                <span className={`font-medium ${holiday ? 'text-brand-700' : ''}`}>{date.getDate()}</span>
                {holiday && (
                  <span className="block truncate text-xs text-brand-600">{holiday.label}</span>
                )}
              </button>
            )
          })}
        </div>

        {error && <ErrorBlock message={error} />}
        {feedback && !error && <p className="mt-3 text-sm text-green-600">{feedback}</p>}
      </Card>
    </div>
  )
}