import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { Billing } from './Billing'

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }))

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
    list: vi.fn().mockResolvedValue([]),
    generateMonths: vi.fn().mockResolvedValue([]),
    sendHistory: vi.fn().mockResolvedValue([]),
    create: createMock,
  },
}))

vi.mock('../api/activities', () => ({
  activitiesApi: { findAll: vi.fn().mockResolvedValue([]) },
}))

vi.mock('../api/projects', () => ({
  projectsApi: { findAll: vi.fn().mockResolvedValue([]) },
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
})

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
})
