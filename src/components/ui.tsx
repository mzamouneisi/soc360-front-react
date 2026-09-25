import { tr } from '../i18n/translate'
import type {
  ButtonHTMLAttributes,
  CSSProperties,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { useI18n } from '../i18n'
import { Icon, type IconName } from './icons'

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
      placeholder={tr('ui.aaaa.mm')}
      pattern="\d{4}-\d{2}"
      className={className}
      {...rest}
    />
  )
}

function labelLength(children: ReactNode): number {
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children).trim().length
  }
  if (Array.isArray(children)) {
    return children.reduce<number>((total, child) => total + labelLength(child), 0)
  }
  return 0
}

export function Button({
  className = '',
  variant = 'primary',
  size = 'auto',
  children,
  disabled,
  style,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'yellow' | 'green' | 'danger' | 'neutral'
  size?: 'auto' | 'sm' | 'lg'
}) {
  const variants = {
    primary: 'text-white hover:brightness-95',
    yellow: 'bg-yellow-500 text-white hover:bg-yellow-600',
    green: 'bg-green-600 text-white hover:bg-green-700',
    danger: 'text-white hover:brightness-95',
    neutral: 'border border-gray-300 hover:brightness-95',
  }
  const resolved: 'sm' | 'lg' =
    size === 'auto' ? (labelLength(children) > 12 ? 'lg' : 'sm') : size
  const background =
    variant === 'primary'
      ? { backgroundColor: 'var(--btn-save-color)' }
      : variant === 'danger'
        ? { backgroundColor: 'var(--btn-delete-color)' }
        : variant === 'neutral'
          ? { backgroundColor: 'var(--btn-cancel-color)', color: 'var(--btn-cancel-text-color)' }
          : {}
  return (
    <button
      className={`inline-flex w-auto items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-brand-500/40 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      style={{ minWidth: `var(--btn-${resolved === 'lg' ? 'large' : 'small'}-width)`, ...background, ...style }}
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
  style,
  children,
}: {
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white shadow-sm ${className}`}
      style={style}
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
  variant = 'neutral',
  children,
  style,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'neutral' | 'danger' | 'primary' | 'soft' | 'history' }) {
  const variants = {
    neutral: 'border border-gray-300 hover:brightness-95',
    danger: 'border border-transparent text-white hover:brightness-95',
    primary: 'border border-transparent text-white hover:brightness-95',
    soft: 'border hover:brightness-95',
    history: 'border hover:brightness-95',
  }
  const background =
    variant === 'primary'
      ? { backgroundColor: 'var(--btn-save-color)' }
      : variant === 'danger'
        ? { backgroundColor: 'var(--btn-delete-color)' }
        : variant === 'neutral'
          ? { backgroundColor: 'var(--btn-cancel-color)', color: 'var(--btn-cancel-text-color)' }
          : {}
  const soft =
    variant === 'soft'
      ? {
          color: 'var(--btn-submit-text-color)',
          borderColor: 'var(--btn-submit-color)',
          backgroundColor: 'var(--btn-submit-color)',
        }
      : variant === 'history'
        ? {
            color: 'var(--btn-history-text-color)',
            borderColor: 'var(--btn-history-color)',
            backgroundColor: 'var(--btn-history-color)',
          }
        : {}
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      style={{ minWidth: 'var(--btn-small-width)', ...background, ...soft, ...style }}
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
  variant = 'primary',
  disabled = false,
}: {
  onClick: () => void
  className?: string
  label?: string
  variant?: 'neutral' | 'primary' | 'danger'
  disabled?: boolean
}) {
  const { t } = useI18n()
  return (
    <InlineButton
      onClick={onClick}
      title={t('common.reload')}
      aria-label={t('common.reload')}
      className={className}
      variant={variant}
      disabled={disabled}
    >
      <Icon name="refresh" />
      {label}
    </InlineButton>
  )
}

export function IconButton({
  icon,
  label,
  variant = 'neutral',
  className = '',
  loading = false,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: IconName
  label: string
  variant?: 'neutral' | 'danger' | 'primary' | 'soft' | 'history'
  loading?: boolean
}) {
  return (
    <InlineButton
      variant={variant}
      className={className}
      title={label}
      aria-label={label}
      {...rest}
    >
      {loading ? <Spinner className="border-white border-t-transparent" /> : <Icon name={icon} />}
    </InlineButton>
  )
}
