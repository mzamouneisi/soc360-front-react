export const DEFAULT_VAT_RATE = 20

function isValidRate(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100
}

/** Taux de TVA par défaut de la société (20 % si absent ou invalide). */
export function socVatRate(soc?: { vatRate?: number | null } | null): number {
  const value = soc?.vatRate
  return typeof value === 'number' && isValidRate(value) ? value : DEFAULT_VAT_RATE
}

/** Normalise une saisie de TVA ; 0 est conservé, une valeur invalide retombe sur le défaut. */
export function normalizeVatRate(
  value: string | number | null | undefined,
  fallback: number = DEFAULT_VAT_RATE,
): number {
  if (value == null || value === '') return fallback
  const rate = Number(value)
  return isValidRate(rate) ? rate : fallback
}
