import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NotificationBell } from './NotificationBell'

const { unreadCountMock } = vi.hoisted(() => ({ unreadCountMock: vi.fn() }))

vi.mock('../api/notifications', () => ({
  notificationsApi: {
    unreadCount: unreadCountMock,
    myNotifications: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  },
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 3 }, initializing: false }),
}))

vi.mock('../i18n/translate', () => ({
  tr: (key: string) => key,
}))

afterEach(() => {
  vi.clearAllMocks()
})

function renderBell() {
  return render(
    <MemoryRouter>
      <NotificationBell />
    </MemoryRouter>,
  )
}

describe('NotificationBell', () => {
  it('active le rafraîchissement automatique par défaut', async () => {
    unreadCountMock.mockResolvedValue(0)
    renderBell()

    const checkbox = await screen.findByTitle(
      'NotificationBell.activer.le.rafraichissement.automatique.des.notifications',
    )
    expect(checkbox).toBeChecked()
    await waitFor(() => expect(unreadCountMock).toHaveBeenCalled())
  })

  it('rafraîchit le compteur au retour de focus', async () => {
    unreadCountMock.mockResolvedValue(1)
    renderBell()

    await waitFor(() => expect(unreadCountMock).toHaveBeenCalledTimes(1))
    window.dispatchEvent(new Event('focus'))
    await waitFor(() => expect(unreadCountMock.mock.calls.length).toBeGreaterThan(1))
  })
})
