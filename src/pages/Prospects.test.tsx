import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Prospects } from './Prospects'
import type { ProspectDto } from '../api/types'

const { findAllMock } = vi.hoisted(() => ({ findAllMock: vi.fn() }))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, role: 'MANAGER', socId: 5, pageSize: 3 } }),
}))

vi.mock('../soc/SocContext', () => ({
  useSoc: () => ({ selectedSocId: 5 }),
}))

vi.mock('../api/prospects', () => ({
  prospectsApi: {
    findAll: findAllMock,
    create: vi.fn(),
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
  })
})
