import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ActivityTypes } from './ActivityTypes'
import { DialogHost } from '../components/dialog'
import type { ActivityTypeDto, UserDto } from '../api/types'

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
  useSoc: () => ({ selectedSocId: 5, selectedSoc: null, socs: [], setSelectedSocId: vi.fn() }),
}))

vi.mock('../api/activities', () => ({
  activityTypesApi: {
    findAll: findAllMock,
    create: vi.fn(),
    update: updateMock,
    delete: vi.fn(),
  },
}))

const baseUser = {
  id: 1,
  username: 'resp',
  email: 'resp@soc.fr',
  firstName: 'Res',
  lastName: 'Ponsable',
  phone: null,
  role: 'RESPONSIBLE_SOC',
  active: true,
  socId: 5,
  socName: 'SOC Test',
  consultantId: null,
  mustChangePassword: false,
  lastLoginAt: null,
} as UserDto

const type = (overrides: Partial<ActivityTypeDto> = {}): ActivityTypeDto => ({
  id: 1,
  socId: 5,
  code: 'MISSION',
  labelFr: 'Mission',
  labelEn: null,
  color: '#3b82f6',
  active: true,
  socName: null,
  ...overrides,
})

afterEach(() => {
  vi.clearAllMocks()
  userMock.value = null as unknown as UserDto
})

describe('ActivityTypes', () => {
  it('ne modifie pas le type lors du clic sur activer/désactiver', async () => {
    userMock.value = baseUser
    findAllMock.mockResolvedValue([type()])
    updateMock.mockResolvedValue(type({ active: false }))

    render(
      <MemoryRouter>
        <ActivityTypes />
        <DialogHost />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Désactiver' }))

    expect(screen.queryByText('Modifier le type')).not.toBeInTheDocument()

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmer' }))

    await waitFor(() => expect(updateMock).toHaveBeenCalled())
    expect(updateMock.mock.calls[0][0]).toBe(1)
    expect(updateMock.mock.calls[0][1].active).toBe(false)
  })
})
