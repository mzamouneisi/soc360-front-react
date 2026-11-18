import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LeaveSettings } from './LeaveSettings'
import type { LeaveConfigDto } from '../api/types'

const { configsMock, saveConfigMock, setConfigActiveMock, deleteConfigMock, confirmMock } =
  vi.hoisted(() => ({
    configsMock: vi.fn(),
    saveConfigMock: vi.fn(),
    setConfigActiveMock: vi.fn(),
    deleteConfigMock: vi.fn(),
    confirmMock: vi.fn(),
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
    deleteConfig: deleteConfigMock,
  },
}))

vi.mock('../components/dialog', () => ({
  dialog: { success: vi.fn(), error: vi.fn(), confirm: confirmMock },
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
    deletable: true,
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
    fireEvent.change(document.getElementById('LeaveSettings.config.amount') as HTMLInputElement, {
      target: { value: '5' },
    })
    const checkbox = document.getElementById('LeaveSettings.config.active') as HTMLInputElement
    expect(checkbox.checked).toBe(true)
    fireEvent.click(checkbox)
    fireEvent.click(document.getElementById('LeaveSettings.config.submit') as HTMLButtonElement)

    await waitFor(() =>
      expect(saveConfigMock).toHaveBeenCalledWith(expect.objectContaining({ active: false })),
    )
  })

  it('supprime une configuration supprimable après confirmation', async () => {
    configsMock.mockResolvedValue([config()])
    confirmMock.mockResolvedValue(true)
    deleteConfigMock.mockResolvedValue(undefined)

    render(<LeaveSettings />)

    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer' }))

    await waitFor(() => expect(deleteConfigMock).toHaveBeenCalledWith(1))
    expect(confirmMock).toHaveBeenCalled()
  })

  it('ne propose pas la suppression d’une configuration référencée', async () => {
    configsMock.mockResolvedValue([config({ deletable: false })])

    render(<LeaveSettings />)

    await screen.findByText('CP')
    expect(screen.queryByRole('button', { name: 'Supprimer' })).toBeNull()
  })

  it('affiche les champs de crédit selon la fréquence choisie', async () => {
    configsMock.mockResolvedValue([])
    render(<LeaveSettings />)
    await waitFor(() => expect(configsMock).toHaveBeenCalled())

    const frequency = document.getElementById('LeaveSettings.config.frequency') as HTMLSelectElement
    expect(document.getElementById('LeaveSettings.config.creditMonth')).toBeNull()
    expect(document.getElementById('LeaveSettings.config.creditDay')).not.toBeNull()

    fireEvent.change(frequency, { target: { value: 'YEARLY' } })
    expect(document.getElementById('LeaveSettings.config.creditMonth')).not.toBeNull()
    expect(document.getElementById('LeaveSettings.config.creditDay')).not.toBeNull()

    fireEvent.change(frequency, { target: { value: 'QUARTERLY' } })
    expect(document.getElementById('LeaveSettings.config.creditMonth')).not.toBeNull()
    expect(document.getElementById('LeaveSettings.config.creditDay')).not.toBeNull()

    fireEvent.change(frequency, { target: { value: 'ONCE' } })
    expect(document.getElementById('LeaveSettings.config.creditMonth')).toBeNull()
    expect(document.getElementById('LeaveSettings.config.creditDay')).toBeNull()
  })

  it('pré-remplit les valeurs par défaut quantité 1 et expiration 12', async () => {
    configsMock.mockResolvedValue([])
    render(<LeaveSettings />)
    await waitFor(() => expect(configsMock).toHaveBeenCalled())

    expect(
      (document.getElementById('LeaveSettings.config.amount') as HTMLInputElement).value,
    ).toBe('1')
    expect(
      (document.getElementById('LeaveSettings.config.expiration') as HTMLInputElement).value,
    ).toBe('12')
    expect(
      (document.getElementById('LeaveSettings.config.creditDay') as HTMLInputElement).value,
    ).toBe('1')
    expect(
      (document.getElementById('LeaveSettings.config.negative') as HTMLInputElement).value,
    ).toBe('0')
  })

  it('refuse une quantité acquise négative ou nulle', async () => {
    configsMock.mockResolvedValue([])
    render(<LeaveSettings />)
    await waitFor(() => expect(configsMock).toHaveBeenCalled())
    const amount = document.getElementById('LeaveSettings.config.amount') as HTMLInputElement

    for (const value of ['-1', '0']) {
      fireEvent.change(amount, { target: { value } })
      fireEvent.submit(document.querySelector('form') as HTMLFormElement)

      expect(saveConfigMock).not.toHaveBeenCalled()
      await waitFor(() =>
        expect(document.getElementById('LeaveSettings.formError')?.textContent).toContain(
          'supérieure à 0',
        ),
      )
    }
  })

  it('refuse un seuil négatif', async () => {
    configsMock.mockResolvedValue([])
    render(<LeaveSettings />)
    await waitFor(() => expect(configsMock).toHaveBeenCalled())

    fireEvent.change(document.getElementById('LeaveSettings.config.amount') as HTMLInputElement, {
      target: { value: '5' },
    })
    fireEvent.change(document.getElementById('LeaveSettings.config.negative') as HTMLInputElement, {
      target: { value: '-1' },
    })
    fireEvent.submit(document.querySelector('form') as HTMLFormElement)

    expect(saveConfigMock).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(document.getElementById('LeaveSettings.formError')?.textContent).toContain(
        'seuil négatif',
      ),
    )
  })

  it('refuse une expiration hors bornes', async () => {
    configsMock.mockResolvedValue([])
    render(<LeaveSettings />)
    await waitFor(() => expect(configsMock).toHaveBeenCalled())

    fireEvent.change(document.getElementById('LeaveSettings.config.amount') as HTMLInputElement, {
      target: { value: '5' },
    })
    const expiration = document.getElementById('LeaveSettings.config.expiration') as HTMLInputElement

    for (const value of ['0', '13']) {
      fireEvent.change(expiration, { target: { value } })
      fireEvent.submit(document.querySelector('form') as HTMLFormElement)

      expect(saveConfigMock).not.toHaveBeenCalled()
      await waitFor(() =>
        expect(document.getElementById('LeaveSettings.formError')?.textContent).toContain(
          '1 et 12',
        ),
      )
    }
  })

  it('refuse un jour du mois hors bornes', async () => {
    configsMock.mockResolvedValue([])
    render(<LeaveSettings />)
    await waitFor(() => expect(configsMock).toHaveBeenCalled())

    fireEvent.change(document.getElementById('LeaveSettings.config.amount') as HTMLInputElement, {
      target: { value: '5' },
    })
    const creditDay = document.getElementById('LeaveSettings.config.creditDay') as HTMLInputElement

    for (const value of ['0', '32']) {
      fireEvent.change(creditDay, { target: { value } })
      fireEvent.submit(document.querySelector('form') as HTMLFormElement)

      expect(saveConfigMock).not.toHaveBeenCalled()
      await waitFor(() =>
        expect(document.getElementById('LeaveSettings.formError')?.textContent).toContain(
          '1 et 31',
        ),
      )
    }
  })

  it('réinitialise les champs après l’enregistrement d’un paramétrage', async () => {
    configsMock.mockResolvedValue([])
    saveConfigMock.mockResolvedValue(config())

    render(<LeaveSettings />)
    await waitFor(() => expect(configsMock).toHaveBeenCalled())

    fireEvent.change(document.getElementById('LeaveSettings.config.type') as HTMLSelectElement, {
      target: { value: 'RTT' },
    })
    fireEvent.change(
      document.getElementById('LeaveSettings.config.effectiveDate') as HTMLInputElement,
      { target: { value: '2026-03-01' } },
    )
    fireEvent.change(document.getElementById('LeaveSettings.config.amount') as HTMLInputElement, {
      target: { value: '5' },
    })
    fireEvent.change(
      document.getElementById('LeaveSettings.config.frequency') as HTMLSelectElement,
      { target: { value: 'QUARTERLY' } },
    )
    fireEvent.change(
      document.getElementById('LeaveSettings.config.creditMonth') as HTMLInputElement,
      { target: { value: '4' } },
    )
    fireEvent.change(
      document.getElementById('LeaveSettings.config.creditDay') as HTMLInputElement,
      { target: { value: '10' } },
    )
    fireEvent.change(
      document.getElementById('LeaveSettings.config.expiration') as HTMLInputElement,
      { target: { value: '12' } },
    )
    fireEvent.change(
      document.getElementById('LeaveSettings.config.negative') as HTMLInputElement,
      { target: { value: '2' } },
    )
    fireEvent.click(document.getElementById('LeaveSettings.config.active') as HTMLInputElement)

    fireEvent.click(document.getElementById('LeaveSettings.config.submit') as HTMLButtonElement)

    await waitFor(() => expect(saveConfigMock).toHaveBeenCalled())
    await waitFor(() =>
      expect(
        (document.getElementById('LeaveSettings.config.type') as HTMLSelectElement).value,
      ).toBe('CP'),
    )
    expect(
      (document.getElementById('LeaveSettings.config.amount') as HTMLInputElement).value,
    ).toBe('1')
    expect(
      (document.getElementById('LeaveSettings.config.frequency') as HTMLSelectElement).value,
    ).toBe('MONTHLY')
    expect(
      (document.getElementById('LeaveSettings.config.expiration') as HTMLInputElement).value,
    ).toBe('12')
    expect(
      (document.getElementById('LeaveSettings.config.negative') as HTMLInputElement).value,
    ).toBe('0')
    expect(
      (document.getElementById('LeaveSettings.config.active') as HTMLInputElement).checked,
    ).toBe(true)
    expect(document.getElementById('LeaveSettings.config.creditMonth')).toBeNull()
    expect(
      (document.getElementById('LeaveSettings.config.creditDay') as HTMLInputElement).value,
    ).toBe('1')
  })

  it('envoie une configuration trimestrielle avec le jour et le mois choisis', async () => {
    configsMock.mockResolvedValue([])
    saveConfigMock.mockResolvedValue(config({ accrualFrequency: 'QUARTERLY' }))
    render(<LeaveSettings />)
    await waitFor(() => expect(configsMock).toHaveBeenCalled())

    fireEvent.change(document.getElementById('LeaveSettings.config.amount') as HTMLInputElement, {
      target: { value: '5' },
    })
    fireEvent.change(document.getElementById('LeaveSettings.config.frequency') as HTMLSelectElement, {
      target: { value: 'QUARTERLY' },
    })
    fireEvent.change(document.getElementById('LeaveSettings.config.creditMonth') as HTMLInputElement, {
      target: { value: '4' },
    })
    fireEvent.change(document.getElementById('LeaveSettings.config.creditDay') as HTMLInputElement, {
      target: { value: '10' },
    })
    fireEvent.change(
      document.getElementById('LeaveSettings.config.expiration') as HTMLInputElement,
      { target: { value: '12' } },
    )
    fireEvent.click(document.getElementById('LeaveSettings.config.submit') as HTMLButtonElement)

    await waitFor(() =>
      expect(saveConfigMock).toHaveBeenCalledWith(
        expect.objectContaining({
          accrualFrequency: 'QUARTERLY',
          creditMonth: 4,
          creditDay: 10,
          expirationMonths: 12,
        }),
      ),
    )
  })
})
