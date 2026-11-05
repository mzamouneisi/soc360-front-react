import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { NotificationSettings } from './NotificationSettings'
import type { NotificationConfigDto } from '../api/types'

const { listMock, collaboratorsMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  collaboratorsMock: vi.fn(),
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, role: 'RESPONSIBLE_SOC', socId: 5 } }),
}))

vi.mock('../soc/SocContext', () => ({
  useSoc: () => ({ selectedSocId: 5 }),
}))

vi.mock('../api/notificationConfigs', () => ({
  notificationConfigsApi: {
    list: listMock,
    save: vi.fn(),
    setStatus: vi.fn(),
    run: vi.fn(),
    remove: vi.fn(),
    executionsByConfig: vi.fn(),
  },
}))

vi.mock('../api/consultants', () => ({
  consultantsApi: { collaborators: collaboratorsMock },
}))

const config: NotificationConfigDto = {
  id: 1,
  socId: 5,
  name: 'Rappel CRA mensuel',
  subject: 'CRA {{craPeriod}}',
  contextType: 'CRA',
  message: 'Merci de compléter votre CRA.',
  channelInApp: true,
  channelEmail: true,
  scheduleType: 'RECURRING',
  executionAt: '2026-11-25T08:00:00',
  recurrence: 'MONTHLY',
  recurrenceEndDate: null,
  status: 'ACTIVE',
  referenceType: 'CRA',
  referenceId: null,
  recipientIds: [2],
  recipientNames: ['Jean Dupont'],
  nextRunAt: '2026-11-25T08:00:00',
  lastRunAt: null,
  createdAt: '2026-11-01T08:00:00Z',
  updatedAt: '2026-11-01T08:00:00Z',
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('NotificationSettings', () => {
  it('affiche les configurations de la société', async () => {
    listMock.mockResolvedValue([config])
    collaboratorsMock.mockResolvedValue([{ id: 2, fullName: 'Jean Dupont', position: null, email: 'j@test.fr', role: 'CONSULTANT' }])

    render(<NotificationSettings />)

    expect(await screen.findByText('Rappel CRA mensuel')).toBeInTheDocument()
    expect(screen.getByText('Jean Dupont')).toBeInTheDocument()
    expect(document.getElementById('NotificationSettings.row.1.status')).toBeInTheDocument()
  })

  it('ouvre le formulaire de création', async () => {
    listMock.mockResolvedValue([])
    collaboratorsMock.mockResolvedValue([])

    render(<NotificationSettings />)

    fireEvent.click(document.getElementById('NotificationSettings.new') as HTMLElement)

    expect(document.getElementById('NotificationSettings.form')).toBeInTheDocument()
    expect(document.getElementById('NotificationSettings.name.input')).toBeInTheDocument()
    expect(document.getElementById('NotificationSettings.recipients.input')).toBeInTheDocument()
  })
})
