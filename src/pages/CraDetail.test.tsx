import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CraDetail } from './CraDetail'
import { DialogHost } from '../components/dialog'
import { setTranslationState } from '../i18n/translate'
import type { CraDto, UserDto } from '../api/types'

const {
  getByIdMock,
  saveMock,
  validateMock,
  invalidateRangeMock,
  historyMock,
  declareAbsenceMock,
  absenceValidateMock,
  absenceRejectMock,
  activitiesFindAllMock,
  holidaysFindByCountryYearMock,
  socHolidaysListMock,
  userMock,
} = vi.hoisted(() => ({
  getByIdMock: vi.fn(),
  saveMock: vi.fn(),
  validateMock: vi.fn(),
  invalidateRangeMock: vi.fn(),
  historyMock: vi.fn(),
  declareAbsenceMock: vi.fn(),
  absenceValidateMock: vi.fn(),
  absenceRejectMock: vi.fn(),
  activitiesFindAllMock: vi.fn(),
  holidaysFindByCountryYearMock: vi.fn(),
  socHolidaysListMock: vi.fn(),
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

vi.mock('../api/cras', () => ({
  crasApi: {
    getById: getByIdMock,
    save: saveMock,
    validate: validateMock,
    invalidateRange: invalidateRangeMock,
    history: historyMock,
    declareAbsence: declareAbsenceMock,
  },
}))

vi.mock('../api/unavailability', () => ({
  unavailabilityApi: {
    validate: absenceValidateMock,
    reject: absenceRejectMock,
  },
}))

vi.mock('../api/activities', () => ({
  activitiesApi: {
    findAll: activitiesFindAllMock,
  },
}))

vi.mock('../api/holidays', () => ({
  holidaysApi: {
    findByCountryYear: holidaysFindByCountryYearMock,
  },
}))

vi.mock('../api/socHolidays', () => ({
  socHolidaysApi: {
    list: socHolidaysListMock,
  },
}))

afterEach(() => {
  vi.clearAllMocks()
  setTranslationState('fr', {})
  userMock.value = null as unknown as UserDto
})

function buildDays(valid: boolean): CraDto['days'] {
  return Array.from({ length: 31 }, (_, i) => {
    const isWeekend = new Date(2026, 7, i + 1).getDay() % 6 === 0
    return {
      id: i + 1,
      date: `2026-08-${String(i + 1).padStart(2, '0')}`,
      dayType: isWeekend ? 'WEEKEND' : 'WORKED',
      workedHours: isWeekend ? 0 : 7.5,
      hours: 1,
      comment: null,
      activities: isWeekend
        ? []
        : [
            {
              id: i + 1,
              activityId: 5,
              activityName: 'Développement',
              activityColor: null,
              hours: 7.5,
              days: 1,
              valid,
              comment: null,
            },
          ],
    }
  })
}

function cra(valid: boolean, status: CraDto['status']): CraDto {
  return {
    id: 1,
    consultantId: 10,
    consultantName: 'Alice Martin',
    managerId: 1,
    month: 8,
    year: 2026,
    type: 'CRA',
    status,
    totalWorkedDays: 21,
    totalHours: 151.5,
    submittedAt: null,
    validatedAt: null,
    comment: null,
    days: buildDays(valid),
  }
}

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
} as UserDto

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/cras/1']}>
      <CraDetail id={1} />
    </MemoryRouter>,
  )
}

