import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Unavailability } from './Unavailability'
import { DialogHost } from '../components/dialog'
import type { UnavailabilityDto, UserDto } from '../api/types'

const {
  listMock,
  createMock,
  updateMock,
  submitMock,
  cancelMock,
  validateMock,
  rejectMock,
  invalidateMock,
  historyMock,
  deleteMock,
  summariesMock,
  findByConsultantMock,
  typesMock,
  userMock,
} = vi.hoisted(() => ({
  listMock: vi.fn(),
  createMock: vi.fn(),
  updateMock: vi.fn(),
  submitMock: vi.fn(),
  cancelMock: vi.fn(),
  validateMock: vi.fn(),
  rejectMock: vi.fn(),
  invalidateMock: vi.fn(),
  historyMock: vi.fn(),
  deleteMock: vi.fn(),
  summariesMock: vi.fn(),
  findByConsultantMock: vi.fn(),
  typesMock: vi.fn().mockResolvedValue([
    {
      id: 1,
      socId: 5,
      sortOrder: 0,
      typeLabel: 'Congés payés',
      duration: null,
      countType: null,
      mainConditions: null,
      remuneration: null,
      cpAcquisition: null,
      legalProvision: null,
      collectiveAgreementProvision: null,
      documentRequired: null,
    },
    {
      id: 2,
      socId: 5,
      sortOrder: 1,
      typeLabel: 'Maladie',
      duration: null,
      countType: null,
      mainConditions: null,
      remuneration: null,
      cpAcquisition: null,
      legalProvision: null,
      collectiveAgreementProvision: null,
      documentRequired: null,
    },
  ]),
  userMock: { value: null as unknown as UserDto },
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: userMock.value }),
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

vi.mock('../api/unavailabilityTypes', () => ({
  unavailabilityTypesApi: { list: typesMock, save: vi.fn() },
}))

vi.mock('../api/unavailability', () => ({
  unavailabilityApi: {
    list: listMock,
    create: createMock,
    update: updateMock,
    submit: submitMock,
    cancel: cancelMock,
    validate: validateMock,
    reject: rejectMock,
    invalidate: invalidateMock,
    history: historyMock,
    delete: deleteMock,
  },
}))

vi.mock('../api/consultants', () => ({
  consultantsApi: { summaries: summariesMock, filterList: summariesMock },
}))

vi.mock('../api/cras', () => ({
  crasApi: { findByConsultant: findByConsultantMock },
}))

const baseUser = {
  id: 2,
  username: 'consultant',
  email: 'consultant@soc.fr',
  firstName: 'Alice',
  lastName: 'Martin',
  phone: null,
  role: 'CONSULTANT',
  active: true,
  socId: 5,
  socName: 'SOC Test',
  consultantId: 10,
  mustChangePassword: false,
  lastLoginAt: null,
  pageSize: 5,
} as UserDto

const managerUser = { ...baseUser, id: 1, role: 'MANAGER', consultantId: null } as UserDto

const adminUser = { ...managerUser, id: 9, role: 'ADMIN' } as UserDto

const item = (overrides: Partial<UnavailabilityDto> = {}): UnavailabilityDto => ({
  id: 1,
  consultantId: 10,
  consultantName: 'Alice Martin',
  socId: 5,
  type: 'CONGE_PAYE',
  startDate: '2026-09-01',
  endDate: '2026-09-10',
  status: 'DRAFT',
  comment: null,
  rejectedReason: null,
  submittedAt: null,
  validatedAt: null,
  durationDays: 10,
  ...overrides,
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  userMock.value = null as unknown as UserDto
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/indisponibilites']}>
      <Unavailability />
      <DialogHost />
    </MemoryRouter>,
  )
}

describe('Unavailability', () => {
  it('ouvre l’indisponibilité ciblée via le paramètre ?open', async () => {
    userMock.value = managerUser
    listMock.mockResolvedValue([item()])
    summariesMock.mockResolvedValue([])
    findByConsultantMock.mockResolvedValue([])
    historyMock.mockResolvedValue([])

    render(
      <MemoryRouter initialEntries={['/indisponibilites?open=1']}>
        <Unavailability />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/Calendrier/)).toBeInTheDocument()
  })

  it('affiche les indisponibilités de la date de début la plus récente à la plus ancienne', async () => {
    userMock.value = managerUser
    listMock.mockResolvedValue([
      item({ id: 1, consultantName: 'Alpha', startDate: '2026-09-01', endDate: '2026-09-01' }),
      item({ id: 2, consultantName: 'Beta', startDate: '2026-11-01', endDate: '2026-11-02' }),
      item({ id: 3, consultantName: 'Gamma', startDate: '2026-10-05', endDate: '2026-10-06' }),
    ])
    summariesMock.mockResolvedValue([])
    findByConsultantMock.mockResolvedValue([])

    renderPage()

    await screen.findByText('Beta')
    const expected = ['Beta', 'Gamma', 'Alpha']
    const nodes = expected.map((name) => screen.getByText(name))
    for (let i = 1; i < nodes.length; i++) {
      expect(
        nodes[i - 1].compareDocumentPosition(nodes[i]) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    }
  })

  it('affiche la liste du consultant et le calendrier de l’intervalle sélectionné', async () => {
    userMock.value = baseUser
    listMock.mockResolvedValue([item()])
    findByConsultantMock.mockResolvedValue([])

    renderPage()

    fireEvent.click(await screen.findByText('Alice Martin'))

    expect(await screen.findByText(/Calendrier de l'indisponibilité/)).toBeInTheDocument()
    expect(findByConsultantMock).toHaveBeenCalledWith(10, 2026, 'CONGE')
    expect(findByConsultantMock).toHaveBeenCalledWith(10, 2026, 'CRA')
  })

  it('affiche le motif de rejet lorsqu’on ouvre une indisponibilité rejetée', async () => {
    userMock.value = managerUser
    listMock.mockResolvedValue([
      item({ status: 'REJECTED', rejectedReason: 'Motif de rejet indispo' }),
    ])
    summariesMock.mockResolvedValue([])
    findByConsultantMock.mockResolvedValue([])

    renderPage()

    fireEvent.click(await screen.findByText('Alice Martin'))

    expect(await screen.findByText(/Calendrier de l'indisponibilité/)).toBeInTheDocument()
    // Le motif est présent dans la ligne ET dans le détail de l'objet ouvert.
    expect(screen.getAllByText('Motif de rejet indispo').length).toBeGreaterThan(1)
  })

  it('soumet un brouillon (plusieurs soumissions possibles)', async () => {
    userMock.value = baseUser
    listMock.mockResolvedValue([item({ status: 'DRAFT' })])
    submitMock.mockResolvedValue(item({ status: 'SUBMITTED' }))

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Soumettre' }))

    await waitFor(() => expect(submitMock).toHaveBeenCalledWith(1))
  })

  it('annule une indisponibilité soumise (retour au brouillon)', async () => {
    userMock.value = baseUser
    listMock.mockResolvedValue([item({ status: 'SUBMITTED' })])
    cancelMock.mockResolvedValue(item({ status: 'DRAFT' }))

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Annuler la soumission' }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmer' }))

    await waitFor(() => expect(cancelMock).toHaveBeenCalledWith(1))
  })

  it('permet d’annuler une indisponibilité validée dont on est le collaborateur', async () => {
    userMock.value = managerUser
    listMock.mockResolvedValue([item({ status: 'VALIDATED', consultantId: 1 })])
    summariesMock.mockResolvedValue([])
    cancelMock.mockResolvedValue(item({ status: 'CANCELLED', consultantId: 1 }))

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Annuler l’indisponibilité' }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler l’indisponibilité' }))

    await waitFor(() => expect(cancelMock).toHaveBeenCalledWith(1))
  })

  it('n’édite pas une indisponibilité validée dont on est le collaborateur', async () => {
    userMock.value = managerUser
    listMock.mockResolvedValue([item({ status: 'VALIDATED', consultantId: 1 })])
    summariesMock.mockResolvedValue([])

    renderPage()

    expect(await screen.findByText('Validée')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Éditer' })).not.toBeInTheDocument()
  })

  it('permet à un manager de valider avec un commentaire', async () => {
    userMock.value = managerUser
    listMock.mockResolvedValue([item({ status: 'SUBMITTED' })])
    summariesMock.mockResolvedValue([])
    validateMock.mockResolvedValue(item({ status: 'VALIDATED' }))

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Valider' }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Bon congé' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmer' }))

    await waitFor(() => expect(validateMock).toHaveBeenCalledWith(1, 'Bon congé'))
  })

  it('permet à un manager de rejeter avec un motif', async () => {
    userMock.value = managerUser
    listMock.mockResolvedValue([item({ status: 'SUBMITTED' })])
    summariesMock.mockResolvedValue([])
    rejectMock.mockResolvedValue(item({ status: 'REJECTED' }))

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Rejeter' }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Période non couverte' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmer' }))

    await waitFor(() => expect(rejectMock).toHaveBeenCalledWith(1, 'Période non couverte'))
  })

  it('permet au manager d’invalider une indisponibilité déjà validée', async () => {
    userMock.value = managerUser
    listMock.mockResolvedValue([item({ status: 'VALIDATED' })])
    summariesMock.mockResolvedValue([])
    invalidateMock.mockResolvedValue(item({ status: 'REJECTED' }))

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Invalider' }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Erreur de saisie' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmer' }))

    await waitFor(() => expect(invalidateMock).toHaveBeenCalledWith(1, 'Erreur de saisie'))
  })

  it('n’expose pas l’action Invalider à un consultant', async () => {
    userMock.value = baseUser
    listMock.mockResolvedValue([item({ status: 'VALIDATED' })])
    summariesMock.mockResolvedValue([])

    renderPage()

    expect(await screen.findByText('Validée')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Invalider' })).not.toBeInTheDocument()
  })

  it('n’expose pas l’action Invalider au collaborateur propriétaire', async () => {
    userMock.value = managerUser
    listMock.mockResolvedValue([item({ status: 'VALIDATED', consultantId: 1 })])
    summariesMock.mockResolvedValue([])

    renderPage()

    expect(await screen.findByText('Validée')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Invalider' })).not.toBeInTheDocument()
  })

  it('charge toutes les indisponibilités pour un admin (sans filtre société)', async () => {
    userMock.value = adminUser
    listMock.mockResolvedValue([item({ consultantName: 'Alice Martin' })])
    summariesMock.mockResolvedValue([])

    renderPage()

    await screen.findByText('Alice Martin')
    expect(listMock).toHaveBeenCalledWith({ socId: undefined, consultantId: undefined })
  })

  it('affiche l’historique des modifications', async () => {
    userMock.value = managerUser
    listMock.mockResolvedValue([item({ status: 'VALIDATED' })])
    summariesMock.mockResolvedValue([])
    historyMock.mockResolvedValue([
      {
        id: 1,
        dateModifIndispo: '2026-09-01T10:00:00Z',
        unavailabilityId: 1,
        modifierId: 1,
        modifierName: 'M Manager',
        comment: 'Validation : ok',
        nbEventsBefore: 10,
        nbEventsAfter: 10,
      },
    ])

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Historique' }))

    expect(await screen.findByText('Validation : ok')).toBeInTheDocument()
    expect(historyMock).toHaveBeenCalledWith(1)
  })

  it('permet à un manager de créer une indisponibilité pour lui-même', async () => {
    userMock.value = managerUser
    listMock.mockResolvedValue([])
    summariesMock.mockResolvedValue([{ id: 1, fullName: 'M Manager', position: null, email: null }])
    createMock.mockResolvedValue(item({ consultantId: 1 }))

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Nouvelle indisponibilité' }))
    fireEvent.change(screen.getByTitle('Collaborateur'), { target: { value: '1' } })
    fireEvent.change(screen.getByPlaceholderText(/Motif, remarques/), { target: { value: 'Congés' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer' }))

    await waitFor(() => expect(createMock).toHaveBeenCalled())
    expect(createMock.mock.calls[0][0].consultantId).toBe(1)
  })

  it('affiche le type issu des paramètres de la société et le propose au formulaire', async () => {
    userMock.value = managerUser
    listMock.mockResolvedValue([item({ type: 'Congés payés' })])
    summariesMock.mockResolvedValue([])

    renderPage()

    expect(await screen.findByText('Congés payés')).toBeInTheDocument()
    expect(typesMock).toHaveBeenCalledWith(5)

    fireEvent.click(screen.getByRole('button', { name: 'Nouvelle indisponibilité' }))
    expect(await screen.findByRole('option', { name: 'Maladie' })).toBeInTheDocument()
  })

  it('exige la sélection d’un consultant pour la création par un manager', async () => {
    userMock.value = managerUser
    listMock.mockResolvedValue([])
    summariesMock.mockResolvedValue([{ id: 10, fullName: 'Alice Martin', socId: 5 }])

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Nouvelle indisponibilité' }))
    fireEvent.click(screen.getByRole('button', { name: 'Créer' }))

    expect(await screen.findByText('Sélectionnez un consultant.')).toBeInTheDocument()
    expect(createMock).not.toHaveBeenCalled()
  })

  it('permet au manager de modifier une indisponibilité validée', async () => {
    userMock.value = managerUser
    listMock.mockResolvedValue([item({ status: 'VALIDATED', comment: 'Déjà validée' })])
    summariesMock.mockResolvedValue([])
    updateMock.mockResolvedValue(item({ status: 'VALIDATED' }))

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Éditer' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(updateMock).toHaveBeenCalled())
    expect(updateMock.mock.calls[0][0]).toBe(1)
  })

  it('interdit au consultant de modifier une indisponibilité validée', async () => {
    userMock.value = baseUser
    listMock.mockResolvedValue([item({ status: 'VALIDATED' })])
    findByConsultantMock.mockResolvedValue([])

    renderPage()

    await screen.findByText('Alice Martin')
    expect(screen.queryByRole('button', { name: 'Éditer' })).not.toBeInTheDocument()
  })

  it('affiche le motif quand la création est impossible sans date d’embauche (consultant)', async () => {
    userMock.value = { ...baseUser, hireDate: null } as UserDto
    listMock.mockResolvedValue([])
    summariesMock.mockResolvedValue([])

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Nouvelle indisponibilité' }))
    expect(
      await screen.findByText(/Renseignez votre date d’embauche pour saisir un CRA/i),
    ).toBeInTheDocument()
  })

  it('exige un commentaire pour créer une indisponibilité', async () => {
    userMock.value = { ...baseUser, hireDate: '2020-01-01' } as UserDto
    listMock.mockResolvedValue([])
    summariesMock.mockResolvedValue([])

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Nouvelle indisponibilité' }))
    fireEvent.click(screen.getByRole('button', { name: 'Créer' }))

    expect(await screen.findByText('Le commentaire est obligatoire.')).toBeInTheDocument()
    expect(createMock).not.toHaveBeenCalled()
  })

  it('garde le filtre visible même sans indisponibilité', async () => {
    userMock.value = managerUser
    listMock.mockResolvedValue([])
    summariesMock.mockResolvedValue([])

    renderPage()

    expect(await screen.findByText('Aucune indisponibilité')).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText('Filtrer par type, statut, collaborateur ou dates…'),
    ).toBeInTheDocument()
  })

  it('filtre par mois', async () => {
    userMock.value = managerUser
    listMock.mockResolvedValue([
      item({ id: 1, consultantName: 'Alice Martin', startDate: '2026-09-01', endDate: '2026-09-10' }),
      item({ id: 2, consultantName: 'Bob Dupont', startDate: '2026-11-01', endDate: '2026-11-05' }),
    ])
    summariesMock.mockResolvedValue([])

    renderPage()

    await screen.findByText('Alice Martin')
    fireEvent.click(screen.getByTitle('Filtrer par mois'))
    fireEvent.click(await screen.findByText('nov.'))

    expect(await screen.findByText('Bob Dupont')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Alice Martin')).not.toBeInTheDocument())
  })

  it('filtre par commentaire', async () => {
    userMock.value = managerUser
    listMock.mockResolvedValue([
      item({ id: 1, consultantName: 'Alice Martin', comment: 'Congé d’été' }),
      item({ id: 2, consultantName: 'Bob Dupont', comment: 'Rendez-vous médical' }),
    ])
    summariesMock.mockResolvedValue([])

    renderPage()

    await screen.findByText('Alice Martin')
    fireEvent.change(screen.getByPlaceholderText('Filtrer par type, statut, collaborateur ou dates…'), {
      target: { value: 'médical' },
    })

    expect(await screen.findByText('Bob Dupont')).toBeInTheDocument()
    expect(screen.queryByText('Alice Martin')).not.toBeInTheDocument()
  })
})
