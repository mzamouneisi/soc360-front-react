import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Prospects } from './Prospects'
import type { ProspectDto } from '../api/types'

const { findAllMock, createMock, userMock, selectedSocMock } = vi.hoisted(() => {
  const initialUser: { id: number; role: string; socId: number | null; pageSize: number } = {
    id: 1,
    role: 'MANAGER',
    socId: 5,
    pageSize: 3,
  }
  return {
    findAllMock: vi.fn(),
    createMock: vi.fn().mockResolvedValue({}),
    userMock: { value: initialUser },
    selectedSocMock: { value: { id: 5, name: 'SOC', country: 'FRANCE' } },
  }
})

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: userMock.value }),
}))

vi.mock('../soc/SocContext', () => ({
  useSoc: () => ({ selectedSocId: 5, selectedSoc: selectedSocMock.value }),
}))

vi.mock('../api/prospects', () => ({
  prospectsApi: {
    findAll: findAllMock,
    create: createMock,
    update: vi.fn(),
    delete: vi.fn(),
    addNote: vi.fn(),
    deleteNote: vi.fn(),
    convert: vi.fn(),
  },
}))

const prospect: ProspectDto = {
  id: 1,
  name: 'Société Prospective',
  kind: 'COMPANY',
  contactName: 'Jean Contact',
  contactEmail: 'jean@prospect.fr',
  contactPhone: '0102030405',
  address: '1 rue de Paris',
  street: '1 rue de Paris',
  postalCode: '75001',
  city: 'Paris',
  country: 'France',
  soc: { id: 5, name: 'SOC' },
  socParent: { id: 5, name: 'SOC' },
  status: 'ACTIVE',
  convertedTo: null,
  convertedAt: null,
  clientId: null,
  supplierId: null,
  lastNoteDate: '2026-11-05',
  notes: [],
}

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  userMock.value = { id: 1, role: 'MANAGER', socId: 5, pageSize: 3 }
  selectedSocMock.value = { id: 5, name: 'SOC', country: 'FRANCE' }
})

