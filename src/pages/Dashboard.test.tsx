import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Dashboard } from './Dashboard'
import type { DashboardOverview, UserDto } from '../api/types'

const { overviewMock, userMock } = vi.hoisted(() => ({
  overviewMock: vi.fn(),
  userMock: { value: null as unknown as UserDto },
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: userMock.value }),
}))

vi.mock('../soc/SocContext', () => ({
  useSoc: () => ({
    selectedSoc: { id: 5, name: 'SOC Test' },
    selectedSocId: 5,
  }),
}))

vi.mock('../api/dashboard', () => ({
  dashboardApi: { overview: overviewMock },
}))

const baseUser = {
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

const overview = {
  user: 'Jean Dupont',
  role: 'CONSULTANT',
  socId: 5,
  unreadMessages: 0,
  unreadNotifications: 0,
} as DashboardOverview

afterEach(() => {
  vi.clearAllMocks()
  userMock.value = null as unknown as UserDto
})

describe('Dashboard', () => {
  it('affiche les raccourcis consultant Mes Activités, CRA et Indisponibilités', async () => {
    userMock.value = baseUser
    overviewMock.mockResolvedValue(overview)

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole('link', { name: /Consulter les activités qui me sont affectées/ }),
    ).toHaveAttribute('href', '/mes-activites')
    expect(
      screen.getByRole('link', { name: /Saisir et soumettre mes feuilles de temps/ }),
    ).toHaveAttribute('href', '/cras')
    expect(
      screen.getByRole('link', { name: /Déclarer mes indisponibilités/ }),
    ).toHaveAttribute('href', '/indisponibilites')
    expect(screen.queryByRole('link', { name: /Gérer le portefeuille clients/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Suivre les missions en cours/ })).not.toBeInTheDocument()
  })
})
