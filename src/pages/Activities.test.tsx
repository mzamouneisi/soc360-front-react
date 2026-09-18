import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Activities } from './Activities'
import type { UserDto } from '../api/types'

const {
  findAllMock,
  managedMock,
  summariesMock,
  typesFindAllMock,
  projectsFindAllMock,
  socsFindAllMock,
  userMock,
} = vi.hoisted(() => ({
  findAllMock: vi.fn(),
  managedMock: vi.fn(),
  summariesMock: vi.fn(),
  typesFindAllMock: vi.fn(),
  projectsFindAllMock: vi.fn(),
  socsFindAllMock: vi.fn(),
  userMock: { value: null as unknown as UserDto },
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: userMock.value,
    initializing: false,
    login: vi.fn(),
    logout: vi.fn(),
    setUser: vi.fn(),
    refreshMe: vi.fn(),
  }),
}))

vi.mock('../soc/SocContext', () => ({
  useSoc: () => ({ selectedSocId: 5, selectedSoc: null, socs: [], setSelectedSocId: vi.fn() }),
}))

vi.mock('../api/activities', () => ({
  activitiesApi: {
    findAll: findAllMock,
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  activityTypesApi: { findAll: typesFindAllMock },
}))

vi.mock('../api/projects', () => ({
  projectsApi: { findAll: projectsFindAllMock },
}))

vi.mock('../api/consultants', () => ({
  consultantsApi: { managed: managedMock, summaries: summariesMock },
}))

vi.mock('../api/socs', () => ({
  socsApi: { findAll: socsFindAllMock },
}))

const baseUser = {
  id: 1,
  username: 'user',
  email: 'user@soc.fr',
  firstName: 'U',
  lastName: 'User',
  phone: null,
  active: true,
  socId: 5,
  socName: 'SOC Test',
  consultantId: null,
  mustChangePassword: false,
  lastLoginAt: null,
}

afterEach(() => {
  vi.clearAllMocks()
  userMock.value = null as unknown as UserDto
})

async function openCreateModal() {
  const buttons = await screen.findAllByRole('button', { name: '+ Nouvelle activité' })
  fireEvent.click(buttons[0])
}

describe('Activities — ajout selon le rôle', () => {
  it('un manager ne peut choisir que ses propres consultants (pas d’option Aucun)', async () => {
    userMock.value = { ...baseUser, role: 'MANAGER' } as UserDto
    findAllMock.mockResolvedValue([])
    managedMock.mockResolvedValue([{ id: 50, fullName: 'Alice Martin', position: null, email: null }])
    summariesMock.mockResolvedValue([])
    typesFindAllMock.mockResolvedValue([])
    projectsFindAllMock.mockResolvedValue([])
    socsFindAllMock.mockResolvedValue([])

    render(
      <MemoryRouter>
        <Activities />
      </MemoryRouter>,
    )

    await openCreateModal()

    expect(await screen.findByRole('option', { name: 'Alice Martin' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Aucun' })).not.toBeInTheDocument()
    expect(managedMock).toHaveBeenCalled()
    expect(summariesMock).not.toHaveBeenCalled()
  })

  it('un responsable_soc doit aussi choisir un consultant (pas d’option Aucun)', async () => {
    userMock.value = { ...baseUser, role: 'RESPONSIBLE_SOC' } as UserDto
    findAllMock.mockResolvedValue([])
    managedMock.mockResolvedValue([])
    summariesMock.mockResolvedValue([{ id: 60, fullName: 'Bob Durand', position: null, email: null }])
    typesFindAllMock.mockResolvedValue([])
    projectsFindAllMock.mockResolvedValue([])
    socsFindAllMock.mockResolvedValue([])

    render(
      <MemoryRouter>
        <Activities />
      </MemoryRouter>,
    )

    await openCreateModal()

    expect(await screen.findByRole('option', { name: 'Bob Durand' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Aucun' })).not.toBeInTheDocument()
    expect(summariesMock).toHaveBeenCalledWith(5)
    expect(managedMock).not.toHaveBeenCalled()
  })

  it('un admin peut choisir Aucun (activité partagée)', async () => {
    userMock.value = { ...baseUser, role: 'ADMIN' } as UserDto
    findAllMock.mockResolvedValue([])
    managedMock.mockResolvedValue([])
    summariesMock.mockResolvedValue([])
    typesFindAllMock.mockResolvedValue([])
    projectsFindAllMock.mockResolvedValue([])
    socsFindAllMock.mockResolvedValue([])

    render(
      <MemoryRouter>
        <Activities />
      </MemoryRouter>,
    )

    await openCreateModal()

    expect(screen.getByRole('option', { name: 'Aucun' })).toBeInTheDocument()
    expect(summariesMock).not.toHaveBeenCalled()
    expect(managedMock).not.toHaveBeenCalled()
  })
})
