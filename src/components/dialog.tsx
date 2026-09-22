import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { tr } from '../i18n/translate'

export type DialogVariant = 'info' | 'success' | 'warning' | 'error' | 'question'

export type DialogOptions = {
  title?: string
  variant?: DialogVariant
  okLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type DialogMode = 'alert' | 'confirm' | 'prompt'

type DialogRequest = {
  id: number
  mode: DialogMode
  message: string
  defaultValue: string
  options: DialogOptions
  resolve: (value: unknown) => void
}

type Listener = (request: DialogRequest | null) => void

let active: DialogRequest | null = null
const queue: DialogRequest[] = []
const listeners = new Set<Listener>()
let sequence = 0

function publish() {
  for (const listener of listeners) listener(active)
}

function flush() {
  if (!active && queue.length > 0) active = queue.shift()!
  publish()
}

function settle(value: unknown) {
  const current = active
  if (!current) return
  active = null
  current.resolve(value)
  flush()
}

function subscribe(listener: Listener) {
  listeners.add(listener)
  listener(active)
  return () => {
    listeners.delete(listener)
  }
}

function openDialog(
  mode: DialogMode,
  message: string,
  defaultValue: string,
  options?: DialogOptions,
): Promise<unknown> {
  return new Promise((resolve) => {
    queue.push({
      id: ++sequence,
      mode,
      message,
      defaultValue,
      options: options ?? {},
      resolve,
    })
    flush()
  })
}

function openAlert(variant: DialogVariant, message: string, options?: DialogOptions): Promise<boolean> {
  return openDialog('alert', message, '', { variant, ...options }).then(() => true)
}

export const dialog = {
  info: (message: string, options?: DialogOptions) => openAlert('info', message, options),
  success: (message: string, options?: DialogOptions) => openAlert('success', message, options),
  warning: (message: string, options?: DialogOptions) => openAlert('warning', message, options),
  error: (message: string, options?: DialogOptions) => openAlert('error', message, options),
  confirm: (message: string, options?: DialogOptions): Promise<boolean> =>
    openDialog('confirm', message, '', options).then((value) => value === true),
  prompt: (message: string, defaultValue = '', options?: DialogOptions): Promise<string | null> =>
    openDialog('prompt', message, defaultValue, options).then((value) =>
      value === null || value === undefined ? null : String(value),
    ),
}

const VARIANT_TITLES: Record<DialogVariant, string> = {
  info: 'dialog.infoTitle',
  success: 'dialog.successTitle',
  warning: 'dialog.warningTitle',
  error: 'dialog.errorTitle',
  question: 'dialog.confirmTitle',
}

const VARIANT_ICON: Record<DialogVariant, ReactNode> = {
  info: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 5a1.25 1.25 0 1 1 0 2.5A1.25 1.25 0 0 1 12 7Zm1.25 10h-2.5v-6h2.5v6Z" />,
  success: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.2 14.2-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4-7 7Z" />,
  warning: <path d="M12 2 1 21h22L12 2Zm1 15h-2v-2h2v2Zm0-4h-2V9h2v4Z" />,
  error: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-2h2v2Zm0-4h-2V7h2v6Z" />,
  question: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm.1 15.5a1.4 1.4 0 1 1 0-2.8 1.4 1.4 0 0 1 0 2.8Zm1.5-6.1c-.9.7-1.1 1-1.1 1.9v.2h-2v-.3c0-1.6.5-2.4 1.7-3.2.8-.6 1.1-1 1.1-1.7 0-.9-.7-1.5-1.6-1.5-.8 0-1.5.5-1.6 1.3H8c.1-1.9 1.6-3.2 3.7-3.2 2.1 0 3.6 1.2 3.6 3 0 1.3-.6 2.1-1.7 3Z" />,
}

const VARIANT_STYLE: Record<DialogVariant, { badge: string; icon: string }> = {
  info: { badge: 'bg-brand-50', icon: 'text-brand-600' },
  success: { badge: 'bg-green-50', icon: 'text-green-600' },
  warning: { badge: 'bg-yellow-50', icon: 'text-yellow-600' },
  error: { badge: 'bg-red-50', icon: 'text-red-600' },
  question: { badge: 'bg-brand-50', icon: 'text-brand-600' },
}

export function DialogHost() {
  const [request, setRequest] = useState<DialogRequest | null>(active)
  const [inputValue, setInputValue] = useState('')

  useEffect(
    () =>
      subscribe((next) => {
        setRequest(next)
        setInputValue(next?.defaultValue ?? '')
      }),
    [],
  )

  useEffect(
    () => () => {
      active = null
      queue.length = 0
    },
    [],
  )

  useEffect(() => {
    if (!request) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        settle(request.mode === 'alert' ? true : request.mode === 'confirm' ? false : null)
      }
      if (event.key === 'Enter' && request.mode === 'prompt') {
        settle(inputValue)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [request, inputValue])

  if (!request) return null

  const { mode, message, options } = request
  const variant: DialogVariant = options.variant ?? (mode === 'confirm' ? 'question' : 'info')
  const style = VARIANT_STYLE[variant]
  const title = options.title ?? tr(VARIANT_TITLES[variant])
  const confirmLabel = options.okLabel ?? tr('dialog.confirm')
  const cancelLabel = options.cancelLabel ?? tr('common.cancel')

  const confirm = () => settle(mode === 'prompt' ? inputValue : true)
  const abort = () => settle(mode === 'alert' ? true : mode === 'confirm' ? false : null)

  const primaryClass = options.danger
    ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500/40'
    : 'bg-brand-600 hover:bg-brand-700 focus:ring-brand-500/40'

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-gray-900/50 p-4"
      role="presentation"
    >
      <div className="fixed inset-0" onClick={abort} aria-hidden="true" />
      <div
        className="relative flex w-[600px] max-w-[calc(100vw-2rem)] flex-col rounded-2xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${style.badge}`}
          >
            <svg className={`h-5 w-5 ${style.icon}`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              {VARIANT_ICON[variant]}
            </svg>
          </span>
          <h3 id="dialog-title" className="text-lg font-semibold text-gray-900">
            {title}
          </h3>
        </div>

        <div className="max-h-[500px] overflow-y-auto px-6 py-5">
          <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">{message}</p>
          {mode === 'prompt' && (
            <input
              autoFocus
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder={tr('dialog.input')}
              className="mt-4 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
          {mode !== 'alert' && (
            <button
              type="button"
              onClick={abort}
              className="inline-flex h-10 w-32 items-center justify-center rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-700 transition hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            autoFocus={mode !== 'prompt'}
            onClick={confirm}
            className={`inline-flex h-10 w-32 items-center justify-center rounded-xl text-sm font-semibold text-white transition focus:outline-none focus:ring-2 ${primaryClass}`}
          >
            {mode === 'alert' ? tr('dialog.ok') : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
