import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NotificationSettings } from './NotificationSettings'
import type { NotificationConfigDto } from '../api/types'

const { listMock, collaboratorsMock, saveMock, socsMock, userMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  collaboratorsMock: vi.fn(),
  saveMock: vi.fn().mockResolvedValue({}),
  socsMock: vi.fn().mockResolvedValue([]),
  userMock: { value: { id: 1, role: 'RESPONSIBLE_SOC', socId: 5 } as Record<string, unknown> },
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: userMock.value }),
}))

vi.mock('../soc/SocContext', () => ({
  useSoc: () => ({ selectedSocId: 5 }),
}))

vi.mock('../api/socs', () => ({
  socsApi: { findAll: socsMock },
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
  recipientAudience: null,
  recipientIncludeNonEmployees: false,
  recipientIncludeSelf: false,
  recipientCompanyIds: [],
  recipientCompanyNames: [],
  recipientIds: [2],
  recipientNames: ['Jean Dupont'],
  nextRunAt: '2026-11-25T08:00:00',
  lastRunAt: null,
  createdAt: '2026-11-01T08:00:00Z',
  updatedAt: '2026-11-01T08:00:00Z',
}

const collaborators = [
  { id: 2, fullName: 'Jean Dupont', position: null, email: 'j@test.fr', role: 'CONSULTANT' as const, employee: true, socId: 5, socName: 'Soc Test' },
  { id: 3, fullName: 'Karim Bensalem', position: null, email: 'k@test.fr', role: 'MANAGER' as const, employee: false, socId: 5, socName: 'Soc Test' },
]

afterEach(() => {
  vi.clearAllMocks()
  socsMock.mockResolvedValue([])
  userMock.value = { id: 1, role: 'RESPONSIBLE_SOC', socId: 5 }
})

function openCreate() {
  fireEvent.click(document.getElementById('NotificationSettings.new') as HTMLElement)
}

function fillRequired() {
  fireEvent.change(document.getElementById('NotificationSettings.name.input') as HTMLInputElement, {
    target: { value: 'Diffusion' },
  })
  fireEvent.change(document.getElementById('NotificationSettings.subject.input') as HTMLInputElement, {
    target: { value: 'Sujet' },
  })
  fireEvent.change(document.getElementById('NotificationSettings.message.input') as HTMLTextAreaElement, {
    target: { value: 'Message' },
  })
}

describe('NotificationSettings', () => {
  it('affiche les configurations de la société', async () => {
    listMock.mockResolvedValue([config])
    collaboratorsMock.mockResolvedValue(collaborators)

    render(<NotificationSettings />)

    expect(await screen.findByText('Rappel CRA mensuel')).toBeInTheDocument()
    expect(screen.getByText('Jean Dupont')).toBeInTheDocument()
    expect(document.getElementById('NotificationSettings.row.1.status')).toBeInTheDocument()
  })

  it('ouvre le formulaire de création', async () => {
    listMock.mockResolvedValue([])
    collaboratorsMock.mockResolvedValue([])

    render(<NotificationSettings />)
    openCreate()

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

  it('choisit un cadre et désactive l’autre', async () => {
    listMock.mockResolvedValue([])
    collaboratorsMock.mockResolvedValue(collaborators)

    render(<NotificationSettings />)
    openCreate()
    await waitFor(() =>
      expect(document.getElementById('NotificationSettings.recipients.option.2.input')).not.toBeNull(),
    )

    expect((document.getElementById('NotificationSettings.recipients.modeAudience.input') as HTMLInputElement).checked).toBe(true)
    expect((document.getElementById('NotificationSettings.recipients.option.2.input') as HTMLInputElement).disabled).toBe(true)

    fireEvent.click(document.getElementById('NotificationSettings.recipients.modeSpecific.input') as HTMLInputElement)

    expect((document.getElementById('NotificationSettings.recipients.modeSpecific.input') as HTMLInputElement).checked).toBe(true)
    expect((document.getElementById('NotificationSettings.recipients.option.2.input') as HTMLInputElement).disabled).toBe(false)
    expect((document.getElementById('NotificationSettings.recipients.audienceAll.input') as HTMLInputElement).disabled).toBe(true)
  })

  it('enregistre l’audience « tous les collaborateurs »', async () => {
    listMock.mockResolvedValue([])
    collaboratorsMock.mockResolvedValue([])

    render(<NotificationSettings />)
    openCreate()
    fillRequired()
    fireEvent.click(document.getElementById('NotificationSettings.recipients.audienceAll.input') as HTMLInputElement)
    fireEvent.submit(document.getElementById('NotificationSettings.form') as HTMLFormElement)

    await waitFor(() => expect(saveMock).toHaveBeenCalled())
    expect(saveMock).toHaveBeenCalledWith(expect.objectContaining({
      recipientAudience: 'ALL',
      recipientIds: [],
      recipientIncludeNonEmployees: false,
      recipientIncludeSelf: false,
    }))
  })

  it('sélectionne puis désélectionne tout et enregistre la sélection manuelle', async () => {
    listMock.mockResolvedValue([])
    collaboratorsMock.mockResolvedValue(collaborators)

    render(<NotificationSettings />)
    openCreate()
    fireEvent.click(document.getElementById('NotificationSettings.recipients.modeSpecific.input') as HTMLInputElement)
    await waitFor(() =>
      expect(document.getElementById('NotificationSettings.recipients.option.2')).not.toBeNull(),
    )
    // Par défaut les non-salariés sont masqués : on les inclut pour tester la sélection complète.
    fireEvent.click(document.getElementById('NotificationSettings.recipients.includeNonEmployeesSpecific.input') as HTMLInputElement)
    await waitFor(() =>
      expect(document.getElementById('NotificationSettings.recipients.option.3')).not.toBeNull(),
    )

    fireEvent.click(document.getElementById('NotificationSettings.recipients.toggleAll') as HTMLElement)
    await waitFor(() => {
      expect((document.getElementById('NotificationSettings.recipients.option.2.input') as HTMLInputElement).checked).toBe(true)
      expect((document.getElementById('NotificationSettings.recipients.option.3.input') as HTMLInputElement).checked).toBe(true)
    })
    expect(document.getElementById('NotificationSettings.recipients.toggleAll')?.textContent).toBe(
      'NotificationSettings.recipients.deselectAll',
    )

    fireEvent.click(document.getElementById('NotificationSettings.recipients.toggleAll') as HTMLElement)
    await waitFor(() => {
      expect((document.getElementById('NotificationSettings.recipients.option.2.input') as HTMLInputElement).checked).toBe(false)
      expect((document.getElementById('NotificationSettings.recipients.option.3.input') as HTMLInputElement).checked).toBe(false)
    })

    fireEvent.click(document.getElementById('NotificationSettings.recipients.toggleAll') as HTMLElement)
    await waitFor(() =>
      expect((document.getElementById('NotificationSettings.recipients.option.2.input') as HTMLInputElement).checked).toBe(true),
    )
    fillRequired()
    fireEvent.submit(document.getElementById('NotificationSettings.form') as HTMLFormElement)

    await waitFor(() => expect(saveMock).toHaveBeenCalled())
    const payload = saveMock.mock.calls[0][0] as { recipientAudience: unknown; recipientIds: number[] }
    expect(payload.recipientAudience).toBeNull()
    expect(payload.recipientIds).toHaveLength(2)
    expect(payload.recipientIds).toEqual(expect.arrayContaining([2, 3]))
  })

  it('affiche le rôle et le statut salarié de chaque collaborateur', async () => {
    listMock.mockResolvedValue([])
    collaboratorsMock.mockResolvedValue([
      { id: 2, fullName: 'Jean Dupont', position: null, email: null, role: 'CONSULTANT', employee: true },
      { id: 3, fullName: 'Karim Bensalem', position: null, email: null, role: 'MANAGER', employee: false },
    ])

    render(<NotificationSettings />)
    openCreate()
    fireEvent.click(document.getElementById('NotificationSettings.recipients.modeSpecific.input') as HTMLInputElement)
    fireEvent.click(document.getElementById('NotificationSettings.recipients.includeNonEmployeesSpecific.input') as HTMLInputElement)

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
    openCreate()
    fireEvent.click(document.getElementById('NotificationSettings.recipients.modeSpecific.input') as HTMLInputElement)
    fireEvent.click(document.getElementById('NotificationSettings.recipients.includeNonEmployeesSpecific.input') as HTMLInputElement)

    await waitFor(() =>
      expect(document.getElementById('NotificationSettings.recipients.option.1')).not.toBeNull(),
    )
    const container = document.getElementById('NotificationSettings.recipients.input') as HTMLElement
    const labels = Array.from(container.querySelectorAll('label'))
    expect(labels.map((label) => label.id.split('.').pop())).toEqual(['3', '2', '1'])
  })

  it('admin : cadres Sociétés/Responsables et sélection de sociétés destinataires', async () => {
    userMock.value = { id: 1, role: 'ADMIN', socId: 10 }
    listMock.mockResolvedValue([])
    collaboratorsMock.mockResolvedValue([])
    socsMock.mockResolvedValue([
      { id: 20, name: 'Société A' },
      { id: 30, name: 'Société B' },
    ])

    render(<NotificationSettings />)
    await waitFor(() => expect(document.getElementById('NotificationSettings.new')).not.toBeNull())
    openCreate()

    expect(document.getElementById('NotificationSettings.recipients.audienceCompanies.input')).not.toBeNull()
    expect(document.getElementById('NotificationSettings.recipients.audienceResponsibles.input')).not.toBeNull()
    expect(document.getElementById('NotificationSettings.recipients.modeCompanies.input')).not.toBeNull()

    fireEvent.click(document.getElementById('NotificationSettings.recipients.modeCompanies.input') as HTMLInputElement)
    await waitFor(() =>
      expect(document.getElementById('NotificationSettings.recipients.company.20.input')).not.toBeNull(),
    )
    fireEvent.click(document.getElementById('NotificationSettings.recipients.toggleAllCompanies') as HTMLElement)
    await waitFor(() =>
      expect((document.getElementById('NotificationSettings.recipients.company.20.input') as HTMLInputElement).checked).toBe(true),
    )

    fillRequired()
    fireEvent.submit(document.getElementById('NotificationSettings.form') as HTMLFormElement)

    await waitFor(() => expect(saveMock).toHaveBeenCalled())
    const payload = saveMock.mock.calls[0][0] as { recipientAudience: unknown; recipientCompanyIds: number[] }
    expect(payload.recipientAudience).toBeNull()
    expect(payload.recipientCompanyIds).toEqual(expect.arrayContaining([20, 30]))
  })

  it('la liste des collaborateurs est défilante pour un grand nombre d’utilisateurs', async () => {
    const many = Array.from({ length: 30 }, (_, index) => ({
      id: index + 1,
      fullName: `Utilisateur ${index + 1}`,
      position: null,
      email: null,
      role: 'CONSULTANT' as const,
      employee: true,
      socId: 5,
      socName: 'Soc Test',
    }))
    listMock.mockResolvedValue([])
    collaboratorsMock.mockResolvedValue(many)

    render(<NotificationSettings />)
    openCreate()
    fireEvent.click(document.getElementById('NotificationSettings.recipients.modeSpecific.input') as HTMLInputElement)

    await waitFor(() =>
      expect(document.getElementById('NotificationSettings.recipients.option.30')).not.toBeNull(),
    )
    const container = document.getElementById('NotificationSettings.recipients.input') as HTMLElement
    expect(container.className).toContain('overflow-y-auto')
    expect(container.className).toContain('max-h-72')
  })

  it('manager sans manager dans son équipe : pas de radio Managers', async () => {
    userMock.value = { id: 1, role: 'MANAGER', socId: 5 }
    listMock.mockResolvedValue([])
    collaboratorsMock.mockResolvedValue([
      { id: 1, fullName: 'Moi Manager', position: null, email: null, role: 'MANAGER', employee: true, socId: 5, socName: 'Soc Test' },
      { id: 2, fullName: 'Consultant', position: null, email: null, role: 'CONSULTANT', employee: true, socId: 5, socName: 'Soc Test' },
    ])

    render(<NotificationSettings />)
    openCreate()
    await waitFor(() =>
      expect(document.getElementById('NotificationSettings.recipients.option.2')).not.toBeNull(),
    )

    expect(document.getElementById('NotificationSettings.recipients.audienceManagers.input')).toBeNull()
    expect(document.getElementById('NotificationSettings.recipients.audienceConsultants.input')).not.toBeNull()
  })

  it('manager avec un autre manager dans son équipe : radio Managers affichée', async () => {
    userMock.value = { id: 1, role: 'MANAGER', socId: 5 }
    listMock.mockResolvedValue([])
    collaboratorsMock.mockResolvedValue([
      { id: 1, fullName: 'Moi Manager', position: null, email: null, role: 'MANAGER', employee: true, socId: 5, socName: 'Soc Test' },
      { id: 2, fullName: 'Autre Manager', position: null, email: null, role: 'MANAGER', employee: true, socId: 5, socName: 'Soc Test' },
    ])

    render(<NotificationSettings />)
    openCreate()
    await waitFor(() =>
      expect(document.getElementById('NotificationSettings.recipients.option.2')).not.toBeNull(),
    )

    expect(document.getElementById('NotificationSettings.recipients.audienceManagers.input')).not.toBeNull()
  })

  it('la popup de configuration est défilante (vertical/horizontal)', async () => {
    listMock.mockResolvedValue([])
    collaboratorsMock.mockResolvedValue([])

    render(<NotificationSettings />)
    openCreate()

    const body = document.getElementById('NotificationSettings.form')?.parentElement as HTMLElement
    expect(body).not.toBeNull()
    expect(body.className).toContain('overflow-auto')
    expect(body.className).toContain('max-h-')
  })

  it('sélection manuelle : non-salariés masqués par défaut, inclus via la case à cocher', async () => {
    listMock.mockResolvedValue([])
    collaboratorsMock.mockResolvedValue(collaborators)

    render(<NotificationSettings />)
    openCreate()
    fireEvent.click(document.getElementById('NotificationSettings.recipients.modeSpecific.input') as HTMLInputElement)

    await waitFor(() =>
      expect(document.getElementById('NotificationSettings.recipients.option.2')).not.toBeNull(),
    )
    const include = () => document.getElementById(
      'NotificationSettings.recipients.includeNonEmployeesSpecific.input',
    ) as HTMLInputElement
    expect(include().checked).toBe(false)
    expect(document.getElementById('NotificationSettings.recipients.option.3')).toBeNull()

    fireEvent.click(include())
    await waitFor(() => expect(include().checked).toBe(true))
    await waitFor(() =>
      expect(document.getElementById('NotificationSettings.recipients.option.3')).not.toBeNull(),
    )

    fireEvent.click(document.getElementById('NotificationSettings.recipients.option.3.input') as HTMLInputElement)
    await waitFor(() =>
      expect((document.getElementById('NotificationSettings.recipients.option.3.input') as HTMLInputElement).checked).toBe(true),
    )

    fireEvent.click(include())
    await waitFor(() => expect(include().checked).toBe(false))
    await waitFor(() =>
      expect(document.getElementById('NotificationSettings.recipients.option.3')).toBeNull(),
    )
    fireEvent.click(include())
    await waitFor(() =>
      expect(document.getElementById('NotificationSettings.recipients.option.3')).not.toBeNull(),
    )
    expect((document.getElementById('NotificationSettings.recipients.option.3.input') as HTMLInputElement).checked).toBe(false)
  })

  it('affiche le nombre de collaborateurs sélectionnés sur le total', async () => {
    listMock.mockResolvedValue([])
    collaboratorsMock.mockResolvedValue(collaborators)

    render(<NotificationSettings />)
    openCreate()
    fireEvent.click(document.getElementById('NotificationSettings.recipients.modeSpecific.input') as HTMLInputElement)

    await waitFor(() =>
      expect(document.getElementById('NotificationSettings.recipients.option.2')).not.toBeNull(),
    )
    const count = () => document.getElementById('NotificationSettings.recipients.count') as HTMLSpanElement
    expect(count().textContent).toBe('0 / 2')
    expect(count().className).toContain('ml-5')

    fireEvent.click(document.getElementById('NotificationSettings.recipients.option.2.input') as HTMLInputElement)

    await waitFor(() => expect(count().textContent).toBe('1 / 2'))
  })

  it('calcule aussi le compteur en mode « Par catégorie »', async () => {
    listMock.mockResolvedValue([])
    collaboratorsMock.mockResolvedValue(collaborators)

    render(<NotificationSettings />)
    openCreate()

    const count = () => document.getElementById('NotificationSettings.recipients.count') as HTMLSpanElement
    await waitFor(() =>
      expect(document.getElementById('NotificationSettings.recipients.audienceConsultants.input')).not.toBeNull(),
    )
    expect(count().textContent).toBe('0 / 2')

    fireEvent.click(document.getElementById('NotificationSettings.recipients.audienceConsultants.input') as HTMLInputElement)
    await waitFor(() => expect(count().textContent).toBe('1 / 2'))

    fireEvent.click(document.getElementById('NotificationSettings.recipients.audienceAll.input') as HTMLInputElement)
    await waitFor(() => expect(count().textContent).toBe('1 / 2'))

    fireEvent.click(document.getElementById('NotificationSettings.recipients.includeNonEmployees.input') as HTMLInputElement)
    await waitFor(() => expect(count().textContent).toBe('2 / 2'))
  })
})
