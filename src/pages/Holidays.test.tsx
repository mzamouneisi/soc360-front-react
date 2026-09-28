import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Holidays } from './Holidays'
import type { UserDto } from '../api/types'

const { listMock, publicMock, userMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  publicMock: vi.fn(),
  userMock: { value: null as unknown as UserDto },
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: userMock.value }),
}))

vi.mock('../api/socHolidays', () => ({
  socHolidaysApi: { list: listMock, create: vi.fn(), delete: vi.fn(), duplicate: vi.fn() },
}))

vi.mock('../api/holidays', () => ({
  holidaysApi: { findByCountryYear: publicMock, countries: vi.fn() },
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

const now = new Date()
const year = now.getFullYear()
const mm = String(now.getMonth() + 1).padStart(2, '0')
const nationalDate = `${year}-${mm}-01`
const socDate = `${year}-${mm}-02`

afterEach(() => {
  vi.clearAllMocks()
  userMock.value = null as unknown as UserDto
})

describe('Holidays', () => {
  it('affiche les jours fériés nationaux en jaune pour un consultant, sans le sous-titre société', async () => {
    userMock.value = baseUser
    listMock.mockResolvedValue([{ id: 1, socId: 5, date: socDate, label: 'Jour société' }])
    publicMock.mockResolvedValue([
      { id: 9, country: 'FR', date: nationalDate, label: "Jour de l'an" },
    ])

    render(
      <MemoryRouter>
        <Holidays />
      </MemoryRouter>,
    )

    const nationalLabel = await screen.findByText("Jour de l'an")
    expect(nationalLabel.closest('button')).toHaveClass('bg-yellow-50')
    expect(screen.getByText('Jour société')).toBeInTheDocument()
    expect(
      screen.queryByText('Définissez les jours fériés spécifiques de la société'),
    ).not.toBeInTheDocument()
    expect(publicMock).toHaveBeenCalledWith('FR', year)
  })

  it('affiche le sous-titre société pour un manager', async () => {
    userMock.value = { ...baseUser, role: 'MANAGER' } as UserDto
    listMock.mockResolvedValue([])
    publicMock.mockResolvedValue([])

    render(
      <MemoryRouter>
        <Holidays />
      </MemoryRouter>,
    )

    expect(
      await screen.findByText('Définissez les jours fériés spécifiques de la société'),
    ).toBeInTheDocument()
  })

  it("recharge les jours fériés nationaux lorsqu'on change d'année", async () => {
    userMock.value = baseUser
    listMock.mockResolvedValue([])
    publicMock.mockResolvedValue([])

    render(
      <MemoryRouter>
        <Holidays />
      </MemoryRouter>,
    )

    await waitFor(() => expect(publicMock).toHaveBeenCalledWith('FR', year))

    const next = screen.getByRole('button', { name: 'Suiv' })
    for (let i = 0; i < 12; i++) fireEvent.click(next)

    await waitFor(() => expect(publicMock).toHaveBeenCalledWith('FR', year + 1))
  })
})
