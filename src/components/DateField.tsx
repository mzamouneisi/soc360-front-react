import { useMemo } from 'react'
import DatePicker from 'react-datepicker'
import { ar, enUS, fr, type Locale } from 'date-fns/locale'
import 'react-datepicker/dist/react-datepicker.css'
import { useI18n } from '../i18n'

const DATE_FNS_LOCALES: Record<string, Locale> = { fr, en: enUS, ar }
const DATE_FORMATS: Record<string, string> = {
  fr: 'dd/MM/yyyy',
  en: 'MM/dd/yyyy',
  ar: 'dd/MM/yyyy',
}
const DATE_PLACEHOLDERS: Record<string, string> = {
  fr: 'jj/mm/aaaa',
  en: 'mm/dd/yyyy',
  ar: 'yyyy/mm/dd',
}

export function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`
}

/**
 * Champ date localisé basé sur `react-datepicker` : le calendrier et le format d'affichage
 * suivent la langue de l'application (locales `date-fns`). La valeur échangée reste `AAAA-MM-JJ`.
 */
export function DateField({
  value,
  onChange,
  minDate,
  maxDate,
  id,
  title,
  placeholder,
  className = '',
  disabled = false,
  isClearable = true,
}: {
  value?: string
  onChange: (value: string) => void
  minDate?: string
  maxDate?: string
  id?: string
  title?: string
  placeholder?: string
  className?: string
  disabled?: boolean
  isClearable?: boolean
}) {
  const { language } = useI18n()
  const locale = DATE_FNS_LOCALES[language] ?? fr
  const dateFormat = DATE_FORMATS[language] ?? DATE_FORMATS.fr

  const selected = useMemo(() => parseIsoDate(value), [value])
  const min = useMemo(() => parseIsoDate(minDate), [minDate])
  const max = useMemo(() => parseIsoDate(maxDate), [maxDate])

  return (
    <DatePicker
      id={id}
      title={title}
      className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-gray-100 ${className}`}
      disabled={disabled}
      selected={selected}
      onChange={(date: Date | null) => onChange(date ? toIsoDate(date) : '')}
      minDate={min ?? undefined}
      maxDate={max ?? undefined}
      dateFormat={dateFormat}
      locale={locale}
      isClearable={isClearable}
      placeholderText={placeholder ?? DATE_PLACEHOLDERS[language] ?? dateFormat}
      showPopperArrow={false}
      popperPlacement="bottom-start"
      autoComplete="off"
    />
  )
}