describe('Prospects', () => {
  it('affiche les prospects et leur statut', async () => {
    findAllMock.mockResolvedValue([prospect])

    render(<Prospects />)

    expect(await screen.findByText('Société Prospective')).toBeInTheDocument()
    expect(screen.getByText('05/11/2026')).toBeInTheDocument()
    expect(document.getElementById('Prospects.row.1.status')).toBeInTheDocument()
    expect(document.getElementById('Prospects.row.1.convert.client')).toBeInTheDocument()
  })

  it('pagine la liste des notes du prospect', async () => {
    const notes = Array.from({ length: 7 }, (_, index) => ({
      id: index + 1,
      noteDate: `2026-11-0${7 - index}`,
      content: `Note ${index + 1}`,
      color: null,
      eventType: null,
      author: null,
      createdAt: '2026-11-01T08:00:00Z',
    }))
    findAllMock.mockResolvedValue([{ ...prospect, notes, lastNoteDate: '2026-11-07' }])

    render(<Prospects />)

    await screen.findByText('Société Prospective')
    fireEvent.click(document.getElementById('Prospects.row.1.notes') as HTMLElement)

    expect(await screen.findByText('Note 1')).toBeInTheDocument()
    expect(screen.queryByText('Note 4')).not.toBeInTheDocument()
    expect(document.getElementById('Prospects.notes.page')).toHaveTextContent('1 / 3')

    fireEvent.click(document.getElementById('Prospects.notes.next') as HTMLElement)
    expect(screen.getByText('Note 4')).toBeInTheDocument()
    expect(screen.queryByText('Note 1')).not.toBeInTheDocument()

    fireEvent.click(document.getElementById('Prospects.notes.next') as HTMLElement)
    expect(screen.getByText('Note 7')).toBeInTheDocument()
    expect(document.getElementById('Prospects.notes.next')).toBeDisabled()
  })

  it('affiche la note de conversion avec sa couleur', async () => {
    findAllMock.mockResolvedValue([{
      ...prospect,
      status: 'ARCHIVED',
      convertedTo: 'CLIENT',
      notes: [{
        id: 50,
        noteDate: '2026-11-05',
        content: 'Prospect converti en client',
        color: 'green',
        eventType: 'CONVERSION_CLIENT',
        author: 'u',
        createdAt: '2026-11-05T08:00:00Z',
      }],
    }])

    render(<Prospects />)

    await screen.findByText('Société Prospective')
    fireEvent.click(document.getElementById('Prospects.row.1.notes') as HTMLElement)

    const card = document.getElementById('Prospects.notes.50')
    expect(card).toHaveClass('bg-green-50')
    expect(document.getElementById('Prospects.notes.50.content')).toHaveTextContent('Prospect converti en client')
  })

  it('ouvre le formulaire de création', async () => {
    findAllMock.mockResolvedValue([])

    render(<Prospects />)

    fireEvent.click(document.getElementById('Prospects.new') as HTMLElement)

    expect(document.getElementById('Prospects.form')).toBeInTheDocument()
    expect(document.getElementById('Prospects.name.input')).toBeInTheDocument()
    expect(document.getElementById('Prospects.kind.input')).toBeInTheDocument()
    expect(document.getElementById('Prospects.address.card')).toBeInTheDocument()
    expect(document.getElementById('Prospects.address')).toHaveTextContent('Prospects.address')
    expect(document.getElementById('Prospects.address.invalid')).toHaveTextContent('X')
    expect(document.getElementById('Prospects.email.invalid')).toHaveTextContent('X')
    expect(document.getElementById('Prospects.phone.invalid')).toHaveTextContent('X')
    expect(document.getElementById('Prospects.country.valid')).toBeInTheDocument()
    expect(document.getElementById('Prospects.postalCode.invalid')).toBeInTheDocument()
    expect(document.getElementById('Prospects.city.invalid')).toBeInTheDocument()
    expect(document.getElementById('Prospects.street.invalid')).toBeInTheDocument()
  })

  it('affiche des flags pour pays, code postal, ville et rue', async () => {
    await openCreateForm()
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        features: [{
          properties: { city: 'Paris', postcode: '75001', street: 'Rue de Paris', name: 'Rue de Paris' },
        }],
      }),
    })))

    fireEvent.change(document.getElementById('Prospects.postalCode.input') as HTMLInputElement, {
      target: { value: '75001' },
    })
    fireEvent.change(document.getElementById('Prospects.city.input') as HTMLInputElement, {
      target: { value: 'Paris' },
    })
    fireEvent.blur(document.getElementById('Prospects.city.input') as HTMLInputElement)
    await waitFor(() => expect(document.getElementById('Prospects.city.valid')).not.toBeNull())

    fireEvent.change(document.getElementById('Prospects.street.input') as HTMLInputElement, {
      target: { value: '1 rue de Paris' },
    })
    fireEvent.blur(document.getElementById('Prospects.street.input') as HTMLInputElement)

    await waitFor(() => expect(document.getElementById('Prospects.street.valid')).not.toBeNull())
    expect(document.getElementById('Prospects.postalCode.valid')).not.toBeNull()
    expect(document.getElementById('Prospects.country.valid')).not.toBeNull()
  })

  it('ouvre un prospect existant avec les flags ville/rue vérifiés', async () => {
    findAllMock.mockResolvedValue([prospect])
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        features: [{
          properties: { city: 'Paris', postcode: '75001', street: 'Rue de Paris', name: 'Rue de Paris' },
        }],
      }),
    })))

    render(<Prospects />)
    await screen.findByText('Société Prospective')
    fireEvent.click(document.getElementById('Prospects.row.1.edit') as HTMLElement)

    await waitFor(() => expect(document.getElementById('Prospects.city.valid')).not.toBeNull())
    expect(document.getElementById('Prospects.street.valid')).not.toBeNull()
    expect(document.getElementById('Prospects.address.valid')).not.toBeNull()
  })

  it('met le flag ville/rue au rouge si la ville ou la rue est incorrecte', async () => {
    await openCreateForm()
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        features: [{
          properties: { city: 'Paris', postcode: '75001', street: 'Rue de Paris', name: 'Rue de Paris' },
        }],
      }),
    })))

    fireEvent.change(document.getElementById('Prospects.postalCode.input') as HTMLInputElement, {
      target: { value: '75001' },
    })
    fireEvent.change(document.getElementById('Prospects.city.input') as HTMLInputElement, {
      target: { value: 'Marseille' },
    })
    fireEvent.blur(document.getElementById('Prospects.city.input') as HTMLInputElement)

    await waitFor(() => expect(document.getElementById('Prospects.city.invalid')).not.toBeNull())

    fireEvent.change(document.getElementById('Prospects.street.input') as HTMLInputElement, {
      target: { value: 'Rue Inexistante' },
    })
    fireEvent.blur(document.getElementById('Prospects.street.input') as HTMLInputElement)

    await waitFor(() => expect(document.getElementById('Prospects.street.invalid')).not.toBeNull())
    expect(document.getElementById('Prospects.address.invalid')).not.toBeNull()
  })

  it('affiche un flag vert/rouge pour l’email et le téléphone', async () => {
    await openCreateForm()

    const email = document.getElementById('Prospects.email.input') as HTMLInputElement
    const phone = document.getElementById('Prospects.phone.input') as HTMLInputElement

    fireEvent.change(email, { target: { value: 'contact@test.fr' } })
    fireEvent.change(phone, { target: { value: '01 02 03 04 05' } })

    await waitFor(() => expect(document.getElementById('Prospects.email.valid')).not.toBeNull())
    expect(document.getElementById('Prospects.email.invalid')).toBeNull()
    expect(document.getElementById('Prospects.phone.valid')).not.toBeNull()
    expect(document.getElementById('Prospects.phone.invalid')).toBeNull()

    fireEvent.change(email, { target: { value: 'bad' } })
    fireEvent.change(phone, { target: { value: '------' } })

    await waitFor(() => expect(document.getElementById('Prospects.email.invalid')).not.toBeNull())
    expect(document.getElementById('Prospects.phone.invalid')).not.toBeNull()
  })

  it('affiche X en rouge par défaut puis le flag si l’adresse existe', async () => {
    await openCreateForm()
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        features: [{ properties: { street: 'Rue de Paris', city: 'Paris', postcode: '75001' } }],
      }),
    })))

    const invalid = document.getElementById('Prospects.address.invalid')
    expect(invalid?.textContent).toBe('X')
    expect(invalid?.className).toContain('text-red-600')

    fireEvent.change(document.getElementById('Prospects.postalCode.input') as HTMLInputElement, {
      target: { value: '75001' },
    })
    fireEvent.change(document.getElementById('Prospects.city.input') as HTMLInputElement, {
      target: { value: 'Paris' },
    })
    fireEvent.blur(document.getElementById('Prospects.city.input') as HTMLInputElement)
    fireEvent.change(document.getElementById('Prospects.street.input') as HTMLInputElement, {
      target: { value: 'Rue de Paris' },
    })
    fireEvent.blur(document.getElementById('Prospects.street.input') as HTMLInputElement)

    await waitFor(() => expect(document.getElementById('Prospects.address.valid')).not.toBeNull(), {
      timeout: 3000,
    })
    expect(document.getElementById('Prospects.address.invalid')).toBeNull()
    expect(document.getElementById('Prospects.address.valid')?.className).toContain('text-green-600')
  })

  it('garde X en rouge si l’adresse n’existe pas', async () => {
    await openCreateForm()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ features: [] }) })))

    fireEvent.change(document.getElementById('Prospects.postalCode.input') as HTMLInputElement, {
      target: { value: '75001' },
    })
    fireEvent.change(document.getElementById('Prospects.city.input') as HTMLInputElement, {
      target: { value: 'Paris' },
    })
    fireEvent.change(document.getElementById('Prospects.street.input') as HTMLInputElement, {
      target: { value: 'Rue Inexistante' },
    })
    fireEvent.blur(document.getElementById('Prospects.street.input') as HTMLInputElement)

    await new Promise((resolve) => setTimeout(resolve, 800))
    expect(document.getElementById('Prospects.address.invalid')).not.toBeNull()
    expect(document.getElementById('Prospects.address.valid')).toBeNull()
  })

  it('admin charge tous les prospects sans filtre société et affiche la société', async () => {
    userMock.value = { id: 1, role: 'ADMIN', socId: null, pageSize: 3 }
    findAllMock.mockResolvedValue([prospect])

    render(<Prospects />)

    expect(await screen.findByText('Société Prospective')).toBeInTheDocument()
    expect(findAllMock).toHaveBeenCalledWith(undefined)
    expect(document.getElementById('Prospects.row.1.soc')).toHaveTextContent('SOC')
  })

  async function openCreateForm() {
    findAllMock.mockResolvedValue([])
    render(<Prospects />)
    fireEvent.click(document.getElementById('Prospects.new') as HTMLElement)
    fireEvent.change(document.getElementById('Prospects.name.input') as HTMLInputElement, {
      target: { value: 'Nouveau prospect' },
    })
  }

  it('refuse un email invalide', async () => {
    await openCreateForm()
    fireEvent.change(document.getElementById('Prospects.email.input') as HTMLInputElement, {
      target: { value: 'a@b' },
    })
    fireEvent.submit(document.getElementById('Prospects.form') as HTMLFormElement)

    expect(await screen.findByText('Prospects.email.invalid')).toBeInTheDocument()
    expect(createMock).not.toHaveBeenCalled()
  })

  it('refuse un téléphone invalide', async () => {
    await openCreateForm()
    fireEvent.change(document.getElementById('Prospects.phone.input') as HTMLInputElement, {
      target: { value: '------' },
    })
    fireEvent.submit(document.getElementById('Prospects.form') as HTMLFormElement)

    expect(await screen.findByText('Prospects.phone.invalid')).toBeInTheDocument()
    expect(createMock).not.toHaveBeenCalled()
  })

  it('refuse un code postal français invalide', async () => {
    await openCreateForm()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ features: [] }) })))
    fireEvent.change(document.getElementById('Prospects.postalCode.input') as HTMLInputElement, {
      target: { value: '7500' },
    })
    fireEvent.submit(document.getElementById('Prospects.form') as HTMLFormElement)

    expect(await screen.findByText('Prospects.postalCode.invalid')).toBeInTheDocument()
    expect(createMock).not.toHaveBeenCalled()
  })

  it('remplit la ville depuis le code postal (France)', async () => {
    await openCreateForm()
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ features: [{ properties: { city: 'Paris', postcode: '75001' } }] }),
    })))

    fireEvent.change(document.getElementById('Prospects.postalCode.input') as HTMLInputElement, {
      target: { value: '75001' },
    })

    await waitFor(() =>
      expect((document.getElementById('Prospects.city.input') as HTMLInputElement).value).toBe('Paris'),
    )
  })

  it('remplit le code postal depuis la ville (France)', async () => {
    await openCreateForm()
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ features: [{ properties: { city: 'Lyon', postcode: '69001' } }] }),
    })))

    const city = document.getElementById('Prospects.city.input') as HTMLInputElement
    fireEvent.change(city, { target: { value: 'Lyon' } })
    fireEvent.blur(city)

    await waitFor(() =>
      expect((document.getElementById('Prospects.postalCode.input') as HTMLInputElement).value).toBe('69001'),
    )
  })

  it('propose des suggestions de rue pour un code postal (France)', async () => {
    await openCreateForm()
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        features: [{ properties: { street: 'Rue de Paris', label: 'Rue de Paris 75001 Paris' } }],
      }),
    })))

    fireEvent.change(document.getElementById('Prospects.postalCode.input') as HTMLInputElement, {
      target: { value: '75001' },
    })
    fireEvent.change(document.getElementById('Prospects.street.input') as HTMLInputElement, {
      target: { value: 'Rue de' },
    })

    await waitFor(() => {
      expect(document.getElementById('Prospects.street.suggestions')).not.toBeNull()
    }, { timeout: 3000 })
    const list = document.getElementById('Prospects.street.suggestions') as HTMLElement
    expect(list.querySelectorAll('li')).toHaveLength(1)
    expect(list.textContent).toBe('Rue de Paris')
  })

  it('propose des rues quand la saisie commence par un numéro', async () => {
    await openCreateForm()
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        features: [{ properties: { street: 'Rue de Paris', label: 'Rue de Paris 75001 Paris' } }],
      }),
    })))

    fireEvent.change(document.getElementById('Prospects.postalCode.input') as HTMLInputElement, {
      target: { value: '75001' },
    })
    fireEvent.change(document.getElementById('Prospects.street.input') as HTMLInputElement, {
      target: { value: '12 rue de' },
    })

    await waitFor(() => {
      expect(document.getElementById('Prospects.street.suggestions')).not.toBeNull()
    }, { timeout: 3000 })
    const list = document.getElementById('Prospects.street.suggestions') as HTMLElement
    expect(list.textContent).toBe('12 Rue de Paris')
  })

  it('ne propose pas de rue sans code postal', async () => {
    await openCreateForm()
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ features: [{ properties: { street: 'Rue de Paris' } }] }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    fireEvent.change(document.getElementById('Prospects.street.input') as HTMLInputElement, {
      target: { value: 'Rue de' },
    })
    await new Promise((resolve) => setTimeout(resolve, 400))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(document.getElementById('Prospects.street.suggestions')).toBeNull()
  })

  it('enregistre l’adresse structurée', async () => {
    await openCreateForm()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ features: [] }) })))
    fireEvent.change(document.getElementById('Prospects.street.input') as HTMLInputElement, {
      target: { value: '1 rue de Paris' },
    })
    fireEvent.change(document.getElementById('Prospects.postalCode.input') as HTMLInputElement, {
      target: { value: '75001' },
    })
    fireEvent.change(document.getElementById('Prospects.city.input') as HTMLInputElement, {
      target: { value: 'Paris' },
    })
    fireEvent.change(document.getElementById('Prospects.phone.input') as HTMLInputElement, {
      target: { value: '01 02 03 04 05' },
    })
    fireEvent.submit(document.getElementById('Prospects.form') as HTMLFormElement)

    await waitFor(() => expect(createMock).toHaveBeenCalled())
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({
      contactPhone: '01 02 03 04 05',
      street: '1 rue de Paris',
      postalCode: '75001',
      city: 'Paris',
      country: 'FRANCE',
    }))
  })

  it('propose des pays et passe le pays en majuscules', async () => {
    await openCreateForm()

    const countryInput = document.getElementById('Prospects.country.input') as HTMLInputElement
    fireEvent.change(countryInput, { target: { value: 'fra' } })

    expect(countryInput.value).toBe('FRA')
    const list = document.getElementById('Prospects.country.suggestions') as HTMLDataListElement
    const values = Array.from(list.options).map((option) => option.value)
    expect(values).toContain('FRANCE')
  })

  it('pré-remplit le pays avec celui de la société sélectionnée', async () => {
    selectedSocMock.value = { id: 5, name: 'SOC', country: 'Belgique' }
    findAllMock.mockResolvedValue([])

    render(<Prospects />)
    fireEvent.click(document.getElementById('Prospects.new') as HTMLElement)

    expect((document.getElementById('Prospects.country.input') as HTMLInputElement).value).toBe('BELGIQUE')
  })
})
