import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { UnavailabilityTypes } from './UnavailabilityTypes'
import { DialogHost } from '../components/dialog'
import type { UnavailabilityTypeConfigDto, UserDto } from '../api/types'

const { listMock, createMock, updateMock, disableMock, removeMock, userMock, socMock } = vi.hoisted(
  () => ({
    listMock: vi.fn(),
    createMock: vi.fn(),
    updateMock: vi.fn(),
    disableMock: vi.fn(),
    removeMock: vi.fn(),
    userMock: { value: null as unknown as UserDto },
    socMock: { value: { selectedSocId: 5 as number | null } },
  }),
)

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
  unavailabilityTypesApi: {
    list: listMock,
    active: vi.fn(),
    create: createMock,
    update: updateMock,
    disable: disableMock,
    remove: removeMock,
  },
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
    name: 'Congés payés',
    durationValue: 25,
    durationUnit: 'DAYS',
    countType: 'OUVRE',
    remuneration: true,
    paidLeaveAccrual: true,
    providedByLaw: true,
    providedByCollectiveAgreement: true,
    documentRequired: false,
    mainCondition: 'Acquisition selon le temps de travail',
    status: 'ACTIVE',
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
})

describe('UnavailabilityTypes', () => {
  it('affiche la liste des types avec leur statut', async () => {
    userMock.value = responsibleUser
    listMock.mockResolvedValue([
      row(),
      row({ id: 2, name: 'RTT', status: 'DISABLED', durationValue: 10 }),
    ])

    renderPage()

    expect(await screen.findByText('Congés payés')).toBeInTheDocument()
    expect(screen.getByText('RTT')).toBeInTheDocument()
    expect(screen.getByText('Actif')).toBeInTheDocument()
    expect(screen.getByText('Désactivé')).toBeInTheDocument()
    expect(screen.getByText('25')).toBeInTheDocument()
    expect(screen.getAllByText('Jours').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Ouvré').length).toBeGreaterThan(0)
  })

  it('affiche une cellule vide pour les valeurs nulles', async () => {
    userMock.value = responsibleUser
    listMock.mockResolvedValue([
      row({
        remuneration: null,
        mainCondition: null,
        durationValue: null as unknown as number,
      }),
    ])

    renderPage()

    const nameCell = await screen.findByText('Congés payés')
    const rowElement = nameCell.closest('tr')
    expect(rowElement).not.toBeNull()
    expect(within(rowElement as HTMLElement).queryByText('—')).not.toBeInTheDocument()
    expect(rowElement?.textContent).not.toContain('—')
    expect(rowElement?.textContent).not.toContain('null')
  })

  it('crée un type via la popup avec les valeurs par défaut ALL et ACTIVE', async () => {
    userMock.value = responsibleUser
    listMock.mockResolvedValue([row()])
    createMock.mockResolvedValue(row({ id: 9, name: 'Télétravail' }))

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Nouveau type' }))
    fireEvent.change(screen.getByLabelText('Type indispo'), {
      target: { value: 'Télétravail' },
    })
    fireEvent.change(screen.getByLabelText('Durée'), { target: { value: '2.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(createMock).toHaveBeenCalled())
    const request = createMock.mock.calls[0][0]
    expect(request).toMatchObject({
      socId: 5,
      name: 'Télétravail',
      durationValue: 2.5,
      durationUnit: 'DAYS',
      countType: 'OUVRE',
      paidLeaveAccrual: true,
      providedByLaw: true,
      providedByCollectiveAgreement: true,
      documentRequired: false,
      remuneration: null,
    })
  })

  it('modifie un type existant', async () => {
    userMock.value = responsibleUser
    listMock.mockResolvedValue([row()])
    updateMock.mockResolvedValue(row({ name: 'Congés payés 2' }))

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Modifier' }))
    fireEvent.change(screen.getByLabelText('Type indispo'), {
      target: { value: 'Congés payés 2' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(updateMock).toHaveBeenCalled())
    expect(updateMock.mock.calls[0][0]).toBe(1)
    expect(updateMock.mock.calls[0][1].name).toBe('Congés payés 2')
  })

  it('désactive un type après confirmation', async () => {
    userMock.value = responsibleUser
    listMock.mockResolvedValue([row()])
    disableMock.mockResolvedValue(row({ status: 'DISABLED' }))

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Désactiver' }))
    const disableButtons = await screen.findAllByRole('button', { name: 'Désactiver' })
    fireEvent.click(disableButtons[disableButtons.length - 1])

    await waitFor(() => expect(disableMock).toHaveBeenCalledWith(1))
  })

  it('supprime un type après confirmation', async () => {
    userMock.value = responsibleUser
    listMock.mockResolvedValue([row()])
    removeMock.mockResolvedValue(undefined)

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer la ligne' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer' }))

    await waitFor(() => expect(removeMock).toHaveBeenCalledWith(1))
  })

  it('refuse une durée non strictement positive', async () => {
    userMock.value = responsibleUser
    listMock.mockResolvedValue([row()])

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Nouveau type' }))
    fireEvent.change(screen.getByLabelText('Type indispo'), {
      target: { value: 'Télétravail' },
    })
    fireEvent.change(screen.getByLabelText('Durée'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(
      await screen.findByText('La durée doit être un nombre strictement positif.'),
    ).toBeInTheDocument()
    expect(createMock).not.toHaveBeenCalled()
  })

  it('n’affiche pas la page pour un rôle non autorisé', async () => {
    userMock.value = managerUser
    listMock.mockResolvedValue([])

    renderPage()

    await waitFor(() =>
      expect(screen.queryByText('Types d’indisponibilités')).not.toBeInTheDocument(),
    )
  })

  it('affiche les libellés de colonnes renommés', async () => {
    userMock.value = responsibleUser
    listMock.mockResolvedValue([row()])

    renderPage()

    await screen.findByText('Congés payés')
    expect(screen.getByText('Unité de durée')).toBeInTheDocument()
    expect(screen.getByText('Statut')).toBeInTheDocument()
    expect(screen.getByText('Type Décompte')).toBeInTheDocument()
  })
})
