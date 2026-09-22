import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Spinner } from './ui'
import { badgeClasses } from '../lib/format'
import { useAuth } from '../auth/AuthContext'
import { useI18n } from '../i18n'

export function Badge({
  kind = 'muted',
  children,
}: {
  kind?: string
  children: ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClasses(kind)}`}
    >
      {children}
    </span>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
  count,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  count?: number
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          {title}
          {count !== undefined && (
            <span className="ml-2 align-middle text-lg font-semibold text-gray-400">
              ({count})
            </span>
          )}
        </h2>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M20 6h-8l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2Zm-5 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-gray-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function LoadingBlock() {
  return (
    <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-16">
      <Spinner />
    </div>
  )
}

export function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {message}
    </div>
  )
}

export function Table<T>({
  columns,
  rows,
  rowKey,
  loading,
  empty,
  onRowClick,
  paginate = false,
  startIndex = 0,
}: {
  columns: { key: string; label: string; className?: string; render: (row: T) => ReactNode }[]
  rows: T[]
  rowKey: (row: T) => string | number
  loading?: boolean
  empty?: ReactNode
  onRowClick?: (row: T) => void
  paginate?: boolean
  startIndex?: number
}) {
  const { user } = useAuth()
  const { t } = useI18n()
  const [page, setPage] = useState(0)

  if (loading) return <LoadingBlock />
  if (rows.length === 0) {
    return empty ?? <EmptyState title={t('common.noElements')} description={t('common.noData')} />
  }

  const pageSize = paginate ? (user?.pageSize ?? 5) : 0
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1
  const safePage = Math.min(page, totalPages - 1)
  const visibleRows = pageSize > 0 ? rows.slice(safePage * pageSize, safePage * pageSize + pageSize) : rows
  const firstIndex = startIndex + (pageSize > 0 ? safePage * pageSize : 0)

  return (
    <div
      className="overflow-hidden rounded-xl border bg-white shadow-sm"
      style={{ borderColor: 'var(--table-border)' }}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead style={{ backgroundColor: 'var(--table-header)' }}>
            <tr>
              <th className="w-12 px-3 py-3 text-right text-xs font-bold uppercase tracking-wide text-gray-400">
                #
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {visibleRows.map((row, rowIndex) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`even:bg-gray-50 ${onRowClick ? 'cursor-pointer transition hover:bg-gray-100' : ''}`}
              >
                <td className="w-12 px-3 py-3 text-right text-sm tabular-nums text-gray-400">
                  {firstIndex + rowIndex + 1}
                </td>
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-sm text-gray-700">
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {paginate && totalPages > 1 && (
        <Pagination page={safePage} totalPages={totalPages} total={rows.length} onChange={setPage} />
      )}
    </div>
  )
}

export function Pagination({
  page,
  totalPages,
  onChange,
  total,
}: {
  page: number
  totalPages: number
  total?: number
  onChange: (page: number) => void
}) {
  const { t } = useI18n()
  if (totalPages <= 1) return null
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
      {total !== undefined && (
        <span>
          {total} {total > 1 ? t('common.items') : t('common.item')}
        </span>
      )}
      <div className="flex items-center gap-1">
        <button
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40"
          disabled={page <= 0}
          onClick={() => onChange(page - 1)}
        >
          {t('common.previous')}
        </button>
        <span className="px-3">
          {t('common.page')} {page + 1} / {totalPages}
        </span>
        <button
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40"
          disabled={page >= totalPages - 1}
          onClick={() => onChange(page + 1)}
        >
          {t('common.next')}
        </button>
      </div>
    </div>
  )
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  const { t } = useI18n()
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-900/50 p-4 sm:p-8">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div
        className={`relative w-full ${sizes[size]} rounded-xl bg-white shadow-xl`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label={t('common.close')}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12Z" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
