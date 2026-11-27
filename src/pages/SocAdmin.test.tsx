import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  vi.unstubAllGlobals()
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

  it('affiche les flags du site web et de l’adresse', async () => {
    userMock.value = adminUser
    findAllMock.mockResolvedValue([soc({
      website: 'https://acme.com',
      address: { street: 'Rue de Paris', zipCode: '75001', city: 'Paris', country: 'France' },
    })])
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        features: [{
          properties: { city: 'Paris', postcode: '75001', street: 'Rue de Paris', name: 'Rue de Paris' },
        }],
      }),
    })))

    render(
      <MemoryRouter>
        <SocAdmin />
      </MemoryRouter>,
    )

    await screen.findByText('Acme')
    fireEvent.click(document.getElementById('table.row.1') as HTMLElement)
    await screen.findByRole('dialog')

    expect(document.getElementById('SocAdmin.adresse.card')).not.toBeNull()
    expect(document.getElementById('SocAdmin.site.web.valid')).not.toBeNull()
    expect(document.getElementById('SocAdmin.pays.valid')).not.toBeNull()
    expect(document.getElementById('SocAdmin.code.postal.valid')).not.toBeNull()
    await waitFor(() => expect(document.getElementById('SocAdmin.ville.valid')).not.toBeNull())
    expect(document.getElementById('SocAdmin.rue.valid')).not.toBeNull()

    fireEvent.change(document.getElementById('SocAdmin.site.web.input') as HTMLInputElement, {
      target: { value: 'abc' },
    })
    await waitFor(() => expect(document.getElementById('SocAdmin.site.web.invalid')).not.toBeNull())
  })

  it("ne propose pas la gestion du logo à l'administrateur", async () => {
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

    expect(document.getElementById('SocLogo.fieldset')).toBeNull()
  })

  it('propose la gestion du logo au responsable de la société', async () => {
    userMock.value = { ...adminUser, role: 'RESPONSIBLE_SOC', socId: 1 }
    socsMock.value = [{ id: 1, name: 'Acme' }]
    findAllMock.mockResolvedValue([soc()])

    render(
      <MemoryRouter>
        <SocAdmin />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Acme')).toBeInTheDocument()
    fireEvent.click(document.getElementById('table.row.1') as HTMLElement)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    expect(document.getElementById('SocLogo.fieldset')).not.toBeNull()
  })
})
