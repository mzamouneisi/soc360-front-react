import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NotificationSettings } from './NotificationSettings'
import type { NotificationConfigDto } from '../api/types'

const { listMock, collaboratorsMock, saveMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  collaboratorsMock: vi.fn(),
  saveMock: vi.fn().mockResolvedValue({}),
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
    save: saveMock,
    setStatus: vi.fn(),
    run: vi.fn(),
    remove: vi.fn(),
    executionsByConfig: vi.fn(),
  },
}))

vi.mock('../api/consultants', () => ({
  consultantsApi: { collaborators: collaboratorsMock },
}))

vi.mock('../components/dialog', () => ({
  dialog: {
    confirm: vi.fn().mockResolvedValue(true),
    success: vi.fn(),
    error: vi.fn(),
    alert: vi.fn(),
  },
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
  recipientAll: false,
  recipientEmployee: false,
  recipientNonEmployee: false,
  recipientManager: false,
  recipientConsultant: false,
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
    collaboratorsMock.mockResolvedValue([{ id: 2, fullName: 'Jean Dupont', position: null, email: 'j@test.fr', role: 'CONSULTANT', employee: true }])

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

  it('ouvre la popup d’édition au clic sur une ligne', async () => {
    listMock.mockResolvedValue([config])
    collaboratorsMock.mockResolvedValue([])

    render(<NotificationSettings />)

    await screen.findByText('Rappel CRA mensuel')
    fireEvent.click(document.getElementById('table.row.1') as HTMLElement)

    expect(document.getElementById('NotificationSettings.form')).toBeInTheDocument()
    expect((document.getElementById('NotificationSettings.name.input') as HTMLInputElement).value).toBe(
      'Rappel CRA mensuel',
    )
  })

  it('les boutons d’action n’ouvrent pas la popup d’édition', async () => {
    listMock.mockResolvedValue([config])
    collaboratorsMock.mockResolvedValue([])

    render(<NotificationSettings />)

    await screen.findByText('Rappel CRA mensuel')
    fireEvent.click(document.getElementById('NotificationSettings.row.1.toggle') as HTMLElement)

    expect(document.getElementById('NotificationSettings.form')).not.toBeInTheDocument()
  })

  it('désactive les autres filtres quand « tous les collaborateurs » est coché', async () => {
    listMock.mockResolvedValue([])
    collaboratorsMock.mockResolvedValue([
      { id: 2, fullName: 'Jean Dupont', position: null, email: 'j@test.fr', role: 'CONSULTANT', employee: true },
    ])

    render(<NotificationSettings />)
    fireEvent.click(document.getElementById('NotificationSettings.new') as HTMLElement)

    fireEvent.click(document.getElementById('NotificationSettings.recipients.all.input') as HTMLInputElement)

    expect((document.getElementById('NotificationSettings.recipients.all.input') as HTMLInputElement).checked).toBe(true)
    expect((document.getElementById('NotificationSettings.recipients.employee.input') as HTMLInputElement).disabled).toBe(true)
    expect((document.getElementById('NotificationSettings.recipients.nonEmployee.input') as HTMLInputElement).disabled).toBe(true)
    expect((document.getElementById('NotificationSettings.recipients.manager.input') as HTMLInputElement).disabled).toBe(true)
    expect((document.getElementById('NotificationSettings.recipients.consultant.input') as HTMLInputElement).disabled).toBe(true)
    expect((document.getElementById('NotificationSettings.recipients.input') as HTMLSelectElement).disabled).toBe(true)
  })

  it('enregistre l’audience « tous les collaborateurs »', async () => {
    listMock.mockResolvedValue([])
    collaboratorsMock.mockResolvedValue([])

    render(<NotificationSettings />)
    fireEvent.click(document.getElementById('NotificationSettings.new') as HTMLElement)
    fireEvent.change(document.getElementById('NotificationSettings.name.input') as HTMLInputElement, {
      target: { value: 'Diffusion' },
    })
    fireEvent.change(document.getElementById('NotificationSettings.subject.input') as HTMLInputElement, {
      target: { value: 'Sujet' },
    })
    fireEvent.change(document.getElementById('NotificationSettings.message.input') as HTMLTextAreaElement, {
      target: { value: 'Message' },
    })
    fireEvent.click(document.getElementById('NotificationSettings.recipients.all.input') as HTMLInputElement)
    fireEvent.submit(document.getElementById('NotificationSettings.form') as HTMLFormElement)

    await waitFor(() => expect(saveMock).toHaveBeenCalled())
    expect(saveMock).toHaveBeenCalledWith(expect.objectContaining({
      recipientAll: true,
      recipientEmployee: false,
      recipientNonEmployee: false,
      recipientManager: false,
      recipientConsultant: false,
    }))
  })

  it('affiche le rôle et le statut salarié de chaque collaborateur', async () => {
    listMock.mockResolvedValue([])
    collaboratorsMock.mockResolvedValue([
      { id: 2, fullName: 'Jean Dupont', position: null, email: null, role: 'CONSULTANT', employee: true },
      { id: 3, fullName: 'Karim Bensalem', position: null, email: null, role: 'MANAGER', employee: false },
    ])

    render(<NotificationSettings />)
    fireEvent.click(document.getElementById('NotificationSettings.new') as HTMLElement)

    await waitFor(() =>
      expect(document.getElementById('NotificationSettings.recipients.option.2')).not.toBeNull(),
    )
    expect(document.getElementById('NotificationSettings.recipients.option.2')?.textContent).toBe(
      'Jean Dupont (Consultant, NotificationSettings.recipients.salarie)',
    )
    expect(document.getElementById('NotificationSettings.recipients.option.3')?.textContent).toBe(
      'Karim Bensalem (Manager, NotificationSettings.recipients.nonSalarie)',
    )
  })

  it('ordonne les collaborateurs du rôle le plus élevé au plus bas', async () => {
    listMock.mockResolvedValue([])
    collaboratorsMock.mockResolvedValue([
      { id: 1, fullName: 'Alice Consultant', position: null, email: null, role: 'CONSULTANT', employee: true },
      { id: 2, fullName: 'Bob Manager', position: null, email: null, role: 'MANAGER', employee: false },
      { id: 3, fullName: 'Carla Responsable', position: null, email: null, role: 'RESPONSIBLE_SOC', employee: false },
    ])

    render(<NotificationSettings />)
    fireEvent.click(document.getElementById('NotificationSettings.new') as HTMLElement)

    await waitFor(() =>
      expect((document.getElementById('NotificationSettings.recipients.input') as HTMLSelectElement).options.length).toBe(3),
    )
    const options = Array.from(
      (document.getElementById('NotificationSettings.recipients.input') as HTMLSelectElement).options,
    )
    expect(options.map((option) => option.value)).toEqual(['3', '2', '1'])
  })
})
