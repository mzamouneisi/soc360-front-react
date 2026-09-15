import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CraDetail } from './CraDetail'
import type { CraDto, UserDto } from '../api/types'

const {
  getByIdMock,
  saveMock,
  validateMock,
  invalidateRangeMock,
  activitiesFindAllMock,
  holidaysFindByCountryYearMock,
  socHolidaysListMock,
  userMock,
} = vi.hoisted(() => ({
  getByIdMock: vi.fn(),
  saveMock: vi.fn(),
  validateMock: vi.fn(),
  invalidateRangeMock: vi.fn(),
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
      <Routes>
        <Route path="/cras/:id" element={<CraDetail />} />
      </Routes>
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
})