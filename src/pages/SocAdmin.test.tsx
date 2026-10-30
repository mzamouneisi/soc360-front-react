import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SocAdmin } from './SocAdmin'
import type { SocDto, UserDto } from '../api/types'

const { findAllMock, userMock, socsMock } = vi.hoisted(() => ({
  findAllMock: vi.fn(),
  userMock: { value: null as unknown as UserDto },
  socsMock: { value: [] as { id: number; name: string }[] },
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: userMock.value }),
}))

vi.mock('../soc/SocContext', () => ({
  useSoc: () => ({ socs: socsMock.value }),
}))

vi.mock('../soc/AddSocModal', () => ({
  AddSocModal: () => null,
}))

vi.mock('../api/socs', () => ({
  socsApi: {
    findAll: findAllMock,
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
  socId: null,
  socName: null,
  consultantId: null,
  mustChangePassword: false,
  lastLoginAt: null,
  pageSize: 5,
} as UserDto

const soc = (overrides: Partial<SocDto> = {}): SocDto => ({
  id: 1,
  name: 'Acme',
  description: null,
  siret: '123',
  gerant: 'Alice',
  address: { street: null, zipCode: null, city: 'Paris', country: null },
  ...overrides,
})

afterEach(() => {
  vi.clearAllMocks()
  userMock.value = null as unknown as UserDto
  socsMock.value = []
})

describe('SocAdmin', () => {
  it('ouvre le formulaire de la société dans une popup au clic sur la ligne', async () => {
    userMock.value = adminUser
    findAllMock.mockResolvedValue([soc()])

    render(
      <MemoryRouter>
        <SocAdmin />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Acme')).toBeInTheDocument()
    fireEvent.click(document.getElementById('table.row.1') as HTMLElement)

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Modifier Acme')).toBeInTheDocument()
  })
})
