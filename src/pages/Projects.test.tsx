import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Projects } from './Projects'
import type { ProjectDto, UserDto } from '../api/types'

const {
  findAllMock,
  dependenciesMock,
  deleteMock,
  deactivateMock,
  clientsMock,
  socsMock,
  confirmMock,
  userMock,
} = vi.hoisted(() => ({
  findAllMock: vi.fn(),
  dependenciesMock: vi.fn(),
  deleteMock: vi.fn(),
  deactivateMock: vi.fn(),
  clientsMock: vi.fn(),
  socsMock: vi.fn(),
  confirmMock: vi.fn(),
  userMock: { value: null as unknown as UserDto },
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: userMock.value }),
}))

vi.mock('../api/projects', () => ({
  projectsApi: {
    findAll: findAllMock,
    dependencies: dependenciesMock,
    delete: deleteMock,
    deactivate: deactivateMock,
    create: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('../api/clients', () => ({
  clientsApi: { findAll: clientsMock },
}))

vi.mock('../api/socs', () => ({
  socsApi: { findAll: socsMock },
}))

vi.mock('../components/dialog', () => ({
  dialog: {
    confirm: confirmMock,
    error: vi.fn(),
    alert: vi.fn(),
  },
}))

const adminUser = {
  id: 1,
  username: 'admin',
  email: 'admin@soc.fr',
  firstName: 'Ad',
  lastName: 'Min',
  phone: null,
  role: 'ADMIN',
  active: true,
  socId: 5,
  socName: 'SOC Test',
  consultantId: null,
  mustChangePassword: false,
  lastLoginAt: null,
  pageSize: 5,
} as UserDto

const project = (overrides: Partial<ProjectDto> = {}): ProjectDto => ({
  id: 1,
  name: 'Projet Alpha',
  description: null,
  client: { id: 5, name: 'Client 5' },
  soc: { id: 10, name: 'Soc 10' },
  startDate: null,
  endDate: null,
  dailyRate: 500,
  currency: 'EUR',
  active: true,
  ...overrides,
})

afterEach(() => {
  vi.clearAllMocks()
  userMock.value = null as unknown as UserDto
})

function renderPage() {
  return render(
    <MemoryRouter>
      <Projects />
    </MemoryRouter>,
  )
}

describe('Projects', () => {
  it('supprime un projet sans objet associé après confirmation', async () => {
    userMock.value = adminUser
    findAllMock.mockResolvedValue([project()])
    clientsMock.mockResolvedValue([])
    socsMock.mockResolvedValue([])
    dependenciesMock.mockResolvedValue([])
    deleteMock.mockResolvedValue(undefined)
    confirmMock.mockResolvedValue(true)

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer' }))

    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith(1))

    const options = confirmMock.mock.calls[0][1] as { messageNode?: React.ReactNode }
    expect(options.messageNode).toBeTruthy()
    const content = render(<>{options.messageNode}</>)
    const root = content.container.firstChild as HTMLElement
    expect(root.style.fontSize).toBe('14px')
    const strong = content.container.querySelector('strong')
    expect(strong?.textContent).toBe('Projet Alpha')
    expect(strong?.className).toContain('uppercase')
  })

  it('propose de désactiver un projet associé à une mission', async () => {
    userMock.value = adminUser
    findAllMock.mockResolvedValue([project()])
    clientsMock.mockResolvedValue([])
    socsMock.mockResolvedValue([])
    dependenciesMock.mockResolvedValue([{ type: 'MISSION', label: 'Mission Alpha' }])
    deactivateMock.mockResolvedValue(project({ active: false }))
    confirmMock.mockResolvedValue(true)

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer' }))

    await waitFor(() => expect(deactivateMock).toHaveBeenCalledWith(1))
    expect(deleteMock).not.toHaveBeenCalled()
    expect(confirmMock.mock.calls.some((call) => String(call[0]).includes('Mission Alpha'))).toBe(
      true,
    )

    const options = confirmMock.mock.calls[0][1] as { messageNode?: React.ReactNode }
    expect(options.messageNode).toBeTruthy()
    const content = render(<>{options.messageNode}</>)
    const root = content.container.firstChild as HTMLElement
    expect(root.style.fontSize).toBe('14px')
    const strongs = content.container.querySelectorAll('strong')
    expect(strongs[0].textContent).toBe('Projet Alpha')
    expect(strongs[0].className).toContain('uppercase')
    expect(content.container.querySelector('ol')).not.toBeNull()
    expect(content.container.querySelector('li strong')?.textContent).toBe('Mission Alpha')
  })
})
