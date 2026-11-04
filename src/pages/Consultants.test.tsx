import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Consultants } from './Consultants'
import type { ConsultantDto, UserDto } from '../api/types'

const { findAllMock, updateMock, userMock } = vi.hoisted(() => ({
  findAllMock: vi.fn(),
  updateMock: vi.fn(),
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

vi.mock('../soc/SocContext', () => ({
  useSoc: () => ({
    socs: [],
    selectedSocId: 5,
    selectedSoc: null,
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

vi.mock('../api/consultants', () => ({
  consultantsApi: {
    findAll: findAllMock,
    managers: vi.fn().mockResolvedValue([]),
    update: updateMock,
    create: vi.fn(),
    delete: vi.fn(),
    history: vi.fn().mockResolvedValue([]),
    importCsv: vi.fn(),
  },
}))

vi.mock('../api/socs', () => ({
  socsApi: { findAll: vi.fn().mockResolvedValue([]) },
}))

const responsibleUser = {
  id: 1,
  username: 'resp',
  email: 'resp@soc.fr',
  firstName: 'R',
  lastName: 'Responsable',
  phone: null,
  role: 'RESPONSIBLE_SOC',
  active: true,
  socId: 5,
  socName: 'SOC Test',
  consultantId: null,
  mustChangePassword: false,
  lastLoginAt: null,
  pageSize: 5,
} as UserDto

const managerUser = { ...responsibleUser, id: 2, role: 'MANAGER' } as UserDto

function consultant(overrides: Partial<ConsultantDto> = {}): ConsultantDto {
  return {
    id: 10,
    username: 'jdoe',
    email: 'jdoe@soc.fr',
    firstName: 'Jean',
    lastName: 'Dupont',
    phone: null,
    role: 'CONSULTANT',
    active: true,
    socId: 5,
    socName: 'SOC Test',
    managerId: 2,
    managerName: 'Manager Test',
    position: 'Dev',
    hireDate: '2020-01-01',
    birthDate: null,
    socialNumber: null,
    salary: null,
    currency: 'EUR',
    nationality: null,
    emergencyContact: null,
    mustChangePassword: false,
    lastLoginAt: null,
    address: null,
    statutProfessionnel: null,
    positionProfessionnelle: null,
    coefficient: null,
    matricule: null,
    modePaiement: null,
    employee: true,
    hasPhoto: false,
    rttEligible: true,
    rttEligibleDate: '2020-01-01',
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/consultants']}>
      <Consultants />
    </MemoryRouter>,
  )
}

async function openEdit(email: string) {
  findAllMock.mockResolvedValue({
    items: [consultant({ email })],
    total: 1,
    page: 0,
    size: 5,
    totalPages: 1,
  })
  renderPage()
  await screen.findByText('Jean Dupont')
  fireEvent.click(screen.getByRole('button', { name: 'Modifier' }))
  return document.querySelector('input[type="email"]') as HTMLInputElement
}

afterEach(() => {
  vi.clearAllMocks()
  userMock.value = null as unknown as UserDto
})

describe.each([
  ['RESPONSIBLE_SOC', responsibleUser],
  ['MANAGER', managerUser],
])('Consultants — email obligatoire et valide (%s)', (_role, user) => {
  it('affiche une erreur et garde la popup ouverte si l’email est vide', async () => {
    userMock.value = user
    const emailInput = await openEdit('jdoe@soc.fr')

    fireEvent.change(emailInput, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('L’email est obligatoire.')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('affiche une erreur et ne sauvegarde pas un email sans @', async () => {
    userMock.value = user
    const emailInput = await openEdit('jdoe@soc.fr')

    fireEvent.change(emailInput, { target: { value: 'invalide' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('Saisissez un email valide.')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(updateMock).not.toHaveBeenCalled()
  })
})

describe('Consultants — éligibilité RTT', () => {
  it('affiche et enregistre les champs RTT de la fiche collaborateur', async () => {
    userMock.value = responsibleUser
    findAllMock.mockResolvedValue({
      items: [consultant({ rttEligible: true, rttEligibleDate: '2020-01-01' })],
      total: 1,
      page: 0,
      size: 5,
      totalPages: 1,
    })
    renderPage()
    await screen.findByText('Jean Dupont')
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }))

    const checkbox = document.getElementById('Consultants.rtt.eligible.input') as HTMLInputElement
    const dateInput = document.getElementById('Consultants.rtt.date.input') as HTMLInputElement
    expect(checkbox.checked).toBe(true)
    expect(dateInput.value).toBe('01/01/2020')

    fireEvent.click(checkbox)
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(updateMock).toHaveBeenCalled())
    const payload = updateMock.mock.calls[0][1] as { rttEligible: boolean; rttEligibleDate: string }
    expect(payload.rttEligible).toBe(false)
    expect(payload.rttEligibleDate).toBe('2020-01-01')
  })

  it('aligne la date d’éligibilité RTT sur la nouvelle date d’embauche', async () => {
    userMock.value = responsibleUser
    findAllMock.mockResolvedValue({
      items: [consultant({ hireDate: '2020-01-01', rttEligibleDate: '2020-01-01' })],
      total: 1,
      page: 0,
      size: 5,
      totalPages: 1,
    })
    renderPage()
    await screen.findByText('Jean Dupont')
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }))

    const hireInput = document.getElementById('Consultants.date.d.embauche.input') as HTMLInputElement
    const rttInput = document.getElementById('Consultants.rtt.date.input') as HTMLInputElement

    fireEvent.change(hireInput, { target: { value: '01/01/2024' } })
    fireEvent.keyDown(hireInput, { key: 'Enter', code: 'Enter' })

    await waitFor(() => expect(rttInput.value).toBe('01/01/2024'))
  })
})
