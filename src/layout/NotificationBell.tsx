import { tr } from '../i18n/translate'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { notificationsApi } from '../api/notifications'
import { useAuth } from '../auth/AuthContext'
import { Badge } from '../components/data'
import { formatDateTime, statusBadge } from '../lib/format'

export function NotificationBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState<import('../api/types').NotificationDto[]>([])
  const [loading, setLoading] = useState(false)
  const [pollEnabled, setPollEnabled] = useState(false)
  const [intervalSec, setIntervalSec] = useState('30')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    const load = () => {
      notificationsApi
        .unreadCount()
        .then((n) => {
          if (!cancelled) setUnread(n)
        })
        .catch(() => {})
    }
    load()
    if (!pollEnabled) {
      return () => {
        cancelled = true
      }
    }
    const secs = Math.max(1, Number(intervalSec) || 30)
    const timer = setInterval(load, secs * 1000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [user?.id, pollEnabled, intervalSec])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next) {
      setLoading(true)
      try {
        const page = await notificationsApi.myNotifications(0, 10)
        setItems(page.items)
      } catch {
        setItems([])
      } finally {
        setLoading(false)
      }
    }
  }

  async function markAll() {
    try {
      await notificationsApi.markAllRead()
      setUnread(0)
      setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch {
      // silencieux
    }
  }

  function openItem(notification: import('../api/types').NotificationDto) {
    setOpen(false)
    if (!notification.read) {
      notificationsApi.markRead(notification.id).catch(() => {})
      setUnread((n) => Math.max(0, n - 1))
    }
    if (notification.link) {
      navigate(notification.link)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={pollEnabled}
          onChange={(e) => setPollEnabled(e.target.checked)}
          className="h-4 w-4 accent-brand-600"
          title={tr('NotificationBell.activer.le.rafraichissement.automatique.des.notifications')}
        />
        <input
          type="text"
          inputMode="numeric"
          value={intervalSec}
          onChange={(e) => setIntervalSec(e.target.value.replace(/[^0-9]/g, ''))}
          disabled={!pollEnabled}
          className="w-12 rounded-md border border-gray-300 px-1.5 py-1 text-center text-xs disabled:opacity-40"
          title={tr('NotificationBell.intervalle.de.rafraichissement.secondes')}
        />
        <button
          onClick={toggle}
          className="relative rounded-md p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
          title={tr('NotificationBell.notifications')}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2Zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4a1.5 1.5 0 0 0-3 0v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2Z" />
          </svg>
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      </div>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <p className="text-sm font-semibold text-gray-900">{tr('NotificationBell.notifications')}</p>
            <button
              onClick={markAll}
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              {tr('NotificationBell.tout.marquer.lu')}
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading && <p className="px-4 py-6 text-center text-sm text-gray-400">{tr('NotificationBell.chargement')}</p>}
            {!loading && items.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-gray-400">
                {tr('NotificationBell.aucune.notification')}
              </p>
            )}
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => openItem(n)}
                className={`block w-full border-b border-gray-100 px-4 py-3 text-left transition hover:bg-gray-50 ${
                  n.read ? 'opacity-70' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900">{n.title}</p>
                  <Badge kind={statusBadge(n.type)}>{n.type}</Badge>
                </div>
                {n.body && <p className="mt-1 line-clamp-2 text-sm text-gray-500">{n.body}</p>}
                <p className="mt-1 text-xs text-gray-400">{formatDateTime(n.createdAt)}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
