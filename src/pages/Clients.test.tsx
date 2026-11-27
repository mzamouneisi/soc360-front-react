import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { Clients } from './Clients'

const { findAllMock, createMock, socsFindAllMock } = vi.hoisted(() => ({
  findAllMock: vi.fn().mockResolvedValue([]),
  createMock: vi.fn().mockResolvedValue({}),
  socsFindAllMock: vi.fn().mockResolvedValue([{ id: 10, name: 'SOC' }]),
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, role: 'RESPONSIBLE_SOC', socId: 10 } }),
}))

vi.mock('../soc/SocContext', () => ({
  useSoc: () => ({ selectedSocId: 10, socs: [{ id: 10, name: 'SOC' }] }),
}))

vi.mock('../api/clients', () => ({
  clientsApi: {
    findAll: findAllMock,
    create: createMock,
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('../api/socs', () => ({
  socsApi: { findAll: socsFindAllMock },
}))

vi.mock('../components/dialog', () => ({
  dialog: {
    confirm: vi.fn().mockResolvedValue(true),
    success: vi.fn(),
    error: vi.fn(),
  },
}))

afterEach(() => {
  vi.clearAllMocks()
  findAllMock.mockResolvedValue([])
  createMock.mockResolvedValue({})
  socsFindAllMock.mockResolvedValue([{ id: 10, name: 'SOC' }])
})

async function openBlankForm() {
  render(<Clients />)
  await waitFor(() => expect(document.getElementById('Clients.nouveau.client')).not.toBeNull())
  fireEvent.click(document.getElementById('Clients.nouveau.client') as HTMLElement)
}

async function openCreateForm() {
  await openBlankForm()
  fireEvent.change(document.getElementById('Clients.societe.associee.select') as HTMLSelectElement, {
    target: { value: '10' },
  })
  fireEvent.change(document.getElementById('Clients.nom.du.client.input') as HTMLInputElement, {
    target: { value: 'Client test' },
  })
}

describe('Clients — contrôles de saisie', () => {
  it('affiche des flags vert/rouge pour l’email et le téléphone', async () => {
    await openBlankForm()

    expect(document.getElementById('Clients.e.mail.du.contact.invalid')).toHaveTextContent('X')
    expect(document.getElementById('Clients.telephone.invalid')).toHaveTextContent('X')

    fireEvent.change(document.getElementById('Clients.e.mail.du.contact.input') as HTMLInputElement, {
      target: { value: 'contact@test.fr' },
    })
    fireEvent.change(document.getElementById('Clients.telephone.input') as HTMLInputElement, {
      target: { value: '06 12 34 56 78' },
    })

    await waitFor(() =>
      expect(document.getElementById('Clients.e.mail.du.contact.valid')).not.toBeNull(),
    )
    expect(document.getElementById('Clients.telephone.valid')).not.toBeNull()

    fireEvent.change(document.getElementById('Clients.e.mail.du.contact.input') as HTMLInputElement, {
      target: { value: 'bad' },
    })
    fireEvent.change(document.getElementById('Clients.telephone.input') as HTMLInputElement, {
      target: { value: '------' },
    })

    await waitFor(() =>
      expect(document.getElementById('Clients.e.mail.du.contact.invalid')).not.toBeNull(),
    )
    expect(document.getElementById('Clients.telephone.invalid')).not.toBeNull()
  })

  it('refuse un email invalide', async () => {
    await openCreateForm()
    fireEvent.change(document.getElementById('Clients.e.mail.du.contact.input') as HTMLInputElement, {
      target: { value: 'pas-un-email' },
    })
    fireEvent.click(document.getElementById('common.create') as HTMLElement)

    await waitFor(() =>
      expect(document.getElementById('Clients.formError')?.textContent).toContain(
        'Clients.email.invalid',
      ),
    )
    expect(createMock).not.toHaveBeenCalled()
  })

  it('refuse un téléphone invalide', async () => {
    await openCreateForm()
    fireEvent.change(document.getElementById('Clients.e.mail.du.contact.input') as HTMLInputElement, {
      target: { value: 'contact@test.fr' },
    })
    fireEvent.change(document.getElementById('Clients.telephone.input') as HTMLInputElement, {
      target: { value: '------' },
    })
    fireEvent.click(document.getElementById('common.create') as HTMLElement)

    await waitFor(() =>
      expect(document.getElementById('Clients.formError')?.textContent).toContain(
        'Clients.phone.invalid',
      ),
    )
    expect(createMock).not.toHaveBeenCalled()
  })

  it('accepte un email et un téléphone valides', async () => {
    await openCreateForm()
    fireEvent.change(document.getElementById('Clients.e.mail.du.contact.input') as HTMLInputElement, {
      target: { value: 'contact@test.fr' },
    })
    fireEvent.change(document.getElementById('Clients.telephone.input') as HTMLInputElement, {
      target: { value: '06 12 34 56 78' },
    })
    fireEvent.click(document.getElementById('common.create') as HTMLElement)

    await waitFor(() => expect(createMock).toHaveBeenCalled())
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({
      contactEmail: 'contact@test.fr',
      contactPhone: '06 12 34 56 78',
    }))
  })
})
