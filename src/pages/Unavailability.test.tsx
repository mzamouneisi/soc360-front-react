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
  documentsDeleteMock,
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
  documentsDeleteMock: vi.fn(),
  typesMock: vi.fn().mockResolvedValue([
    {
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
      mainCondition: null,
      status: 'ACTIVE',
    },
    {
      id: 2,
      socId: 5,
      sortOrder: 1,
      name: 'Maladie',
      durationValue: 1,
      durationUnit: 'YEARS',
      countType: 'CALENDAIRE',
      remuneration: true,
      paidLeaveAccrual: true,
      providedByLaw: true,
      providedByCollectiveAgreement: true,
      documentRequired: true,
      mainCondition: null,
      status: 'ACTIVE',
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
  unavailabilityTypesApi: {
    list: vi.fn(),
    active: typesMock,
    create: vi.fn(),
    update: vi.fn(),
    disable: vi.fn(),
    remove: vi.fn(),
  },
}))

vi.mock('../api/documents', () => ({
  documentsApi: {
    upload: vi.fn(),
    delete: documentsDeleteMock,
    download: vi.fn(),
    previewUrl: vi.fn().mockResolvedValue('blob:preview'),
  },
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
  firstDay: 'ALL',
  lastDay: 'ALL',
  countType: 'CALENDAIRE',
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

  it('limite la largeur du commentaire à la somme Collaborateur + Type', async () => {
    userMock.value = managerUser
    listMock.mockResolvedValue([])
    summariesMock.mockResolvedValue([])

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Nouvelle indisponibilité' }))
    const textarea = screen.getByPlaceholderText(/Motif, remarques/)
    const wrapper = textarea.parentElement?.parentElement as HTMLElement

    expect(wrapper.style.maxWidth).toBe('28.75rem')
  })

  it('ouvre le formulaire d’édition en cliquant sur une ligne', async () => {
    userMock.value = managerUser
    listMock.mockResolvedValue([item({ status: 'DRAFT' })])
    summariesMock.mockResolvedValue([])
    findByConsultantMock.mockResolvedValue([])

    renderPage()

    fireEvent.click(await screen.findByText('Alice Martin'))

    expect(
      await screen.findByText('Modifier l’indisponibilité'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeInTheDocument()
  })

  it('affiche le document joint quand on clique sur une indisponibilité', async () => {
    userMock.value = baseUser
    listMock.mockResolvedValue([
      item({ documentId: 55, documentName: 'justificatif.pdf', documentComment: 'Arrêt' }),
    ])
    findByConsultantMock.mockResolvedValue([])

    renderPage()

    fireEvent.click(await screen.findByText('Alice Martin'))

    expect((await screen.findAllByText('justificatif.pdf')).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Voir le document' }).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Arrêt/).length).toBeGreaterThan(0)
    const preview = document.getElementById('document.attachment.preview')
    expect(preview?.className).toContain('w-96')
    expect(preview?.className).toContain('h-80')
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

  it('n’expose pas les actions Valider/Rejeter au manager propriétaire', async () => {
    userMock.value = managerUser
    listMock.mockResolvedValue([item({ status: 'SUBMITTED', consultantId: managerUser.id })])
    summariesMock.mockResolvedValue([])

    renderPage()

    expect(await screen.findByText('Soumise')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Valider' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rejeter' })).not.toBeInTheDocument()
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

  function todayInputValue(): string {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate(),
    ).padStart(2, '0')}`
  }

  it('pré-remplit la date du jour et le collaborateur connecté', async () => {
    userMock.value = managerUser
    listMock.mockResolvedValue([])
    summariesMock.mockResolvedValue([
      { id: 1, fullName: 'M Manager', position: null, email: null },
    ])
    findByConsultantMock.mockResolvedValue([])

    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Nouvelle indisponibilité' }))

    const today = todayInputValue()
    const todayDisplay = today.split('-').reverse().join('/')
    const startInput = document.querySelector('#Unavailability\\.du')
      ?.parentElement?.querySelector('input') as HTMLInputElement
    const endInput = document.querySelector('#Unavailability\\.au')
      ?.parentElement?.querySelector('input') as HTMLInputElement
    expect(startInput.value).toBe(todayDisplay)
    expect(endInput.value).toBe(todayDisplay)
    expect(screen.getByTitle('Collaborateur')).toHaveValue('1')

  })

  it('désactive le bouton Créer quand le collaborateur obligatoire manque', async () => {
    userMock.value = managerUser
    listMock.mockResolvedValue([])
    summariesMock.mockResolvedValue([
      { id: 1, fullName: 'M Manager', position: null, email: null },
    ])
    findByConsultantMock.mockResolvedValue([])

    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Nouvelle indisponibilité' }))

    fireEvent.change(screen.getByTitle('Collaborateur'), { target: { value: '' } })

    expect(screen.getByRole('button', { name: 'Créer' })).toBeDisabled()
  })

  it('calcule la durée selon le type de décompte (ouvré = hors week-end)', async () => {
    userMock.value = { ...baseUser, hireDate: '2020-01-01' } as UserDto
    listMock.mockResolvedValue([])
    findByConsultantMock.mockResolvedValue([])

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Nouvelle indisponibilité' }))
    await waitFor(() =>
      expect(document.querySelector('#Unavailability\\.du')).not.toBeNull(),
    )
    const startInput = document.querySelector('#Unavailability\\.du')
      ?.parentElement?.querySelector('input') as HTMLInputElement
    const endInput = document.querySelector('#Unavailability\\.au')
      ?.parentElement?.querySelector('input') as HTMLInputElement
    fireEvent.change(startInput, { target: { value: '2026-11-06' } })
    fireEvent.change(endInput, { target: { value: '2026-11-09' } })

    expect(await screen.findByText('Durée : 2 j')).toBeInTheDocument()
  })

  it('envoie une demi-journée pour une indisponibilité d’un seul jour', async () => {
    userMock.value = { ...baseUser, hireDate: '2020-01-01' } as UserDto
    listMock.mockResolvedValue([])
    findByConsultantMock.mockResolvedValue([])
    createMock.mockResolvedValue(item())

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Nouvelle indisponibilité' }))
    const startInput = document.querySelector('#Unavailability\\.du')
      ?.parentElement?.querySelector('input') as HTMLInputElement
    const endInput = document.querySelector('#Unavailability\\.au')
      ?.parentElement?.querySelector('input') as HTMLInputElement
    fireEvent.change(endInput, { target: { value: startInput.value } })

    const dayPart = (await screen.findByText('Demi-journée')).parentElement
      ?.querySelector('select') as HTMLSelectElement
    fireEvent.change(dayPart, { target: { value: 'PM' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer' }))

    await waitFor(() => expect(createMock).toHaveBeenCalled())
    const request = createMock.mock.calls[0][0]
    expect(request.firstDay).toBe('PM')
    expect(request.lastDay).toBe('PM')
  })

  it('envoie un après-midi au début et un matin à la fin sur plusieurs jours', async () => {
    userMock.value = { ...baseUser, hireDate: '2020-01-01' } as UserDto
    listMock.mockResolvedValue([])
    findByConsultantMock.mockResolvedValue([])
    createMock.mockResolvedValue(item())

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Nouvelle indisponibilité' }))
    const startDateInput = document.querySelector('#Unavailability\\.du')
      ?.parentElement?.querySelector('input') as HTMLInputElement
    const endDateInput = document.querySelector('#Unavailability\\.au')
      ?.parentElement?.querySelector('input') as HTMLInputElement
    fireEvent.change(startDateInput, { target: { value: '2026-11-06' } })
    fireEvent.change(endDateInput, { target: { value: '2026-11-09' } })
    const startPart = screen.getByText('Début').parentElement
      ?.querySelector('select') as HTMLSelectElement
    const endPart = screen.getByText('Fin').parentElement
      ?.querySelector('select') as HTMLSelectElement
    fireEvent.change(startPart, { target: { value: 'PM' } })
    fireEvent.change(endPart, { target: { value: 'AM' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer' }))

    await waitFor(() => expect(createMock).toHaveBeenCalled())
    const request = createMock.mock.calls[0][0]
    expect(request.firstDay).toBe('PM')
    expect(request.lastDay).toBe('AM')
  })

  it('recharge les demi-journées à l’édition et les affiche dans le calendrier', async () => {
    userMock.value = managerUser
    listMock.mockResolvedValue([
      item({
        comment: 'Motif',
        startDate: '2026-09-03',
        endDate: '2026-09-04',
        firstDay: 'PM',
        lastDay: 'AM',
        halfDays: [
          { date: '2026-09-03', halfDay: 'PM' },
          { date: '2026-09-04', halfDay: 'AM' },
        ],
      }),
    ])
    summariesMock.mockResolvedValue([])
    findByConsultantMock.mockResolvedValue([])
    updateMock.mockResolvedValue(item())

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Éditer' }))

    const startPart = screen.getByText('Début').parentElement
      ?.querySelector('select') as HTMLSelectElement
    const endPart = screen.getByText('Fin').parentElement
      ?.querySelector('select') as HTMLSelectElement
    expect(startPart.value).toBe('PM')
    expect(endPart.value).toBe('AM')
    // L'aperçu du calendrier marque les deux demi-journées de l'indisponibilité courante.
    expect(await screen.findAllByText('aprèm')).toHaveLength(1)
    expect(screen.getAllByText('matin')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(updateMock).toHaveBeenCalled())
    expect(updateMock.mock.calls[0][1].firstDay).toBe('PM')
    expect(updateMock.mock.calls[0][1].lastDay).toBe('AM')
  })

  it('désactive les week-ends dans le calendrier pour un type ouvré', async () => {
    userMock.value = managerUser
    listMock.mockResolvedValue([])
    summariesMock.mockResolvedValue([{ id: 1, fullName: 'Alice Martin', socId: 5 }])
    findByConsultantMock.mockResolvedValue([])

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Nouvelle indisponibilité' }))
    fireEvent.change(screen.getByTitle('Collaborateur'), { target: { value: '1' } })
    await waitFor(() =>
      expect(document.querySelector('#Unavailability\\.du')).not.toBeNull(),
    )
    const startInput = document.querySelector('#Unavailability\\.du')
      ?.parentElement?.querySelector('input') as HTMLInputElement
    fireEvent.click(startInput)

    const weekendDays = document.querySelectorAll('.react-datepicker__day--weekend')
    expect(weekendDays.length).toBeGreaterThan(0)
    weekendDays.forEach((day) => expect(day.className).toContain('day--disabled'))
  })

  it('autorise un intervalle ouvré contenant un week-end', async () => {
    userMock.value = managerUser
    listMock.mockResolvedValue([])
    summariesMock.mockResolvedValue([{ id: 1, fullName: 'Alice Martin', socId: 5 }])
    findByConsultantMock.mockResolvedValue([])
    createMock.mockResolvedValue(item())

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Nouvelle indisponibilité' }))
    fireEvent.change(screen.getByTitle('Collaborateur'), { target: { value: '1' } })
    await waitFor(() =>
      expect(document.querySelector('#Unavailability\\.du')).not.toBeNull(),
    )
    const startInput = document.querySelector('#Unavailability\\.du')
      ?.parentElement?.querySelector('input') as HTMLInputElement
    const endInput = document.querySelector('#Unavailability\\.au')
      ?.parentElement?.querySelector('input') as HTMLInputElement
    fireEvent.change(startInput, { target: { value: '2026-11-06' } })
    fireEvent.change(endInput, { target: { value: '2026-11-09' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer' }))

    await waitFor(() => expect(createMock).toHaveBeenCalled())
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

  it('crée par défaut pour le manager connecté', async () => {
    userMock.value = managerUser
    listMock.mockResolvedValue([])
    summariesMock.mockResolvedValue([{ id: 10, fullName: 'Alice Martin', socId: 5 }])
    createMock.mockResolvedValue(item({ consultantId: 1 }))

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Nouvelle indisponibilité' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Créer' })).toBeEnabled(),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Créer' }))

    await waitFor(() => expect(createMock).toHaveBeenCalled())
    expect(createMock.mock.calls[0][0].consultantId).toBe(1)
  })

  it('permet au propriétaire de modifier et resoumettre une indisponibilité annulée', async () => {
    userMock.value = managerUser
    listMock.mockResolvedValue([item({ status: 'CANCELLED', consultantId: 1 })])
    summariesMock.mockResolvedValue([])
    findByConsultantMock.mockResolvedValue([])
    submitMock.mockResolvedValue(item({ status: 'SUBMITTED', consultantId: 1 }))

    renderPage()
    await screen.findByText('Annulée')

    expect(screen.getByRole('button', { name: 'Soumettre' })).toBeInTheDocument()
    fireEvent.click(document.getElementById('Unavailability.row.1') as HTMLElement)
    expect(await screen.findByRole('button', { name: 'Enregistrer' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Soumettre' }))
    await waitFor(() => expect(submitMock).toHaveBeenCalledWith(1))
  })

  it('affiche en lecture seule l’indisponibilité validée du propriétaire', async () => {
    userMock.value = managerUser
    listMock.mockResolvedValue([
      item({
        status: 'VALIDATED',
        consultantId: 1,
        documentId: 77,
        documentName: 'facture.pdf',
      }),
    ])
    summariesMock.mockResolvedValue([
      { id: 1, fullName: 'M Manager', position: null, email: null },
    ])
    findByConsultantMock.mockResolvedValue([])

    renderPage()
    await screen.findByText('Validée')
    fireEvent.click(document.getElementById('Unavailability.row.1') as HTMLElement)

    expect(
      await screen.findByText('Lecture seule : cette indisponibilité est validée.'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Enregistrer' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fermer' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Retirer le document' }),
    ).toBeDisabled()
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

  it('permet de créer une indisponibilité sans commentaire', async () => {
    userMock.value = { ...baseUser, hireDate: '2020-01-01' } as UserDto
    listMock.mockResolvedValue([])
    summariesMock.mockResolvedValue([])
    createMock.mockResolvedValue(item())

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Nouvelle indisponibilité' }))
    fireEvent.click(screen.getByRole('button', { name: 'Créer' }))

    await waitFor(() => expect(createMock).toHaveBeenCalled())
    expect(createMock.mock.calls[0][0].comment).toBeNull()
    expect(createMock.mock.calls[0][0].firstDay).toBe('ALL')
    expect(createMock.mock.calls[0][0].lastDay).toBe('ALL')
  })

  it('propose à un manager d’ajouter un document dans sa saisie d’indisponibilité', async () => {
    userMock.value = { ...managerUser, hireDate: '2020-01-01' } as UserDto
    listMock.mockResolvedValue([])
    summariesMock.mockResolvedValue([{ id: 10, fullName: 'Alice Martin', socId: 5 }])

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Nouvelle indisponibilité' }))
    expect(await screen.findByRole('button', { name: 'Ajouter un document' })).toBeEnabled()
  })

  it('supprime de la base le document retiré d’une indispo existante', async () => {
    userMock.value = managerUser
    listMock.mockResolvedValue([
      item({
        id: 1,
        documentId: 55,
        documentName: 'justificatif.pdf',
        documentComment: 'Arrêt',
      }),
    ])
    summariesMock.mockResolvedValue([])
    findByConsultantMock.mockResolvedValue([])
    updateMock.mockResolvedValue(item())
    documentsDeleteMock.mockResolvedValue(undefined)

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Éditer' }))
    expect((await screen.findAllByText('justificatif.pdf')).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Retirer le document' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(updateMock).toHaveBeenCalled())
    await waitFor(() => expect(documentsDeleteMock).toHaveBeenCalledWith(55))
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
