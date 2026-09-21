import { tr } from '../i18n/translate'
import { useAsync } from '../lib/useAsync'
import { crasApi } from '../api/cras'
import type { CraDto, UnavailabilityDto } from '../api/types'
import { monthLabel, UNAVAILABILITY_TYPE_LABELS } from '../lib/format'
import { Card } from '../components/ui'

const WEEKDAY_LABELS = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di']

interface YearMonth {
  year: number
  month: number
}

function shiftYM(ym: YearMonth, delta: number): YearMonth {
  const total = ym.year * 12 + (ym.month - 1) + delta
  return { year: Math.floor(total / 12), month: (total % 12) + 1 }
}

interface Ymd {
  y: number
  m: number
  d: number
}

function parseDate(value: string): Ymd {
  const [y, m, d] = value.split('-').map(Number)
  return { y, m, d }
}

function dateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function addDays(y: number, m: number, d: number, delta: number): Ymd {
  const dt = new Date(Date.UTC(y, m - 1, d + delta))
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() }
}

function monthWindow(startDate: string, endDate: string): YearMonth[] {
  const start = parseDate(startDate)
  const end = parseDate(endDate)
  const startYM = { year: start.y, month: start.m }
  const endYM = { year: end.y, month: end.m }
  const span = endYM.year * 12 + endYM.month - (startYM.year * 12 + startYM.month)
  let from = startYM
  let to = endYM
  if (span <= 5) {
    from = shiftYM(startYM, -1)
    to = shiftYM(endYM, 1)
  }
  const months: YearMonth[] = []
  let cur = from
  while (cur.year < to.year || (cur.year === to.year && cur.month <= to.month)) {
    months.push(cur)
    cur = shiftYM(cur, 1)
  }
  return months
}

function daysBetween(startDate: string, endDate: string): Set<string> {
  const set = new Set<string>()
  let { y, m, d } = parseDate(startDate)
  const end = parseDate(endDate)
  while (y < end.y || (y === end.y && (m < end.m || (m === end.m && d <= end.d)))) {
    set.add(dateKey(y, m, d))
    const next = addDays(y, m, d, 1)
    y = next.y
    m = next.m
    d = next.d
  }
  return set
}

function absenceDates(c: CraDto): Set<string> {
  const set = new Set<string>()
  for (const day of c.days) {
    if (day.dayType === 'LEAVE' || day.dayType === 'SICK_LEAVE' || day.dayType === 'OTHER') {
      set.add(day.date)
    }
  }
  return set
}

