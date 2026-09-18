import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MyActivities } from './MyActivities'
import type { UserDto } from '../api/types'

const { findAllMock, userMock } = vi.hoisted(() => ({
  findAllMock: vi.fn(),
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

vi.mock('../api/activities', () => ({
  activitiesApi: { findAll: findAllMock },
}))

const consultantUser = {
  id: 2,
  username: 'consultant',
  email: 'consultant@soc.fr',
  firstName: 'Jean',
  lastName: 'Dupont',
  phone: null,
  role: 'CONSULTANT',
  active: true,
  socId: 5,
  socName: 'SOC Test',
  consultantId: 2,
  mustChangePassword: false,
  lastLoginAt: null,
} as UserDto

afterEach(() => {
  vi.clearAllMocks()
  userMock.value = null as unknown as UserDto
})

describe('MyActivities', () => {
  it('affiche uniquement les activités affectées au consultant', async () => {
    userMock.value = consultantUser
    findAllMock.mockResolvedValue([
      {
        id: 1,
        name: 'Mission A',
        description: null,
        price: 100,
        currency: 'EUR',
        startDate: null,
        endDate: null,
        type: { id: 1, code: 'DEV', labelFr: 'Développement', color: null },
        project: { id: 1, name: 'Projet A', clientName: 'Client A' },
        consultant: { id: 2, firstName: 'Jean', lastName: 'Dupont' },
        soc: { id: 5, name: 'SOC Test' },
        active: true,
        indispo: false,
        weekendAllowed: true,
        holidayAllowed: false,
      },
      {
        id: 2,
        name: 'Partagée',
        description: null,
        price: 0,
        currency: 'EUR',
        startDate: null,
        endDate: null,
        type: null,
        project: null,
        consultant: null,
        soc: { id: 5, name: 'SOC Test' },
        active: true,
        indispo: false,
        weekendAllowed: false,
        holidayAllowed: false,
      },
      {
        id: 3,
        name: 'Autre consultant',
        description: null,
        price: 0,
        currency: 'EUR',
        startDate: null,
        endDate: null,
        type: null,
        project: null,
        consultant: { id: 99, firstName: 'Autre', lastName: 'Consultant' },
        soc: { id: 5, name: 'SOC Test' },
        active: true,
        indispo: false,
        weekendAllowed: false,
        holidayAllowed: false,
      },
    ])

    render(
      <MemoryRouter>
        <MyActivities />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Mission A')).toBeInTheDocument()
    expect(screen.getByText('Week-end : Oui')).toBeInTheDocument()
    expect(screen.getByText('Jours fériés : Non')).toBeInTheDocument()
    expect(screen.queryByText('Partagée')).not.toBeInTheDocument()
    expect(screen.queryByText('Autre consultant')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Modifier' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Supprimer' })).not.toBeInTheDocument()
    expect(findAllMock).toHaveBeenCalledWith({ socId: 5, consultantId: 2 })
  })
})
