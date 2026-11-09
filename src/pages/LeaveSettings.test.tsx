import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LeaveSettings } from './LeaveSettings'
import type { LeaveConfigDto } from '../api/types'

const { configsMock, saveConfigMock, setConfigActiveMock } = vi.hoisted(() => ({
  configsMock: vi.fn(),
  saveConfigMock: vi.fn(),
  setConfigActiveMock: vi.fn(),
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, role: 'RESPONSIBLE_SOC', socId: 10 } }),
}))

vi.mock('../soc/SocContext', () => ({
  useSoc: () => ({ selectedSocId: 10 }),
}))

vi.mock('../api/leave', () => ({
  leaveApi: {
    configs: configsMock,
    saveConfig: saveConfigMock,
    setConfigActive: setConfigActiveMock,
  },
}))

vi.mock('../components/dialog', () => ({
  dialog: { success: vi.fn(), error: vi.fn() },
}))

function config(overrides: Partial<LeaveConfigDto> = {}): LeaveConfigDto {
  return {
    id: 1,
    socId: 10,
    leaveType: 'CP',
    effectiveDate: '2026-01-01',
    active: true,
    accrualAmount: 2.5,
    accrualFrequency: 'MONTHLY',
    creditMonth: 1,
    creditDay: 1,
    acquisitionStartMonth: null,
    acquisitionStartDay: null,
    acquisitionEndMonth: null,
    acquisitionEndDay: null,
    usageStartMonth: null,
    usageStartDay: null,
    usageEndMonth: null,
    usageEndDay: null,
    expirationMonths: null,
    carryoverMax: 0,
    carryoverExpirationMonths: null,
    negativeLimit: 0,
    activations: [
      {
        id: 100,
        action: 'ACTIVATION',
        actionDate: '2026-01-01T09:00:00Z',
        userId: 3,
        userName: 'Alice Martin',
      },
    ],
    ...overrides,
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('LeaveSettings — activation / désactivation', () => {
  it('affiche l’historique d’activation par utilisateur après clic sur le bouton', async () => {
    configsMock.mockResolvedValue([config()])

    render(<LeaveSettings />)

    await screen.findByText('CP')
    expect(document.getElementById('LeaveSettings.configs.1.historique.table')).toBeNull()

    fireEvent.click(document.getElementById('LeaveSettings.configs.1.historique.toggle') as HTMLElement)

    expect(document.getElementById('LeaveSettings.configs.1.historique.table')).not.toBeNull()
    expect(
      document.getElementById('LeaveSettings.configs.1.historique.row.100.statut')?.textContent,
    ).toBe('Activation')
    expect(
      document.getElementById('LeaveSettings.configs.1.historique.row.100.user')?.textContent,
    ).toBe('Alice Martin')
    expect(
      document.getElementById('LeaveSettings.configs.1.historique.row.100.date')?.textContent,
    ).not.toBe('')
  })

  it('pagine l’historique lorsqu’il est volumineux', async () => {
    const activations = Array.from({ length: 7 }, (_, index) => ({
      id: 200 + index,
      action: (index % 2 === 0 ? 'ACTIVATION' : 'DESACTIVATION') as
        | 'ACTIVATION'
        | 'DESACTIVATION',
      actionDate: '2026-01-01T09:00:00Z',
      userId: 3,
      userName: 'Alice Martin',
    }))
    configsMock.mockResolvedValue([config({ activations })])

    render(<LeaveSettings />)

    await screen.findByText('CP')
    fireEvent.click(document.getElementById('LeaveSettings.configs.1.historique.toggle') as HTMLElement)

    const rows = () =>
      document.querySelectorAll('[id^="LeaveSettings.configs.1.historique.row."][id$=".date"]')
    expect(rows()).toHaveLength(5)

    fireEvent.click(
      document.getElementById('LeaveSettings.configs.1.historique.pagination.next') as HTMLElement,
    )
    expect(rows()).toHaveLength(2)
  })

  it('désactive une configuration active via le bouton', async () => {
    configsMock.mockResolvedValue([config()])
    setConfigActiveMock.mockResolvedValue(config({ active: false }))

    render(<LeaveSettings />)

    const toggle = (await screen.findByRole('button', { name: 'Désactiver' })) as HTMLButtonElement
    fireEvent.click(toggle)

    await waitFor(() => expect(setConfigActiveMock).toHaveBeenCalledWith(1, false))
  })

  it('active une configuration inactive via le bouton', async () => {
    configsMock.mockResolvedValue([
      config({
        id: 2,
        active: false,
        activations: [
          {
            id: 101,
            action: 'DESACTIVATION',
            actionDate: '2026-06-01T09:00:00Z',
            userId: 3,
            userName: 'Alice Martin',
          },
        ],
      }),
    ])
    setConfigActiveMock.mockResolvedValue(config({ id: 2, active: true }))

    render(<LeaveSettings />)

    const toggle = (await screen.findByRole('button', { name: 'Activer' })) as HTMLButtonElement
    fireEvent.click(toggle)

    await waitFor(() => expect(setConfigActiveMock).toHaveBeenCalledWith(2, true))
  })

  it('envoie l’état actif/inactif choisi à la création', async () => {
    configsMock.mockResolvedValue([])
    saveConfigMock.mockResolvedValue(config())

    render(<LeaveSettings />)

    await waitFor(() => expect(configsMock).toHaveBeenCalled())
    const checkbox = document.getElementById('LeaveSettings.config.active') as HTMLInputElement
    expect(checkbox.checked).toBe(true)
    fireEvent.click(checkbox)
    fireEvent.click(document.getElementById('LeaveSettings.config.submit') as HTMLButtonElement)

    await waitFor(() =>
      expect(saveConfigMock).toHaveBeenCalledWith(expect.objectContaining({ active: false })),
    )
  })
})
