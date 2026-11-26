import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Billing } from './Billing'
import type { ActivityDto, BillingDocumentDto } from '../api/types'

const { createMock, listMock, activitiesMock, validateMock, duplicateMock, clientsMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  listMock: vi.fn().mockResolvedValue([]),
  activitiesMock: vi.fn().mockResolvedValue([]),
  validateMock: vi.fn(),
  duplicateMock: vi.fn(),
  clientsMock: vi.fn().mockResolvedValue([]),
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      username: 'resp',
      email: 'resp@soc.fr',
      firstName: 'Resp',
      lastName: 'Soc',
      phone: null,
      role: 'RESPONSIBLE_SOC',
      active: true,
      socId: 10,
      socName: 'Soc Test',
    },
  }),
}))

vi.mock('../soc/SocContext', () => ({
  useSoc: () => ({
    selectedSocId: 10,
    selectedSoc: { id: 10, name: 'Soc Test', vatRate: 5.5 },
    socs: [],
    favoriteSocId: null,
    favoriteSoc: null,
    loading: false,
    refreshSocs: vi.fn(),
    selectSoc: vi.fn(),
    setFavoriteSoc: vi.fn(),
    addSoc: vi.fn(),
    canAddSoc: false,
  }),
}))

vi.mock('../i18n', () => ({
  useI18n: () => ({
    language: 'fr',
    t: (key: string) => key,
    preference: null,
    languages: ['fr'],
    setLanguage: vi.fn(),
    refresh: vi.fn(),
  }),
}))

vi.mock('../api/billing', () => ({
  billingApi: {
    list: listMock,
    generateMonths: vi.fn().mockResolvedValue([]),
    sendHistory: vi.fn().mockResolvedValue([]),
    create: createMock,
    validateQuote: validateMock,
    duplicate: duplicateMock,
    getById: vi.fn(),
    pdfUrl: vi.fn().mockResolvedValue('blob:preview'),
  },
}))

vi.mock('../api/activities', () => ({
  activitiesApi: { findAll: activitiesMock },
}))

vi.mock('../api/projects', () => ({
  projectsApi: { findAll: vi.fn().mockResolvedValue([]) },
}))

vi.mock('../api/clients', () => ({
  clientsApi: { findAll: clientsMock },
}))

