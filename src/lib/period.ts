export interface YearMonth {
  year: number
  month: number
}

/** Période (année + mois) correspondant à une date d'embauche ISO `AAAA-MM-JJ`. */
export function parseHirePeriod(hireDate?: string | null): YearMonth | null {
  if (!hireDate) return null
  const match = /^(\d{4})-(\d{2})/.exec(hireDate)
  if (!match) return null
  return { year: Number(match[1]), month: Number(match[2]) }
}

/** Borne maximale d'accès : 3 ans à partir d'aujourd'hui. */
export function maxPeriod(now = new Date()): YearMonth {
  return { year: now.getFullYear() + 3, month: now.getMonth() + 1 }
}

export function isAfterPeriod(a: YearMonth, b: YearMonth): boolean {
  return a.year > b.year || (a.year === b.year && a.month > b.month)
}

export function isBeforePeriod(a: YearMonth, b: YearMonth): boolean {
  return a.year < b.year || (a.year === b.year && a.month < b.month)
}

/**
 * Années proposées : de l'année d'embauche (ou année précédente si inconnue) jusqu'à
 * aujourd'hui + 3 ans.
 */
export function allowedYears(
  hireYear: number | null | undefined,
  now = new Date(),
): number[] {
  const current = now.getFullYear()
  const min = hireYear != null ? Math.min(hireYear, current) : current - 1
  const max = current + 3
  const years: number[] = []
  for (let year = min; year <= max; year++) {
    years.push(year)
  }
  return years
}

/**
 * Mois proposés pour une année : à partir du mois d'embauche l'année d'embauche, et jusqu'au
 * mois courant pour l'année « aujourd'hui + 3 ans ».
 */
export function allowedMonths(
  year: number,
  hirePeriod: YearMonth | null | undefined,
  now = new Date(),
): number[] {
  const max = maxPeriod(now)
  return Array.from({ length: 12 }, (_, index) => index + 1).filter((month) => {
    if (hirePeriod && year < hirePeriod.year) return false
    if (hirePeriod && year === hirePeriod.year && month < hirePeriod.month) {
      return false
    }
    if (year > max.year) return false
    if (year === max.year && month > max.month) return false
    return true
  })
}
