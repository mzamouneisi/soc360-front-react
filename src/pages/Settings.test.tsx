import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Settings } from './Settings'

const { getByIdMock, updateCraColorsMock, refreshMeMock, userMock } = vi.hoisted(() => ({
  getByIdMock: vi.fn(),
  updateCraColorsMock: vi.fn(),
  refreshMeMock: vi.fn(),
  userMock: { value: null as unknown },
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: userMock.value,
    initializing: false,
    login: vi.fn(),
    logout: vi.fn(),
    setUser: vi.fn(),
    refreshMe: refreshMeMock,
  }),
}))

vi.mock('../soc/SocContext', () => ({
  useSoc: () => ({
    selectedSocId: 5,
    selectedSoc: { id: 5, name: 'Soc Test' },
    socs: [],
    favoriteSocId: 5,
    favoriteSoc: null,
    loading: false,
    refreshSocs: vi.fn(),
    selectSoc: vi.fn(),
    setFavoriteSoc: vi.fn(),
    addSoc: vi.fn(),
    canAddSoc: true,
  }),
}))

vi.mock('../i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    preference: null,
    languages: ['fr'],
    setLanguage: vi.fn(),
    language: 'fr',
    refresh: vi.fn(),
  }),
}))

vi.mock('../api/socs', () => ({
  socsApi: {
    getById: getByIdMock,
    updateCraColors: updateCraColorsMock,
  },
}))

vi.mock('../api/emailTemplates', () => ({
  emailTemplatesApi: {
    list: vi.fn().mockResolvedValue([]),
    save: vi.fn(),
    reset: vi.fn(),
  },
}))

vi.mock('../api/i18n', () => ({
  i18nApi: {
    companyEntries: vi.fn().mockResolvedValue([]),
    saveCompanyOverride: vi.fn(),
    deleteCompanyOverride: vi.fn(),
  },
}))

vi.mock('../api/auth', () => ({
  authApi: {},
}))

vi.mock('../components/dialog', () => ({
  dialog: {
    confirm: vi.fn().mockResolvedValue(true),
    alert: vi.fn(),
  },
}))

function user(role: string) {
  return {
    id: 1,
    username: 'user',
    email: 'user@soc.fr',
    firstName: 'Test',
    lastName: 'User',
    phone: null,
    role,
    active: true,
    socId: 5,
    socName: 'Soc Test',
  }
}

afterEach(() => {
  vi.clearAllMocks()
  userMock.value = null
})

describe('Settings — couleurs CRA', () => {
  it('charge et enregistre les couleurs pour un responsable de société', async () => {
    userMock.value = user('RESPONSIBLE_SOC')
    getByIdMock.mockResolvedValue({
      soc: { id: 5, name: 'Soc Test', leaveDayColor: '#ffeeaa', weekendColor: '#eefcee' },
      subscriptions: [],
      payments: [],
    })
    updateCraColorsMock.mockResolvedValue({})

    render(<Settings />)

    const title = await screen.findByText('settings.craColors.title')
    expect(title).toBeInTheDocument()
    await waitFor(() => expect(getByIdMock).toHaveBeenCalledWith(5))

    const leaveInput = title.parentElement
      ?.querySelector('#settings\\.craColors\\.leave')
      ?.parentElement?.querySelector('input[type="color"]') as HTMLInputElement
    const weekendInput = title.parentElement
      ?.querySelector('#settings\\.craColors\\.weekend')
      ?.parentElement?.querySelector('input[type="color"]') as HTMLInputElement
    expect(leaveInput.value).toBe('#ffeeaa')
    expect(weekendInput.value).toBe('#eefcee')

    fireEvent.change(leaveInput, { target: { value: '#ff0000' } })
    const saveButtons = screen.getAllByRole('button', { name: 'common.save' })
    fireEvent.click(saveButtons[saveButtons.length - 1])

    await waitFor(() =>
      expect(updateCraColorsMock).toHaveBeenCalledWith(5, {
        leaveDayColor: '#ff0000',
        weekendColor: '#eefcee',
      }),
    )
  })

  it('ne montre pas les couleurs CRA à un consultant', async () => {
    userMock.value = user('CONSULTANT')

    render(<Settings />)

    expect(screen.queryByText('settings.craColors.title')).not.toBeInTheDocument()
    expect(getByIdMock).not.toHaveBeenCalled()
  })
})
