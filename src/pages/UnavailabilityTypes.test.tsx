import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { UnavailabilityTypes } from './UnavailabilityTypes'
import { DialogHost } from '../components/dialog'
import type { UnavailabilityTypeConfigDto, UserDto } from '../api/types'

const { listMock, saveMock, userMock, socMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  saveMock: vi.fn(),
  userMock: { value: null as unknown as UserDto },
  socMock: { value: { selectedSocId: 5 as number | null } },
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
    selectedSocId: socMock.value.selectedSocId,
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

vi.mock('../api/unavailabilityTypes', () => ({
  unavailabilityTypesApi: { list: listMock, save: saveMock },
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
} as UserDto

const managerUser = { ...responsibleUser, id: 2, role: 'MANAGER' } as UserDto

function row(overrides: Partial<UnavailabilityTypeConfigDto> = {}): UnavailabilityTypeConfigDto {
  return {
    id: 1,
    socId: 5,
    sortOrder: 0,
    typeLabel: 'Congés payés',
    durationRule: '25 jours ouvrés/an',
    countType: 'Ouvrés',
    mainConditions: 'Acquisition selon le temps de travail',
    remuneration: '✅ Payé',
    cpAcquisition: '✅ Oui',
    legalProvision: '✅',
    syntecProvision: '✅ Modalités Syntec',
    documentRequired: null,
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/types-indisponibilites']}>
      <UnavailabilityTypes />
      <DialogHost />
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.clearAllMocks()
  userMock.value = null as unknown as UserDto
  socMock.value = { selectedSocId: 5 }
})

describe('UnavailabilityTypes', () => {
  it('affiche le tableau de la société et enregistre les modifications', async () => {
    userMock.value = responsibleUser
    listMock.mockResolvedValue([
      row(),
      row({ id: 2, sortOrder: 1, typeLabel: 'RTT', durationRule: null }),
    ])
    saveMock.mockResolvedValue([
      row({ typeLabel: 'Congés payés modifié' }),
      row({ id: 2, sortOrder: 1, typeLabel: 'RTT' }),
    ])

    renderPage()

    const inputs = await screen.findAllByRole('textbox')
    expect(inputs).toHaveLength(18)
    fireEvent.change(inputs[0], { target: { value: 'Congés payés modifié' } })

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1))
    const [socId, payload] = saveMock.mock.calls[0]
    expect(socId).toBe(5)
    expect(payload[0].typeLabel).toBe('Congés payés modifié')
    expect(payload[1].typeLabel).toBe('RTT')
  })

  it('ajoute une ligne vide au tableau', async () => {
    userMock.value = responsibleUser
    listMock.mockResolvedValue([row()])

    renderPage()

    await screen.findAllByRole('textbox')
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une ligne' }))

    await waitFor(() => expect(screen.getAllByRole('textbox')).toHaveLength(18))
  })

  it('supprime une ligne du tableau', async () => {
    userMock.value = responsibleUser
    listMock.mockResolvedValue([
      row(),
      row({ id: 2, sortOrder: 1, typeLabel: 'RTT' }),
    ])

    renderPage()

    await screen.findAllByRole('textbox')
    fireEvent.click(screen.getAllByRole('button', { name: 'Supprimer la ligne' })[0])

    await waitFor(() => expect(screen.getAllByRole('textbox')).toHaveLength(9))
  })

  it('refuse d’enregistrer une ligne sans type', async () => {
    userMock.value = responsibleUser
    listMock.mockResolvedValue([row()])

    renderPage()

    await screen.findAllByRole('textbox')
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une ligne' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(
      await screen.findByText('Le type d’indisponibilité est obligatoire.'),
    ).toBeInTheDocument()
    expect(saveMock).not.toHaveBeenCalled()
  })

  it('n’affiche pas la page pour un rôle non autorisé', async () => {
    userMock.value = managerUser
    listMock.mockResolvedValue([row()])

    renderPage()

    await waitFor(() =>
      expect(screen.queryByText('Types d’indisponibilités')).not.toBeInTheDocument(),
    )
  })
})
