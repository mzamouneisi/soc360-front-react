import { tr } from '../i18n/translate'
import { crasApi } from '../api/cras'
import type { CraDto } from '../api/types'
import { MONTHS_FR } from '../lib/format'
import { useAsync } from '../lib/useAsync'
import { Card } from '../components/ui'

const WEEKDAY_LABELS = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di']

function parseYM(key: string): { year: number; month: number } {
  const [y, m] = key.split('-').map(Number)
  return { year: y, month: m }
}

function ymKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function isBefore(a: { year: number; month: number }, b: { year: number; month: number }): boolean {
  return a.year < b.year || (a.year === b.year && a.month < b.month)
}

function prevYM(ym: { year: number; month: number }): { year: number; month: number } {
  const pm = ym.month === 1 ? 12 : ym.month - 1
  const py = ym.month === 1 ? ym.year - 1 : ym.year
  return { year: py, month: pm }
}

function nextYM(ym: { year: number; month: number }): { year: number; month: number } {
  const nm = ym.month === 12 ? 1 : ym.month + 1
  const ny = ym.month === 12 ? ym.year + 1 : ym.year
  return { year: ny, month: nm }
}

function computeGroupKeys(
  congeByKey: Map<string, CraDto>,
  selectedKey: string,
): Set<string> {
  const keys = new Set<string>()
  let cur = selectedKey
  while (congeByKey.has(cur)) {
    keys.add(cur)
    const ym = parseYM(cur)
    const nx = nextYM(ym)
    cur = ymKey(nx.year, nx.month)
  }
  const pv = prevYM(parseYM(selectedKey))
  cur = ymKey(pv.year, pv.month)
  while (congeByKey.has(cur)) {
    keys.add(cur)
    const ym = parseYM(cur)
    const pv2 = prevYM(ym)
    cur = ymKey(pv2.year, pv2.month)
  }
  keys.add(selectedKey)
  return keys
}

function absenceDates(c: CraDto): Set<string> {
  const s = new Set<string>()
  for (const day of c.days) {
    if (day.dayType === 'LEAVE' || day.dayType === 'SICK_LEAVE' || day.dayType === 'OTHER') {
      s.add(day.date)
    }
  }
  return s
}

function MonthGrid({
  year,
  month,
  groupAbsence,
  otherAbsence,
  missionDays,
}: {
  year: number
  month: number
  groupAbsence: Set<string>
  otherAbsence: Set<string>
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
        {MONTHS_FR[month - 1]} {year}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {WEEKDAY_LABELS.map((l) => (
          <div key={l} className="text-center text-[10px] font-medium text-gray-400">
            {l}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day == null) return <div key={`e-${i}`} />
          const dateStr = ymKey(year, month) + '-' + String(day).padStart(2, '0')
          const isGroup = groupAbsence.has(dateStr)
          const isOther = otherAbsence.has(dateStr)
          const isMission = missionDays.has(dateStr)
          const dow = new Date(year, month - 1, day).getDay()
          const isWeekend = dow === 0 || dow === 6

          let bg = 'bg-white'
          let border = ''
          let text = 'text-gray-700'
          if (isGroup) {
            bg = 'bg-sky-100'
            border = 'ring-2 ring-inset ring-blue-400'
            text = 'text-blue-700 font-semibold'
          } else if (isOther) {
            bg = 'bg-amber-50'
            border = 'ring-1 ring-inset ring-amber-200'
            text = 'text-amber-700'
          } else if (isWeekend) {
            bg = 'bg-gray-50'
            text = 'text-gray-400'
          }

          return (
            <div
              key={dateStr}
              className={`relative flex flex-col items-center rounded-sm p-0.5 text-[11px] leading-none ${bg} ${border}`}
            >
              <span className={text}>{day}</span>
              {isMission && !isGroup && !isOther && (
                <span className="mt-0.5 h-1 w-1 rounded-full bg-green-500" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function IndispoCalendar({
  selected,
  indispos,
  year,
}: {
  selected: CraDto
  indispos: CraDto[]
  year: number
}) {
  const { data: craList } = useAsync(
    () =>
      selected.consultantId
        ? crasApi.findByConsultant(selected.consultantId, year, 'CRA')
        : Promise.resolve([] as CraDto[]),
    [selected.consultantId, year],
  )

  const congeByKey = new Map<string, CraDto>()
  for (const c of indispos) {
    congeByKey.set(ymKey(c.year, c.month), c)
  }

  const selectedK = ymKey(selected.year, selected.month)
  const groupKeys = congeByKey.has(selectedK) ? computeGroupKeys(congeByKey, selectedK) : new Set([selectedK])

  const groupAbsence = new Set<string>()
  const otherAbsence = new Set<string>()
  for (const [k, c] of congeByKey) {
    const dates = absenceDates(c)
    const target = groupKeys.has(k) ? groupAbsence : otherAbsence
    for (const d of dates) target.add(d)
  }

  const missionDays = new Set<string>()
  for (const cra of craList ?? []) {
    for (const day of cra.days) {
      if (day.dayType === 'WORKED' && day.activities.length > 0) {
        missionDays.add(day.date)
      }
    }
  }

  const groupMonths = [...groupKeys].map(parseYM).sort((a, b) => (isBefore(a, b) ? -1 : 1))
  const winStartMonth = Math.max(1, groupMonths[0].month - 1)
  const winEndMonth = Math.min(12, groupMonths[groupMonths.length - 1].month + 1)

  const months: { year: number; month: number }[] = []
  for (let m = winStartMonth; m <= winEndMonth; m++) {
    months.push({ year, month: m })
  }

  const firstAbs = [...groupAbsence].sort()[0] ?? null
  const lastAbs = [...groupAbsence].sort().reverse()[0] ?? null

  return (
    <Card className="overflow-hidden p-4">
      <div className="mb-3 flex flex-wrap items-baseline gap-2 text-sm font-semibold text-gray-700">
        <span>Calendrier de l&apos;absence</span>
        {firstAbs && lastAbs && (
          <span className="text-xs font-normal text-gray-500">
            {firstAbs} → {lastAbs}
            {groupKeys.size > 1 && ` (${groupKeys.size} mois)`}
          </span>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-4 text-[11px] text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm ring-2 ring-inset ring-blue-400 bg-sky-100" />
          {tr('IndispoCalendar.indispo.selectionnee')}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm ring-1 ring-inset ring-amber-200 bg-amber-50" />
          {tr('IndispoCalendar.autre.indispo')}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
          {tr('IndispoCalendar.mission')}
        </span>
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
            groupAbsence={groupAbsence}
            otherAbsence={otherAbsence}
            missionDays={missionDays}
          />
        ))}
      </div>
    </Card>
  )
}
