import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { IndispoList } from './IndispoList'
import type { UserDto } from '../api/types'

const { findByConsultantMock, findBySocYearMock, getOrCreateMock, deleteMock, userMock } =
  vi.hoisted(() => ({
    findByConsultantMock: vi.fn().mockResolvedValue([]),
    findBySocYearMock: vi.fn().mockResolvedValue([]),
    getOrCreateMock: vi.fn(),
    deleteMock: vi.fn(),
    userMock: { value: null as unknown as UserDto },
  }))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: userMock.value, initializing: false }),
}))

vi.mock('../api/cras', () => ({
  crasApi: {
    findByConsultant: findByConsultantMock,
    findBySocYear: findBySocYearMock,
    getOrCreate: getOrCreateMock,
    delete: deleteMock,
  },
}))

const consultantUser = {
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
  hireDate: '2023-05-10',
  mustChangePassword: false,
  lastLoginAt: null,
} as UserDto

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
  findByConsultantMock.mockResolvedValue([])
  findBySocYearMock.mockResolvedValue([])
  userMock.value = null as unknown as UserDto
})

describe('IndispoList', () => {
  it('propose les périodes depuis l’embauche jusqu’à 3 ans dans le futur', async () => {
    stubFixedNow()
    userMock.value = consultantUser

    render(<IndispoList />)

    await waitFor(() => expect(findByConsultantMock).toHaveBeenCalledWith(10, 2026, 'CONGE'))
    expect(document.getElementById('IndispoList.periode.year.2023')).not.toBeNull()
    expect(document.getElementById('IndispoList.periode.year.2022')).toBeNull()
    expect(document.getElementById('IndispoList.periode.year.2029')).not.toBeNull()
    expect(document.getElementById('IndispoList.periode.year.2030')).toBeNull()

    fireEvent.change(document.getElementById('IndispoList.periode.year') as HTMLSelectElement, {
      target: { value: '2023' },
    })
    await waitFor(() =>
      expect(document.getElementById('IndispoList.periode.month.5')).not.toBeNull(),
    )
    expect(document.getElementById('IndispoList.periode.month.4')).toBeNull()

    fireEvent.change(document.getElementById('IndispoList.periode.year') as HTMLSelectElement, {
      target: { value: '2029' },
    })
    await waitFor(() =>
      expect(document.getElementById('IndispoList.periode.month.8')).not.toBeNull(),
    )
    expect(document.getElementById('IndispoList.periode.month.9')).toBeNull()
  })
})