describe('CraDetail', () => {
  it('bascule Valider tout / Invalider tout sur un CRA validé', async () => {
    userMock.value = managerUser
    const validated = cra(true, 'VALIDATED')
    const rejected = cra(false, 'REJECTED')

    getByIdMock.mockResolvedValue(validated)
    saveMock.mockResolvedValue(validated)
    invalidateRangeMock.mockResolvedValue(rejected)
    validateMock.mockResolvedValue(validated)
    activitiesFindAllMock.mockResolvedValue([])
    holidaysFindByCountryYearMock.mockResolvedValue([])
    socHolidaysListMock.mockResolvedValue([])

    renderDetail()

    await screen.findByText('Alice Martin', { exact: false }, { timeout: 3000 })
    const valider = screen.getByRole('button', { name: 'Valider tout' })
    const invalider = screen.getByRole('button', { name: 'Invalider tout' })

    await waitFor(() => expect(valider).toBeDisabled())
    await waitFor(() => expect(invalider).toBeEnabled())

    fireEvent.click(invalider)

    await waitFor(() => expect(valider).toBeEnabled())
    await waitFor(() => expect(invalider).toBeDisabled())
    expect(invalidateRangeMock).toHaveBeenCalledWith(1, '2026-08-01', '2026-08-31')

    fireEvent.click(valider)

    await waitFor(() => expect(valider).toBeDisabled())
    await waitFor(() => expect(invalider).toBeEnabled())
    expect(validateMock).toHaveBeenCalledWith(1)
  })

  it('active Valider tout et Invalider tout si des événements actifs et inactifs coexistent', async () => {
    userMock.value = managerUser
    const mixed = cra(true, 'SUBMITTED')
    mixed.days[2].activities[0].valid = false

    getByIdMock.mockResolvedValue(mixed)
    activitiesFindAllMock.mockResolvedValue([])
    holidaysFindByCountryYearMock.mockResolvedValue([])
    socHolidaysListMock.mockResolvedValue([])

    renderDetail()

    await screen.findByText('Alice Martin', { exact: false }, { timeout: 3000 })
    const valider = screen.getByRole('button', { name: 'Valider tout' })
    const invalider = screen.getByRole('button', { name: 'Invalider tout' })

    await waitFor(() => expect(valider).toBeEnabled())
    await waitFor(() => expect(invalider).toBeEnabled())
  })

  it('désactive Valider tout et Invalider tout si aucun événement n’est présent', async () => {
    userMock.value = managerUser
    const empty = cra(true, 'SUBMITTED')
    empty.days = empty.days.map((d) => ({ ...d, activities: [] }))

    getByIdMock.mockResolvedValue(empty)
    activitiesFindAllMock.mockResolvedValue([])
    holidaysFindByCountryYearMock.mockResolvedValue([])
    socHolidaysListMock.mockResolvedValue([])

    renderDetail()

    await screen.findByText('Alice Martin', { exact: false }, { timeout: 3000 })
    const valider = screen.getByRole('button', { name: 'Valider tout' })
    const invalider = screen.getByRole('button', { name: 'Invalider tout' })

    await waitFor(() => expect(valider).toBeDisabled())
    await waitFor(() => expect(invalider).toBeDisabled())
  })

  it('affiche l’historique des modifications du CRA', async () => {
    userMock.value = managerUser
    const validated = cra(true, 'VALIDATED')

    getByIdMock.mockResolvedValue(validated)
    historyMock.mockResolvedValue([
      {
        id: 1,
        dateModif: '2026-08-01T10:00:00Z',
        craId: 1,
        modifierId: 10,
        modifierName: 'Alice Martin',
        comment: 'Soumission',
        statusBefore: 'DRAFT',
        statusAfter: 'SUBMITTED',
      },
    ])
    activitiesFindAllMock.mockResolvedValue([])
    holidaysFindByCountryYearMock.mockResolvedValue([])
    socHolidaysListMock.mockResolvedValue([])

    renderDetail()

    await screen.findByText('Alice Martin', { exact: false }, { timeout: 3000 })
    fireEvent.click(screen.getByRole('button', { name: 'Historique' }))

    await waitFor(() => expect(historyMock).toHaveBeenCalledWith(1))
    expect(await screen.findByText('Soumission')).toBeInTheDocument()
    expect(screen.getByText('Brouillon')).toBeInTheDocument()
    expect(screen.getByText('Soumis')).toBeInTheDocument()
  })

  it('affiche un message info si l’activité choisie n’autorise pas le week-end', async () => {
    userMock.value = managerUser
    const draft = cra(true, 'DRAFT')

    getByIdMock.mockResolvedValue(draft)
    activitiesFindAllMock.mockResolvedValue([
      {
        id: 5,
        name: 'Développement',
        description: null,
        price: 0,
        currency: 'EUR',
        startDate: null,
        endDate: null,
        type: null,
        project: null,
        consultant: null,
        soc: null,
        active: true,
        indispo: false,
        weekendAllowed: false,
        holidayAllowed: false,
      },
    ])
    holidaysFindByCountryYearMock.mockResolvedValue([])
    socHolidaysListMock.mockResolvedValue([])

    renderDetail()

    await screen.findByText('Alice Martin', { exact: false }, { timeout: 3000 })
    const addButtons = await screen.findAllByRole('button', { name: 'Ajouter un événement' })
    fireEvent.click(addButtons[0])

    fireEvent.click(await screen.findByRole('button', { name: '+ Ajouter un événement' }))

    const selects = await screen.findAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: '5' } })

    expect(await screen.findByText('Information')).toBeInTheDocument()
    expect(screen.getByText(/autorise pas le week-end/)).toBeInTheDocument()
    expect((screen.getAllByRole('combobox')[0] as HTMLSelectElement).value).toBe('')
  })

  it('ajoute l’activité sélectionnée si elle autorise le week-end', async () => {
    userMock.value = managerUser
    const draft = cra(true, 'DRAFT')

    getByIdMock.mockResolvedValue(draft)
    activitiesFindAllMock.mockResolvedValue([
      {
        id: 7,
        name: 'Astreinte',
        description: null,
        price: 0,
        currency: 'EUR',
        startDate: null,
        endDate: null,
        type: null,
        project: null,
        consultant: null,
        soc: null,
        active: true,
        indispo: false,
        weekendAllowed: true,
        holidayAllowed: false,
      },
    ])
    holidaysFindByCountryYearMock.mockResolvedValue([])
    socHolidaysListMock.mockResolvedValue([])

    renderDetail()

    await screen.findByText('Alice Martin', { exact: false }, { timeout: 3000 })
    const addButtons = await screen.findAllByRole('button', { name: 'Ajouter un événement' })
    fireEvent.click(addButtons[0])
    fireEvent.click(await screen.findByRole('button', { name: '+ Ajouter un événement' }))

    const selects = await screen.findAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: '7' } })

    expect(screen.queryByText('Information')).not.toBeInTheDocument()
    expect((screen.getAllByRole('combobox')[0] as HTMLSelectElement).value).toBe('7')
  })

  it('rend non modifiable le jour couvert par une indisponibilité validée (consultant)', async () => {
    userMock.value = {
      id: 10,
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
    } as UserDto

    const draft = cra(true, 'DRAFT')
    draft.days[0] = {
      ...draft.days[0],
      dayType: 'LEAVE',
      unavailable: true,
      activities: [
        {
          id: 99,
          activityId: 5,
          activityName: 'Congé payé',
          activityColor: null,
          hours: 0,
          days: 1,
          valid: true,
          comment: null,
        },
      ],
    }

    getByIdMock.mockResolvedValue(draft)
    activitiesFindAllMock.mockResolvedValue([])
    holidaysFindByCountryYearMock.mockResolvedValue([])
    socHolidaysListMock.mockResolvedValue([])

    renderDetail()

    await screen.findByText('Alice Martin', { exact: false }, { timeout: 3000 })
    fireEvent.click(screen.getByRole('button', { name: 'Ligne' }))

    const selects = await screen.findAllByRole('combobox')
    await waitFor(() => expect((selects[0] as HTMLSelectElement).disabled).toBe(true))
  })

  it('un CRA validé reste annulable par son propriétaire', async () => {
    userMock.value = {
      id: 10,
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
    } as UserDto

    getByIdMock.mockResolvedValue(cra(true, 'VALIDATED'))
    activitiesFindAllMock.mockResolvedValue([])
    holidaysFindByCountryYearMock.mockResolvedValue([])
    socHolidaysListMock.mockResolvedValue([])

    renderDetail()

    await screen.findByText('Alice Martin', { exact: false }, { timeout: 3000 })
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeInTheDocument()
  })

  it('un propriétaire ne peut pas invalider son propre CRA', async () => {
    userMock.value = {
      id: 10,
      username: 'responsable',
      email: 'responsable@soc.fr',
      firstName: 'Alice',
      lastName: 'Martin',
      phone: null,
      role: 'RESPONSIBLE_SOC',
      active: true,
      socId: 5,
      socName: 'SOC Test',
      consultantId: null,
    } as UserDto

    getByIdMock.mockResolvedValue(cra(true, 'VALIDATED'))
    activitiesFindAllMock.mockResolvedValue([])
    holidaysFindByCountryYearMock.mockResolvedValue([])
    socHolidaysListMock.mockResolvedValue([])

    renderDetail()

    await screen.findByText('Alice Martin', { exact: false }, { timeout: 3000 })
    expect(screen.queryByRole('button', { name: 'Invalider tout' })).not.toBeInTheDocument()
  })

  it('un consultant ne peut pas supprimer les événements validés (supprimer tous)', async () => {
    userMock.value = {
      id: 10,
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
    } as UserDto

    const draft = cra(true, 'DRAFT')
    draft.days = draft.days.map((d, i) => ({
      ...d,
      dayType: 'WORKED',
      activities:
        i === 0
          ? [
              {
                id: 101,
                activityId: 5,
                activityName: 'Congé payé',
                activityColor: null,
                hours: 0,
                days: 1,
                valid: true,
                comment: null,
              },
            ]
          : i === 1
            ? [
                {
                  id: 102,
                  activityId: 6,
                  activityName: 'Développement',
                  activityColor: null,
                  hours: 0,
                  days: 1,
                  valid: false,
                  comment: null,
                },
              ]
            : [],
    }))

    getByIdMock.mockResolvedValue(draft)
    activitiesFindAllMock.mockResolvedValue([
      {
        id: 5,
        name: 'Congé payé',
        description: null,
        price: 0,
        currency: 'EUR',
        startDate: null,
        endDate: null,
        type: null,
        project: null,
        consultant: null,
        soc: null,
        active: true,
        indispo: true,
        weekendAllowed: false,
        holidayAllowed: false,
      },
      {
        id: 6,
        name: 'Développement',
        description: null,
        price: 0,
        currency: 'EUR',
        startDate: null,
        endDate: null,
        type: null,
        project: null,
        consultant: null,
        soc: null,
        active: true,
        indispo: false,
        weekendAllowed: false,
        holidayAllowed: false,
      },
    ])
    holidaysFindByCountryYearMock.mockResolvedValue([])
    socHolidaysListMock.mockResolvedValue([])

    render(
      <MemoryRouter initialEntries={['/cras/1']}>
        <CraDetail id={1} />
        <DialogHost />
      </MemoryRouter>,
    )

    await screen.findByText('Alice Martin', { exact: false }, { timeout: 3000 })
    expect(await screen.findByText('Congé payé')).toBeInTheDocument()
    expect(screen.getByText('Développement')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer tous les événements' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Supprimer' }))

    await waitFor(() => expect(screen.queryByText('Développement')).not.toBeInTheDocument())
    expect(screen.getByText('Congé payé')).toBeInTheDocument()
  })

  it('le propriétaire (consultant) conserve un congé validé sur un jour d’absence (supprimer tous)', async () => {
    userMock.value = {
      id: 10,
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
    } as UserDto

    const draft = cra(true, 'DRAFT')
    const leaveIndex = draft.days.findIndex((d) => d.dayType === 'WORKED')
    draft.days = draft.days.map((d, i) => {
      if (i === leaveIndex) {
        return {
          ...d,
          dayType: 'LEAVE',
          unavailable: true,
          activities: [
            {
              id: 300,
              activityId: 5,
              activityName: 'Congé payé',
              activityColor: null,
              hours: 0,
              days: 1,
              valid: true,
              comment: null,
            },
          ],
        }
      }
      if (d.dayType === 'WORKED') {
        return {
          ...d,
          activities: [
            {
              id: 301 + i,
              activityId: 6,
              activityName: 'Développement',
              activityColor: null,
              hours: 0,
              days: 1,
              valid: false,
              comment: null,
            },
          ],
        }
      }
      return { ...d, activities: [] }
    })

    getByIdMock.mockResolvedValue(draft)
    activitiesFindAllMock.mockResolvedValue([
      {
        id: 5,
        name: 'Congé payé',
        description: null,
        price: 0,
        currency: 'EUR',
        startDate: null,
        endDate: null,
        type: null,
        project: null,
        consultant: null,
        soc: null,
        active: true,
        indispo: true,
        weekendAllowed: false,
        holidayAllowed: false,
      },
      {
        id: 6,
        name: 'Développement',
        description: null,
        price: 0,
        currency: 'EUR',
        startDate: null,
        endDate: null,
        type: null,
        project: null,
        consultant: null,
        soc: null,
        active: true,
        indispo: false,
        weekendAllowed: false,
        holidayAllowed: false,
      },
    ])
    holidaysFindByCountryYearMock.mockResolvedValue([])
    socHolidaysListMock.mockResolvedValue([])

    render(
      <MemoryRouter initialEntries={['/cras/1']}>
        <CraDetail id={1} />
        <DialogHost />
      </MemoryRouter>,
    )

    await screen.findByText('Alice Martin', { exact: false }, { timeout: 3000 })
    expect(await screen.findByText('Congé payé')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer tous les événements' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Supprimer' }))

    await waitFor(() => expect(screen.queryByText('Développement')).not.toBeInTheDocument())
    expect(screen.getByText('Congé payé')).toBeInTheDocument()
  })

  it('un consultant peut déclarer une absence directement depuis son CRA', async () => {
    userMock.value = {
      id: 10,
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
    } as UserDto

    const draft = cra(true, 'DRAFT')
    getByIdMock.mockResolvedValue(draft)
    saveMock.mockResolvedValue(draft)
    declareAbsenceMock.mockResolvedValue({
      ...draft,
      unavailabilities: [
        {
          id: 77,
          type: 'CONGE_PAYE',
          startDate: '2026-08-03',
          endDate: '2026-08-05',
          status: 'DRAFT',
        },
      ],
    })
    activitiesFindAllMock.mockResolvedValue([])
    holidaysFindByCountryYearMock.mockResolvedValue([])
    socHolidaysListMock.mockResolvedValue([])

    renderDetail()

    await screen.findByText('Alice Martin', { exact: false }, { timeout: 3000 })

    fireEvent.click(screen.getByRole('button', { name: 'Déclarer une absence' }))
    expect(await screen.findByText(/soumise au manager/)).toBeInTheDocument()
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Déclarer une absence' }).pop() as HTMLElement,
    )

    // Le CRA est d'abord enregistré, puis l'absence est déclarée.
    await waitFor(() => expect(saveMock).toHaveBeenCalledWith(1, expect.anything()))
    await waitFor(() => expect(declareAbsenceMock).toHaveBeenCalledTimes(1))
    expect(declareAbsenceMock).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        type: 'CONGE_PAYE',
        // Par défaut, l'absence porte sur un seul jour (pas tout le mois).
        startDate: '2026-08-01',
        endDate: '2026-08-01',
      }),
    )
  })

  it('supprime les événements non validés et leur couleur de jour de congé', async () => {
    userMock.value = {
      id: 10,
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
    } as UserDto

    const draft = cra(true, 'DRAFT')
    const workDay = draft.days.findIndex((d) => d.dayType === 'WORKED')
    draft.days = draft.days.map((d, i) =>
      i === workDay
        ? {
            ...d,
            dayType: 'LEAVE',
            activities: [
              {
                id: 900,
                activityId: 5,
                activityName: 'Congé payé',
                activityColor: null,
                hours: 0,
                days: 1,
                valid: false,
                comment: null,
              },
            ],
          }
        : d,
    )

    getByIdMock.mockResolvedValue(draft)
    activitiesFindAllMock.mockResolvedValue([
      {
        id: 5,
        name: 'Congé payé',
        description: null,
        price: 0,
        currency: 'EUR',
        startDate: null,
        endDate: null,
        type: null,
        project: null,
        consultant: null,
        soc: null,
        active: true,
        indispo: true,
        weekendAllowed: false,
        holidayAllowed: false,
      },
    ])
    holidaysFindByCountryYearMock.mockResolvedValue([])
    socHolidaysListMock.mockResolvedValue([])

    render(
      <MemoryRouter initialEntries={['/cras/1']}>
        <CraDetail id={1} />
        <DialogHost />
      </MemoryRouter>,
    )

    await screen.findByText('Alice Martin', { exact: false }, { timeout: 3000 })
    expect((await screen.findAllByText(/Congé ·/)).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer tous les événements' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Supprimer' }))

    await waitFor(() => expect(screen.queryAllByText(/Congé ·/)).toHaveLength(0))
  })

  it('un manager ne supprime pas les événements validés (supprimer tous)', async () => {
    userMock.value = managerUser
    const draft = cra(true, 'DRAFT')
    const firstWorked = draft.days.findIndex((d) => d.dayType === 'WORKED')
    draft.days = draft.days.map((d, i) => ({
      ...d,
      activities: d.activities.map((a) => ({ ...a, valid: i === firstWorked })),
    }))

    getByIdMock.mockResolvedValue(draft)
    activitiesFindAllMock.mockResolvedValue([
      {
        id: 5,
        name: 'Développement',
        description: null,
        price: 0,
        currency: 'EUR',
        startDate: null,
        endDate: null,
        type: null,
        project: null,
        consultant: null,
        soc: null,
        active: true,
        indispo: false,
        weekendAllowed: false,
        holidayAllowed: false,
      },
    ])
    holidaysFindByCountryYearMock.mockResolvedValue([])
    socHolidaysListMock.mockResolvedValue([])

    render(
      <MemoryRouter initialEntries={['/cras/1']}>
        <CraDetail id={1} />
        <DialogHost />
      </MemoryRouter>,
    )

    await screen.findByText('Alice Martin', { exact: false }, { timeout: 3000 })
    expect((await screen.findAllByText('Développement')).length).toBeGreaterThan(1)

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer tous les événements' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Supprimer' }))

    await waitFor(() => expect(screen.queryAllByText('Développement')).toHaveLength(1))
  })

  it('affiche « Déclarer une absence » pour un manager', async () => {
    userMock.value = managerUser
    getByIdMock.mockResolvedValue(cra(true, 'DRAFT'))
    activitiesFindAllMock.mockResolvedValue([])
    holidaysFindByCountryYearMock.mockResolvedValue([])
    socHolidaysListMock.mockResolvedValue([])

    renderDetail()

    await screen.findByText('Alice Martin', { exact: false }, { timeout: 3000 })
    expect(screen.getByRole('button', { name: 'Déclarer une absence' })).toBeInTheDocument()
  })

  it('masque « Déclarer une absence » pour un admin', async () => {
    userMock.value = {
      id: 3,
      username: 'admin',
      email: 'admin@soc.fr',
      firstName: 'A',
      lastName: 'Admin',
      phone: null,
      role: 'ADMIN',
      active: true,
      socId: 5,
      socName: 'SOC Test',
    } as UserDto
    getByIdMock.mockResolvedValue(cra(true, 'DRAFT'))
    activitiesFindAllMock.mockResolvedValue([])
    holidaysFindByCountryYearMock.mockResolvedValue([])
    socHolidaysListMock.mockResolvedValue([])

    renderDetail()

    await screen.findByText('Alice Martin', { exact: false }, { timeout: 3000 })
    expect(
      screen.queryByRole('button', { name: 'Déclarer une absence' }),
    ).not.toBeInTheDocument()
  })

  it('affiche le commentaire de rejet lorsqu’on ouvre un CRA rejeté', async () => {
    userMock.value = managerUser
    const rejected = cra(true, 'REJECTED')
    rejected.comment = 'Motif de rejet du CRA'
    getByIdMock.mockResolvedValue(rejected)
    activitiesFindAllMock.mockResolvedValue([])
    holidaysFindByCountryYearMock.mockResolvedValue([])
    socHolidaysListMock.mockResolvedValue([])

    renderDetail()

    await screen.findByText('Alice Martin', { exact: false }, { timeout: 3000 })
    expect(screen.getByText('Motif de rejet du CRA')).toBeInTheDocument()
  })

  it('affiche "Aucune absence déclarée" quand le CRA n’a pas d’absence liée', async () => {
    userMock.value = managerUser
    getByIdMock.mockResolvedValue(cra(true, 'SUBMITTED'))
    activitiesFindAllMock.mockResolvedValue([])
    holidaysFindByCountryYearMock.mockResolvedValue([])
    socHolidaysListMock.mockResolvedValue([])

    renderDetail()

    await screen.findByText('Alice Martin', { exact: false }, { timeout: 3000 })
    expect(screen.getByText('Absences déclarées')).toBeInTheDocument()
    expect(screen.getByText('Aucune absence déclarée.')).toBeInTheDocument()
  })

  it('le manager valide une absence liée depuis la page du CRA', async () => {
    userMock.value = managerUser
    const submitted = cra(true, 'SUBMITTED')
    submitted.unavailabilities = [
      { id: 77, type: 'CONGE_PAYE', startDate: '2026-08-03', endDate: '2026-08-05', status: 'SUBMITTED' },
    ]
    getByIdMock.mockResolvedValue(submitted)
    activitiesFindAllMock.mockResolvedValue([])
    holidaysFindByCountryYearMock.mockResolvedValue([])
    socHolidaysListMock.mockResolvedValue([])

    render(
      <MemoryRouter initialEntries={['/cras/1']}>
        <CraDetail id={1} />
        <DialogHost />
      </MemoryRouter>,
    )

    await screen.findByText('Alice Martin', { exact: false }, { timeout: 3000 })
    expect(screen.getByText('2026-08-03 → 2026-08-05')).toBeInTheDocument()
    expect(screen.getByText('Soumise')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: "Valider l'absence" }))
    const prompt = await screen.findByRole('dialog')
    fireEvent.change(within(prompt).getByRole('textbox'), { target: { value: 'OK' } })
    fireEvent.click(within(prompt).getByRole('button', { name: 'Confirmer' }))

    await waitFor(() => expect(absenceValidateMock).toHaveBeenCalledWith(77, 'OK'))
    expect(getByIdMock).toHaveBeenCalledTimes(2)
  })

  it('le manager rejette une absence liée avec un motif depuis la page du CRA', async () => {
    userMock.value = managerUser
    const submitted = cra(true, 'SUBMITTED')
    submitted.unavailabilities = [
      { id: 78, type: 'CONGE_MALADIE', startDate: '2026-08-10', endDate: '2026-08-10', status: 'SUBMITTED' },
    ]
    getByIdMock.mockResolvedValue(submitted)
    activitiesFindAllMock.mockResolvedValue([])
    holidaysFindByCountryYearMock.mockResolvedValue([])
    socHolidaysListMock.mockResolvedValue([])

    render(
      <MemoryRouter initialEntries={['/cras/1']}>
        <CraDetail id={1} />
        <DialogHost />
      </MemoryRouter>,
    )

    await screen.findByText('Alice Martin', { exact: false }, { timeout: 3000 })

    fireEvent.click(screen.getByRole('button', { name: "Rejeter l'absence" }))
    const prompt = await screen.findByRole('dialog')
    fireEvent.change(within(prompt).getByRole('textbox'), { target: { value: 'Certificat manquant' } })
    fireEvent.click(within(prompt).getByRole('button', { name: 'Confirmer' }))

    await waitFor(() =>
      expect(absenceRejectMock).toHaveBeenCalledWith(78, 'Certificat manquant'),
    )
  })

  it('un consultant ne voit pas les actions sur les absences liées', async () => {
    userMock.value = {
      id: 10,
      username: 'consultant',
      email: 'consultant@soc.fr',
      firstName: 'Alice',
      lastName: 'Martin',
      phone: null,
      role: 'CONSULTANT',
      active: true,
      socId: 5,
      socName: 'SOC Test',
    } as UserDto
    const submitted = cra(true, 'SUBMITTED')
    submitted.unavailabilities = [
      { id: 79, type: 'CONGE_PAYE', startDate: '2026-08-03', endDate: '2026-08-03', status: 'SUBMITTED' },
    ]
    getByIdMock.mockResolvedValue(submitted)
    activitiesFindAllMock.mockResolvedValue([])
    holidaysFindByCountryYearMock.mockResolvedValue([])
    socHolidaysListMock.mockResolvedValue([])

    renderDetail()

    await screen.findByText('Alice Martin', { exact: false }, { timeout: 3000 })
    expect(screen.getByText('Absences déclarées')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: "Valider l'absence" })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: "Rejeter l'absence" })).not.toBeInTheDocument()
  })

  it('ouvre une popup listant les indispos à valider au lieu de valider le CRA', async () => {
    userMock.value = managerUser
    const submitted = cra(false, 'SUBMITTED')
    submitted.unavailabilities = [
      { id: 77, type: 'CONGE_PAYE', startDate: '2026-08-03', endDate: '2026-08-05', status: 'SUBMITTED' },
    ]
    getByIdMock.mockResolvedValue(submitted)
    activitiesFindAllMock.mockResolvedValue([])
    holidaysFindByCountryYearMock.mockResolvedValue([])
    socHolidaysListMock.mockResolvedValue([])

    renderDetail()

    await screen.findByText('Alice Martin', { exact: false }, { timeout: 3000 })
    const valider = screen.getByRole('button', { name: 'Valider tout' })
    await waitFor(() => expect(valider).toBeEnabled())
    fireEvent.click(valider)

    const popup = await screen.findByRole('dialog')
    expect(within(popup).getByText('Indisponibilités à valider')).toBeInTheDocument()
    expect(within(popup).getByText('2026-08-03')).toBeInTheDocument()
    expect(within(popup).getByText('2026-08-05')).toBeInTheDocument()
    expect(within(popup).getByRole('link', { name: "Ouvrir l'indispo" })).toHaveAttribute(
      'href',
      '/indisponibilites?open=77',
    )
    // Aucune validation du CRA n'a été tentée.
    expect(validateMock).not.toHaveBeenCalled()
  })

  /**
 * Régression : l'absence rejetée restait affichée « Rejetée » après « Valider l'absence ».
 * Le backend la resoumet à la nouvelle soumission du CRA et accepte la validation d'une
 * absence rejetée : le panneau doit donc exposer l'action et recharger le CRA.
 */
