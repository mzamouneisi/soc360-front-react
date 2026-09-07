import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ApiError } from '../api/client'
import { CraList } from './CraList'
import type { CraDto, UserDto } from '../api/types'

const {
  findByConsultantMock,
  findBySocYearMock,
  getOrCreateMock,
  getByIdMock,
  validateMock,
  rejectMock,
  deleteMock,
  userMock,
} = vi.hoisted(() => ({
  findByConsultantMock: vi.fn(),
  findBySocYearMock: vi.fn(),
  getOrCreateMock: vi.fn(),
  getByIdMock: vi.fn(),
  validateMock: vi.fn(),
  rejectMock: vi.fn(),
  deleteMock: vi.fn(),
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

vi.mock('../api/activities', () => ({
  activitiesApi: {
    findAll: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('../api/cras', () => ({
  crasApi: {
    getOrCreate: getOrCreateMock,
    getById: getByIdMock,
    findByConsultant: findByConsultantMock,
    findBySocYear: findBySocYearMock,
    save: vi.fn(),
    submit: vi.fn(),
    validate: validateMock,
    reject: rejectMock,
    delete: deleteMock,
    exchanges: vi.fn(),
  },
}))

const managerUser = {
  id: 1,
  username: 'manager',
  email: 'manager@soc.fr',
  firstName: 'M',
  lastName: 'Manager',
  phone: null,
  role: 'MANAGER',
  active: true,
  socId: 5,
  socName: 'SOC Test',
  consultantId: null,
  mustChangePassword: false,
  lastLoginAt: null,
} as UserDto

const consultantUser = {
  ...managerUser,
  id: 2,
  role: 'CONSULTANT',
  socId: null,
  socName: null,
  consultantId: 10,
} as UserDto

const cra = (overrides: Partial<CraDto> = {}): CraDto => ({
  id: 1,
  consultantId: 10,
  consultantName: 'Alice Martin',
  managerId: 1,
  month: 8,
  year: 2026,
  type: 'CRA',
  status: 'SUBMITTED',
  totalWorkedDays: 21,
  totalHours: 151.5,
  submittedAt: null,
  validatedAt: null,
  comment: null,
  days: [],
  ...overrides,
})

function stubFixedNow() {
  const RealDate = Date
  const fixed = new RealDate(2026, 7, 15, 12, 0, 0)
  vi.stubGlobal(
    'Date',
    class extends RealDate {
      constructor() {
        super(fixed.getTime())
      }
      static now() {
        return RealDate.now()
      }
    },
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  userMock.value = null as unknown as UserDto
})

function renderList() {
  return render(
    <MemoryRouter initialEntries={['/cras']}>
      <CraList />
    </MemoryRouter>,
  )
}

describe('CraList', () => {
  it('affiche les CRA de l’année pour un manager', async () => {
    userMock.value = managerUser
    findBySocYearMock.mockResolvedValue([
      cra(),
      cra({ id: 2, consultantName: 'Bob Dupont', month: 7 }),
    ])

    renderList()

    expect(await screen.findByText('Alice Martin')).toBeInTheDocument()
    expect(findBySocYearMock).toHaveBeenCalledWith(5, 2026)
    expect(screen.getAllByText('Soumis').length).toBeGreaterThan(0)
    expect(screen.getAllByText('21 j').length).toBeGreaterThan(0)
    expect(screen.getByText('Bob Dupont')).toBeInTheDocument()
  })

  it('valide un CRA soumis', async () => {
    userMock.value = managerUser
    findBySocYearMock.mockResolvedValue([cra()])
    validateMock.mockResolvedValue(cra({ status: 'VALIDATED' }))

    renderList()

    fireEvent.click(await screen.findByRole('button', { name: 'Valider' }))

    await waitFor(() => expect(validateMock).toHaveBeenCalledWith(1))
  })

  it('rejette un CRA avec le motif saisi', async () => {
    userMock.value = managerUser
    findBySocYearMock.mockResolvedValue([cra()])
    rejectMock.mockResolvedValue(cra({ status: 'REJECTED' }))
    vi.stubGlobal('prompt', vi.fn().mockReturnValue('Facture en double'))

    renderList()

    fireEvent.click(await screen.findByRole('button', { name: 'Rejeter' }))

    await waitFor(() => expect(rejectMock).toHaveBeenCalledWith(1, 'Facture en double'))
  })

  it('supprime un CRA non soumis et n’affiche pas l’action pour un CRA soumis', async () => {
    userMock.value = managerUser
    findBySocYearMock.mockResolvedValue([
      cra({ status: 'DRAFT', consultantName: 'Carla Draft' }),
      cra({ id: 2, consultantName: 'Bob Soumis', status: 'SUBMITTED' }),
    ])
    deleteMock.mockResolvedValue(undefined)
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))

    renderList()

    await screen.findByText('Carla Draft')

    expect(screen.getByRole('button', { name: 'Éditer' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ouvrir' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Supprimer' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))

    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith(1))
  })

  it('affiche l’état vide et crée le CRA du mois pour un consultant', async () => {
    userMock.value = consultantUser
    findByConsultantMock.mockResolvedValue([])
    getOrCreateMock.mockResolvedValue(cra({ id: 99 }))
    getByIdMock.mockResolvedValue(cra({ id: 99 }))
    stubFixedNow()

    renderList()

    expect(await screen.findByText('Aucun CRA pour cette année')).toBeInTheDocument()
    expect(findByConsultantMock).toHaveBeenCalledWith(10, 2026)

    fireEvent.click(screen.getByRole('button', { name: 'Nouveau Cra' }))

    await waitFor(() => expect(getOrCreateMock).toHaveBeenCalledWith(10, 2026, 8, 'CRA'))
  })

  it('affiche tous les CRA de l’année pour un consultant sans action de validation', async () => {
    userMock.value = consultantUser
    findByConsultantMock.mockResolvedValue([
      cra(),
      cra({ id: 2, consultantName: 'Bob Dupont', month: 7 }),
    ])

    renderList()

    expect(await screen.findByText('Alice Martin')).toBeInTheDocument()
    expect(screen.getByText('Bob Dupont')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Valider' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rejeter' })).not.toBeInTheDocument()
  })

  it('affiche l’erreur API dans un bloc d’erreur', async () => {
    userMock.value = managerUser
    findBySocYearMock.mockRejectedValue(new ApiError(500, 'Erreur serveur'))

    renderList()

    expect(await screen.findByText('Erreur serveur')).toBeInTheDocument()
  })
})
