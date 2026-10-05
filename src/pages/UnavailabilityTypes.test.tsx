import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  pageSize: 5,
} as UserDto

const managerUser = { ...responsibleUser, id: 2, role: 'MANAGER' } as UserDto

function row(overrides: Partial<UnavailabilityTypeConfigDto> = {}): UnavailabilityTypeConfigDto {
  return {
    id: 1,
    socId: 5,
    sortOrder: 0,
    typeLabel: 'Congés payés',
    duration: 25,
    countType: 'Ouvrés',
    mainConditions: 'Acquisition selon le temps de travail',
    remuneration: true,
    cpAcquisition: true,
    legalProvision: true,
    collectiveAgreementProvision: 'Modalités conventionnelles',
    documentRequired: false,
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
  it('affiche la liste des types avec les actions par ligne', async () => {
    userMock.value = responsibleUser
    listMock.mockResolvedValue([
      row(),
      row({ id: 2, sortOrder: 1, typeLabel: 'RTT', duration: null }),
    ])

    renderPage()

    expect(await screen.findByText('Congés payés')).toBeInTheDocument()
    expect(screen.getByText('25 j')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Modifier' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Supprimer la ligne' })).toHaveLength(2)
  })

  it('édite une ligne puis enregistre', async () => {
    userMock.value = responsibleUser
    listMock.mockResolvedValue([row()])
    saveMock.mockResolvedValue([row({ typeLabel: 'Congés payés modifié' })])

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Modifier' }))
    fireEvent.change(screen.getByLabelText('Type indispo'), {
      target: { value: 'Congés payés modifié' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1))
    const [socId, payload] = saveMock.mock.calls[0]
    expect(socId).toBe(5)
    expect(payload[0].typeLabel).toBe('Congés payés modifié')
    expect(payload[0].duration).toBe(25)
  })

  it('ajoute une nouvelle ligne', async () => {
    userMock.value = responsibleUser
    listMock.mockResolvedValue([row()])
    saveMock.mockResolvedValue([row(), row({ id: 3, typeLabel: 'Nouveau' })])

    renderPage()

    await screen.findByText('Congés payés')
    fireEvent.click(screen.getByRole('button', { name: 'Nouveau type' }))
    fireEvent.change(screen.getByLabelText('Type indispo'), { target: { value: 'Nouveau' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1))
    const [, payload] = saveMock.mock.calls[0]
    expect(payload).toHaveLength(2)
    expect(payload[1].typeLabel).toBe('Nouveau')
  })

  it('supprime une ligne après confirmation', async () => {
    userMock.value = responsibleUser
    listMock.mockResolvedValue([
      row(),
      row({ id: 2, sortOrder: 1, typeLabel: 'RTT' }),
    ])
    saveMock.mockResolvedValue([row({ id: 2, sortOrder: 1, typeLabel: 'RTT' })])

    renderPage()

    fireEvent.click((await screen.findAllByRole('button', { name: 'Supprimer la ligne' }))[0])
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Supprimer' }))

    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1))
    const [, payload] = saveMock.mock.calls[0]
    expect(payload).toHaveLength(1)
    expect(payload[0].typeLabel).toBe('RTT')
  })

  it('refuse d’enregistrer un type vide', async () => {
    userMock.value = responsibleUser
    listMock.mockResolvedValue([row()])

    renderPage()

    await screen.findByText('Congés payés')
    fireEvent.click(screen.getByRole('button', { name: 'Nouveau type' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(
      await screen.findByText('Le type d’indisponibilité est obligatoire.'),
    ).toBeInTheDocument()
    expect(saveMock).not.toHaveBeenCalled()
  })

  it('propose d’enregistrer à la fermeture si des modifications ont changé', async () => {
    userMock.value = responsibleUser
    listMock.mockResolvedValue([row()])
    saveMock.mockResolvedValue([row({ typeLabel: 'Modifié' })])

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Modifier' }))
    fireEvent.change(screen.getByLabelText('Type indispo'), { target: { value: 'Modifié' } })
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1))
    const [, payload] = saveMock.mock.calls[0]
    expect(payload[0].typeLabel).toBe('Modifié')
  })

  it('affiche les libellés de colonnes renommés', async () => {
    userMock.value = responsibleUser
    listMock.mockResolvedValue([row()])

    renderPage()

    await screen.findByText('Congés payés')
    expect(screen.getByText('Durée')).toBeInTheDocument()
    expect(screen.getByText('Prévu par la convention collective')).toBeInTheDocument()
    expect(screen.queryByText('Durée / règle')).not.toBeInTheDocument()
    expect(screen.queryByText('Prévu par Syntec')).not.toBeInTheDocument()
  })

  it('pagine la liste selon le paramètre de lignes par page', async () => {
    userMock.value = responsibleUser
    listMock.mockResolvedValue(
      Array.from({ length: 6 }, (_, i) =>
        row({ id: i + 1, sortOrder: i, typeLabel: `Type ${i + 1}` }),
      ),
    )

    renderPage()

    expect(await screen.findByText('Type 1')).toBeInTheDocument()
    expect(screen.queryByText('Type 6')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Modifier' })).toHaveLength(5)

    fireEvent.click(screen.getByRole('button', { name: 'Suivant' }))

    expect(await screen.findByText('Type 6')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Modifier' })).toHaveLength(1)
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
