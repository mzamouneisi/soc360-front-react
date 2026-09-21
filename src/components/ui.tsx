import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { useI18n } from '../i18n'

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent ${className}`}
      aria-hidden="true"
    />
  )
}

export function FullPageSpinner() {
  const { t } = useI18n()
  return (
    <div className="flex h-full items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <Spinner className="h-8 w-8" />
        <p className="text-sm text-gray-500">{t('common.loading')}</p>
      </div>
    </div>
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props
  return (
    <input
      className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-gray-100 ${className}`}
      {...rest}
    />
  )
}

let monthInputSupported: boolean | null = null

function supportsMonthInput(): boolean {
  if (monthInputSupported === null) {
    const probe = document.createElement('input')
    probe.setAttribute('type', 'month')
    monthInputSupported = probe.type === 'month'
  }
  return monthInputSupported
}

export function MonthInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props
  if (supportsMonthInput()) {
    return <Input type="month" className={className} {...rest} />
  }
  return (
    <Input
      type="text"
      inputMode="numeric"
      placeholder="AAAA-MM"
      pattern="\d{4}-\d{2}"
      className={className}
      {...rest}
    />
  )
}

export function Button({
  className = '',
  variant = 'primary',
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'yellow' | 'green' }) {
  const variants = {
    primary: 'bg-brand-600 hover:bg-brand-700',
    yellow: 'bg-yellow-500 hover:bg-yellow-600',
    green: 'bg-green-600 hover:bg-green-700',
  }
  return (
    <button
      className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition focus:outline-none focus:ring-2 focus:ring-brand-500/40 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Alert({
  variant = 'error',
  children,
}: {
  variant?: 'error' | 'success' | 'info'
  children: ReactNode
}) {
  const styles = {
    error: 'border-red-200 bg-red-50 text-red-800',
    success: 'border-green-200 bg-green-50 text-green-800',
    info: 'border-brand-200 bg-brand-50 text-brand-800',
  }
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-sm ${styles[variant]}`}
      role={variant === 'error' ? 'alert' : 'status'}
    >
      {children}
    </div>
  )
}

export function Card({
  className = '',
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  )
}

export function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

export function Select({
  className = '',
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-gray-100 ${className}`}
      {...rest}
    >
      {children}
    </select>
  )
}

export function Textarea({
  className = '',
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-gray-100 ${className}`}
      {...rest}
    />
  )
}

export function InlineButton({
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export function RefreshButton({
  onClick,
  className = '',
  label,
}: {
  onClick: () => void
  className?: string
  label?: string
}) {
  const { t } = useI18n()
  return (
    <InlineButton onClick={onClick} title={t('common.reload')} className={className}>
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 8 8 1 1 0 0 0-2 0 6 6 0 1 1-6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35Z" />
      </svg>
      {label ?? t('common.refresh')}
    </InlineButton>
  )
}