vi.mock('../components/dialog', () => ({
  dialog: {
    confirm: vi.fn().mockResolvedValue(true),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

afterEach(() => {
  vi.clearAllMocks()
  listMock.mockResolvedValue([])
  activitiesMock.mockResolvedValue([])
  clientsMock.mockResolvedValue([])
})

const quote: BillingDocumentDto = {
  id: 1,
  socId: 10,
  projectId: null,
  projectName: 'Mission Test',
  clientId: null,
  clientName: 'Client Test',
  clientAddress: null,
  clientPhone: null,
  clientEmail: null,
  location: null,
  activityId: null,
  activityName: null,
  missionLabel: null,
  consultantId: null,
  consultantName: null,
  parentQuoteId: null,
  parentQuoteNumber: null,
  type: 'QUOTE',
  number: '2026-02-01-001',
  issueDate: '2026-02-01',
  status: 'DRAFT',
  vatRate: 20,
  discount: 0,
  totalHt: 100,
  totalTtc: 120,
  notes: null,
  sentToClientAt: null,
  sendCount: 0,
  validated: false,
  frozen: false,
  generatedInvoiceId: null,
  generatedInvoiceNumber: null,
  lines: [{ id: 1, description: 'Prestation', quantity: 1, unitPrice: 100, amount: 100 }],
}

describe('Billing — TVA par défaut', () => {
  it('pré-remplit la TVA du nouveau devis avec la valeur de la société', async () => {
    render(<Billing />)

    await waitFor(() => expect(document.getElementById('Billing.new')).not.toBeNull())
    fireEvent.click(document.getElementById('Billing.new') as HTMLElement)

    const vat = document.getElementById('Billing.form.vat') as HTMLInputElement
    expect(vat).not.toBeNull()
    expect(vat.value).toBe('5.5')
  })

  it('ajoute une ligne sans fermer la popup du nouveau devis', async () => {
    render(<Billing />)

    await waitFor(() => expect(document.getElementById('Billing.new')).not.toBeNull())
    fireEvent.click(document.getElementById('Billing.new') as HTMLElement)
    fireEvent.change(document.getElementById('Billing.form.line.0.desc') as HTMLTextAreaElement, {
      target: { value: 'Prestation existante' },
    })

    fireEvent.click(document.getElementById('Billing.form.addLine') as HTMLElement)

    expect(document.getElementById('Billing.form.line.1.desc')).not.toBeNull()
    expect(createMock).not.toHaveBeenCalled()
  })

  it('calcule le total avec une remise en pourcentage', async () => {
    render(<Billing />)

    await waitFor(() => expect(document.getElementById('Billing.new')).not.toBeNull())
    fireEvent.click(document.getElementById('Billing.new') as HTMLElement)
    fireEvent.change(document.getElementById('Billing.form.line.0.desc') as HTMLTextAreaElement, {
      target: { value: 'Prestation' },
    })
    fireEvent.change(document.getElementById('Billing.form.line.0.qty') as HTMLInputElement, {
      target: { value: '1' },
    })
    fireEvent.change(document.getElementById('Billing.form.line.0.price') as HTMLInputElement, {
      target: { value: '100' },
    })
    fireEvent.change(document.getElementById('Billing.form.discount') as HTMLInputElement, {
      target: { value: '10' },
    })

    expect(screen.getByText('Total HT: 90.00')).toBeInTheDocument()
    expect(screen.getByText('Total TTC: 94.95')).toBeInTheDocument()
  })

  it('n’affiche qu’une seule liste Mission (l’activité) dans le nouveau devis', async () => {
    render(<Billing />)

    await waitFor(() => expect(document.getElementById('Billing.new')).not.toBeNull())
    fireEvent.click(document.getElementById('Billing.new') as HTMLElement)

    expect(document.getElementById('Billing.form.project')).toBeNull()
    expect(document.getElementById('Billing.form.activity')).not.toBeNull()
  })

  it('ne propose que les activités de type MISSION', async () => {
    activitiesMock.mockResolvedValue([
      {
        id: 30, name: 'Mission Alpha', description: null, price: 100, currency: 'EUR',
        startDate: null, endDate: null, type: { id: 1, code: 'MISSION', labelFr: 'Mission' },
        project: null, consultant: null, soc: null, active: true, regie: true, indispo: false,
        weekendAllowed: false, holidayAllowed: false,
      },
      {
        id: 31, name: 'Congé payé', description: null, price: 0, currency: 'EUR',
        startDate: null, endDate: null, type: { id: 2, code: 'CONGE_PAYE', labelFr: 'Congé' },
        project: null, consultant: null, soc: null, active: true, regie: true, indispo: true,
        weekendAllowed: false, holidayAllowed: false,
      },
    ] as ActivityDto[])

    render(<Billing />)

    await waitFor(() => expect(document.getElementById('Billing.new')).not.toBeNull())
    fireEvent.click(document.getElementById('Billing.new') as HTMLElement)
    await waitFor(() => {
      const select = document.getElementById('Billing.form.activity') as HTMLSelectElement | null
      expect(select?.options.length).toBe(2)
    })
    const select = document.getElementById('Billing.form.activity') as HTMLSelectElement
    const labels = Array.from(select.options).map((option) => option.textContent)
    expect(labels).toContain('Mission Alpha')
    expect(labels).not.toContain('Congé payé')
  })

  it('valide un devis et affiche le bouton de création de facture', async () => {
    listMock.mockResolvedValue([quote])
    validateMock.mockResolvedValue({ ...quote, validated: true, frozen: true })

    render(<Billing />)

    await waitFor(() => expect(document.getElementById('table.row.1')).not.toBeNull())
    fireEvent.click(document.getElementById('table.row.1') as HTMLElement)
    expect(document.getElementById('Billing.view.validate')).not.toBeNull()

    fireEvent.click(document.getElementById('Billing.view.validate') as HTMLElement)

    await waitFor(() => expect(document.getElementById('Billing.view.convert')).not.toBeNull())
    expect(document.getElementById('Billing.view.validate')).toBeNull()
  })

  it('duplique un document et propose de basculer vers la copie', async () => {
    listMock.mockResolvedValue([quote])
    duplicateMock.mockResolvedValue({ ...quote, id: 2, number: 'COPY-1' })

    render(<Billing />)

    await waitFor(() => expect(document.getElementById('table.row.1')).not.toBeNull())
    fireEvent.click(document.getElementById('table.row.1') as HTMLElement)
    fireEvent.click(document.getElementById('Billing.view.duplicate') as HTMLElement)

    await waitFor(() => expect(document.getElementById('Billing.result.message')).not.toBeNull())
    expect(document.getElementById('Billing.result.message')?.textContent).toContain('COPY-1')
    expect((document.getElementById('Billing.result.switch') as HTMLInputElement).checked).toBe(true)
  })

  it('mission en saisie libre : client sélectionné, coordonnées affichées et enregistrées', async () => {
    clientsMock.mockResolvedValue([
      {
        id: 7, name: 'Client Libre', address: '1 rue Test', contactName: null,
        contactEmail: 'libre@test.fr', contactPhone: '0102030405', active: true,
      },
    ])

    render(<Billing />)
    await waitFor(() => expect(document.getElementById('Billing.new')).not.toBeNull())
    fireEvent.click(document.getElementById('Billing.new') as HTMLElement)

    fireEvent.click(document.getElementById('Billing.form.missionMode.free.input') as HTMLInputElement)
    fireEvent.change(document.getElementById('Billing.form.missionLabel') as HTMLTextAreaElement, {
      target: { value: 'Audit technique' },
    })
    await waitFor(() => expect(document.getElementById('Billing.form.client')).not.toBeNull())
    fireEvent.change(document.getElementById('Billing.form.client') as HTMLSelectElement, { target: { value: '7' } })

    await waitFor(() => expect(document.getElementById('Billing.form.clientInfo.name')?.textContent).toBe('Client Libre'))
    expect(document.getElementById('Billing.form.clientInfo.address')?.textContent).toBe('1 rue Test')
    expect(document.getElementById('Billing.form.clientInfo.phone')?.textContent).toBe('0102030405')
    expect(document.getElementById('Billing.form.clientInfo.email')?.textContent).toBe('libre@test.fr')

    fireEvent.change(document.getElementById('Billing.form.line.0.desc') as HTMLTextAreaElement, {
      target: { value: 'Prestation' },
    })
    fireEvent.submit(document.getElementById('Billing.form') as HTMLFormElement)

    await waitFor(() => expect(createMock).toHaveBeenCalled())
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({
      activityId: null,
      missionLabel: 'Audit technique',
      clientId: 7,
    }))
  })
})
