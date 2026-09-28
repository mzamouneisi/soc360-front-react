import { useMemo } from 'react'
import DatePicker from 'react-datepicker'
import { ar, enUS, fr, type Locale } from 'date-fns/locale'
import 'react-datepicker/dist/react-datepicker.css'
import { useI18n } from '../i18n'

const DATE_FNS_LOCALES: Record<string, Locale> = { fr, en: enUS, ar }

/**
 * Champ de type « mois » (`<input type="month">` enrichi) basé sur `react-datepicker`.
 * Les libellés (mois, navigation) sont traduits à la volée selon la langue de l'application
 * via les locales `date-fns`. La valeur échangée reste au format `AAAA-MM`.
 */
export function MonthPicker({
  value,
  onChange,
  placeholder,
  title,
  id,
  className = '',
  isClearable = true,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  title?: string
  id?: string
  className?: string
  isClearable?: boolean
}) {
  const { language } = useI18n()
  const locale = DATE_FNS_LOCALES[language] ?? fr

  const selected = useMemo(() => {
    const match = /^(\d{4})-(\d{2})$/.exec(value)
    return match ? new Date(Number(match[1]), Number(match[2]) - 1, 1) : null
  }, [value])

  return (
    <DatePicker
      id={id}
      title={title}
      className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 ${className}`}
      selected={selected}
      onChange={(date: Date | null) =>
        onChange(
          date
            ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
            : '',
        )
      }
      showMonthYearPicker
      dateFormat="MMMM yyyy"
      locale={locale}
      isClearable={isClearable}
      placeholderText={placeholder}
      showPopperArrow={false}
      popperPlacement="bottom-start"
      autoComplete="off"
    />
  )
}