function MonthGrid({
  year,
  month,
  selectedDays,
  otherDays,
  congeDays,
  missionDays,
}: {
  year: number
  month: number
  selectedDays: Set<string>
  otherDays: Set<string>
  congeDays: Set<string>
  missionDays: Set<string>
}) {
  const firstDay = new Date(year, month - 1, 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div className="min-w-[10rem]">
      <div className="mb-1 text-center text-[11px] font-semibold text-gray-600">
        {monthLabel(month)} {year}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {WEEKDAY_LABELS.map((l) => (
          <div key={l} className="text-center text-[10px] font-medium text-gray-400">
            {l}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day == null) return <div key={`e-${i}`} />
          const key = dateKey(year, month, day)
          const isSelected = selectedDays.has(key)
          const isOther = otherDays.has(key)
          const isConge = congeDays.has(key)
          const isMission = missionDays.has(key)
          const dow = new Date(year, month - 1, day).getDay()
          const isWeekend = dow === 0 || dow === 6

          let bg = 'bg-white'
          let border = ''
          let text = 'text-gray-700'
          if (isSelected) {
            bg = 'bg-sky-100'
            border = 'ring-2 ring-inset ring-blue-400'
            text = 'text-blue-700 font-semibold'
          } else if (isOther) {
            bg = 'bg-indigo-50'
            border = 'ring-1 ring-inset ring-indigo-300'
            text = 'text-indigo-700'
          } else if (isConge) {
            bg = 'bg-amber-50'
            border = 'ring-1 ring-inset ring-amber-200'
            text = 'text-amber-700'
          } else if (isWeekend) {
            bg = 'bg-gray-50'
            text = 'text-gray-400'
          }

          return (
            <div
              key={key}
              className={`relative flex flex-col items-center rounded-sm p-0.5 text-[11px] leading-none ${bg} ${border}`}
            >
              <span className={text}>{day}</span>
              {isMission && !isSelected && !isOther && !isConge && (
                <span className="mt-0.5 h-1 w-1 rounded-full bg-green-500" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function UnavailabilityCalendar({
  selected,
  unavailabilities,
}: {
  selected: UnavailabilityDto
  unavailabilities: UnavailabilityDto[]
}) {
  const startYear = parseDate(selected.startDate).y
  const endYear = parseDate(selected.endDate).y
  const years = Array.from(
    new Set(
      Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i).filter(
        (y) => y >= 2000,
      ),
    ),
  )

  const { data } = useAsync(
    async () => {
      if (!selected.consultantId || years.length === 0) {
        return { conges: [] as CraDto[], cras: [] as CraDto[] }
      }
      const conges = (
        await Promise.all(years.map((y) => crasApi.findByConsultant(selected.consultantId, y, 'CONGE')))
      ).flat()
      const cras = (
        await Promise.all(years.map((y) => crasApi.findByConsultant(selected.consultantId, y, 'CRA')))
      ).flat()
      return { conges, cras }
    },
    [selected.id, selected.consultantId, startYear, endYear],
  )

  const selectedDays = daysBetween(selected.startDate, selected.endDate)

  const otherDays = new Set<string>()
  for (const u of unavailabilities) {
    if (u.id === selected.id || u.consultantId !== selected.consultantId) continue
    for (const d of daysBetween(u.startDate, u.endDate)) otherDays.add(d)
  }

  const congeDays = new Set<string>()
  for (const c of data?.conges ?? []) {
    for (const d of absenceDates(c)) congeDays.add(d)
  }

  const missionDays = new Set<string>()
  for (const c of data?.cras ?? []) {
    for (const day of c.days) {
      if (day.dayType === 'WORKED' && day.activities.length > 0) {
        missionDays.add(day.date)
      }
    }
  }

  const months = monthWindow(selected.startDate, selected.endDate)

  return (
    <Card className="overflow-hidden p-4">
      <div className="mb-3">
        <div className="flex flex-wrap items-baseline gap-2 text-sm font-semibold text-gray-700">
          <span>Calendrier de l&apos;indisponibilité</span>
          <span className="text-xs font-normal text-gray-500">
            {UNAVAILABILITY_TYPE_LABELS[selected.type] ?? selected.type} — {selected.startDate} →{' '}
            {selected.endDate} ({selected.durationDays} {tr('UnavailabilityCalendar.j')}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-gray-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm ring-2 ring-inset ring-blue-400 bg-sky-100" />
            {tr('UnavailabilityCalendar.indisponibilite.selectionnee')}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm ring-1 ring-inset ring-indigo-300 bg-indigo-50" />
            {tr('UnavailabilityCalendar.autre.indisponibilite')}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm ring-1 ring-inset ring-amber-200 bg-amber-50" />
            {tr('UnavailabilityCalendar.conge.indispo.cra')}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
            {tr('UnavailabilityCalendar.mission')}
          </span>
        </div>
      </div>

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${Math.min(months.length, 3)}, minmax(10rem, 1fr))` }}
      >
        {months.map((m) => (
          <MonthGrid
            key={`${m.year}-${m.month}`}
            year={m.year}
            month={m.month}
            selectedDays={selectedDays}
            otherDays={otherDays}
            congeDays={congeDays}
            missionDays={missionDays}
          />
        ))}
      </div>
    </Card>
  )
}