it('le manager peut valider une absence liée déjà rejetée', async () => {
    userMock.value = managerUser
    const rejected = cra(false, 'SUBMITTED')
    rejected.unavailabilities = [
      { id: 91, type: 'CONGE_PAYE', startDate: '2026-08-03', endDate: '2026-08-05', status: 'REJECTED' },
    ]
    const validated = cra(false, 'SUBMITTED')
    validated.unavailabilities = [
      { id: 91, type: 'CONGE_PAYE', startDate: '2026-08-03', endDate: '2026-08-05', status: 'VALIDATED' },
    ]
    getByIdMock.mockResolvedValueOnce(rejected).mockResolvedValue(validated)
    activitiesFindAllMock.mockResolvedValue([])
    holidaysFindByCountryYearMock.mockResolvedValue([])
    socHolidaysListMock.mockResolvedValue([])

    render(
      <MemoryRouter initialEntries={['/cras/1']}>
        <CraDetail id={1} />
        <DialogHost />
      </MemoryRouter>,
    )

    await screen.findByText('Alice Martin', { exact: false }, { timeout: 3000 })
    expect(screen.getByText('Rejetée')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: "Valider l'absence" }))
    const prompt = await screen.findByRole('dialog')
    fireEvent.click(within(prompt).getByRole('button', { name: 'Confirmer' }))

    await waitFor(() => expect(absenceValidateMock).toHaveBeenCalledWith(91, ''))
    await waitFor(() => expect(getByIdMock).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByText('Validée')).toBeInTheDocument())
  })

  it('ferme la popup des indispos à valider une fois toutes validées', async () => {
    userMock.value = managerUser
    const pending = cra(false, 'SUBMITTED')
    pending.unavailabilities = [
      { id: 92, type: 'CONGE_RTT', startDate: '2026-08-03', endDate: '2026-08-05', status: 'REJECTED' },
    ]
    const cleared = cra(false, 'SUBMITTED')
    cleared.unavailabilities = [
      { id: 92, type: 'CONGE_RTT', startDate: '2026-08-03', endDate: '2026-08-05', status: 'VALIDATED' },
    ]
    getByIdMock.mockResolvedValueOnce(pending).mockResolvedValue(cleared)
    activitiesFindAllMock.mockResolvedValue([])
    holidaysFindByCountryYearMock.mockResolvedValue([])
    socHolidaysListMock.mockResolvedValue([])

    render(
      <MemoryRouter initialEntries={['/cras/1']}>
        <CraDetail id={1} />
        <DialogHost />
      </MemoryRouter>,
    )

    await screen.findByText('Alice Martin', { exact: false }, { timeout: 3000 })
    const valider = screen.getByRole('button', { name: 'Valider tout' })
    await waitFor(() => expect(valider).toBeEnabled())
    fireEvent.click(valider)

    const popup = await screen.findByRole('dialog')
    fireEvent.click(within(popup).getByRole('button', { name: "Valider l'absence" }))
    // La popup de saisie est ouverte en portal par-dessus la popup des indispos.
    const [, prompt] = await screen.findAllByRole('dialog')
    fireEvent.click(within(prompt).getByRole('button', { name: 'Confirmer' }))

    await waitFor(() => expect(absenceValidateMock).toHaveBeenCalledWith(92, ''))
    // Plus rien à valider : la popup se referme pour laisser valider le CRA.
    await waitFor(() =>
      expect(screen.queryByText('Indisponibilités à valider')).not.toBeInTheDocument(),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Valider tout' }))
    await waitFor(() => expect(validateMock).toHaveBeenCalledWith(1))
  })

  it('internationalise le titre de la page CRA (« CRA de … »)', async () => {
    userMock.value = managerUser
    getByIdMock.mockResolvedValue(cra(false, 'DRAFT'))
    activitiesFindAllMock.mockResolvedValue([])
    holidaysFindByCountryYearMock.mockResolvedValue([])
    socHolidaysListMock.mockResolvedValue([])

    renderDetail()

    expect(await screen.findByText('CRA de Alice Martin')).toBeInTheDocument()
  })

  it('traduit le comptage des jours des événements dans la langue sélectionnée', async () => {
    userMock.value = managerUser
    getByIdMock.mockResolvedValue(cra(true, 'VALIDATED'))
    activitiesFindAllMock.mockResolvedValue([])
    holidaysFindByCountryYearMock.mockResolvedValue([])
    socHolidaysListMock.mockResolvedValue([])

    setTranslationState('ar', {})

    renderDetail()

    // Le libellé « j » (jour) suit la langue : « ي » en arabe.
    expect((await screen.findAllByText(/^1\s+ي$/)).length).toBeGreaterThan(0)
    expect(screen.queryByText(/^1\s+j$/)).not.toBeInTheDocument()
  })

  it('grise les jours antérieurs à la date d’embauche avec une info-bulle', async () => {
    userMock.value = managerUser
    const draft = cra(false, 'DRAFT')
    draft.hireDate = '2026-08-15'
    const beforeHireIndex = draft.days.findIndex((d) => d.dayType === 'WORKED')
    draft.days = draft.days.map((d, i) =>
      i === beforeHireIndex ? { ...d, dayType: 'BEFORE_HIRE', activities: [] } : d,
    )
    getByIdMock.mockResolvedValue(draft)
    activitiesFindAllMock.mockResolvedValue([])
    holidaysFindByCountryYearMock.mockResolvedValue([])
    socHolidaysListMock.mockResolvedValue([])

    renderDetail()

    await screen.findByText('Alice Martin', { exact: false }, { timeout: 3000 })
    expect(
      await screen.findByTitle('Avant la date d’embauche (2026-08-15)'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Avant embauche/)).toBeInTheDocument()
  })

  it('valide le CRA directement quand aucune indispo n’est en attente', async () => {
    userMock.value = managerUser
    const submitted = cra(false, 'SUBMITTED')
    getByIdMock.mockResolvedValue(submitted)
    saveMock.mockResolvedValue(submitted)
    validateMock.mockResolvedValue(cra(true, 'VALIDATED'))
    activitiesFindAllMock.mockResolvedValue([])
    holidaysFindByCountryYearMock.mockResolvedValue([])
    socHolidaysListMock.mockResolvedValue([])

    renderDetail()

    await screen.findByText('Alice Martin', { exact: false }, { timeout: 3000 })
    const valider = screen.getByRole('button', { name: 'Valider tout' })
    await waitFor(() => expect(valider).toBeEnabled())
    fireEvent.click(valider)

    await waitFor(() => expect(validateMock).toHaveBeenCalledWith(1))
    expect(screen.queryByText('Indisponibilités à valider')).not.toBeInTheDocument()
  })
})