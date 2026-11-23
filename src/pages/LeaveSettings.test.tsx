import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LeaveSettings } from './LeaveSettings'
import type { LeaveConfigDto } from '../api/types'

const {
  configsMock,
  saveConfigMock,
  setConfigActiveMock,
  deleteConfigMock,
  deleteConfigCascadeMock,
  confirmMock,
} = vi.hoisted(() => ({
  configsMock: vi.fn(),
  saveConfigMock: vi.fn(),
  setConfigActiveMock: vi.fn(),
  deleteConfigMock: vi.fn(),
  deleteConfigCascadeMock: vi.fn(),
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
    deleteConfigCascade: deleteConfigCascadeMock,
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
    endDate: null,
    active: true,
    accrualAmount: 2.5,
    accrualFrequency: 'MONTHLY',
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
    negativeAllowed: true,
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

  it('rappelle tous les paramètres de chaque configuration existante', async () => {
    configsMock.mockResolvedValue([
      config({
        endDate: '2026-12-31',
        accrualAmount: 2.5,
        accrualFrequency: 'YEARLY',
        acquisitionStartMonth: 6,
        acquisitionStartDay: 15,
        acquisitionEndMonth: 5,
        acquisitionEndDay: 31,
        usageStartMonth: 5,
        usageStartDay: 1,
        usageEndMonth: 4,
        usageEndDay: 30,
        expirationMonths: 12,
        carryoverMax: 5,
        carryoverExpirationMonths: 3,
        negativeLimit: 2,
        negativeAllowed: false,
      }),
    ])

    render(<LeaveSettings />)

    await screen.findByText('CP')
    const value = (key: string) =>
      document.getElementById(`LeaveSettings.configs.1.param.${key}`)?.textContent
    expect(value('type')).toBe('CP')
    expect(value('endDate')).not.toBe('—')
    expect(value('accrualAmount')).toBe('2.5')
    expect(value('accrualFrequency')).toBe('Annuelle')
    expect(value('acquisitionStart')).toBe('15/06')
    expect(value('acquisitionEnd')).toBe('31/05')
    expect(value('usageStart')).toBe('01/05')
    expect(value('usageEnd')).toBe('30/04')
    expect(value('expirationMonths')).toBe('12')
    expect(value('carryoverMax')).toBe('5')
    expect(value('carryoverExpirationMonths')).toBe('3')
    expect(value('negativeLimit')).toBe('2')
    expect(value('negativeAllowed')).toBe('Non')
    expect(document.getElementById('LeaveSettings.configs.1.statut')).toHaveTextContent('Actif')
    expect(document.getElementById('LeaveSettings.configs.col.effectiveDate')).not.toBeNull()
  })

  it('pagine le tableau des configurations existantes', async () => {
    configsMock.mockResolvedValue(
      Array.from({ length: 7 }, (_, index) =>
        config({ id: index + 1, leaveType: index % 2 === 0 ? 'CP' : 'RTT' }),
      ),
    )

    render(<LeaveSettings />)

    await screen.findByText('CP')
    expect(document.getElementById('LeaveSettings.configs.page')).toHaveTextContent('Page 1 / 2')
    expect(document.getElementById('LeaveSettings.configs.1.param.type')).toBeInTheDocument()

    fireEvent.click(document.getElementById('LeaveSettings.configs.next') as HTMLElement)

    await waitFor(() =>
      expect(document.getElementById('LeaveSettings.configs.6.param.type')).toBeInTheDocument(),
    )
    expect(document.getElementById('LeaveSettings.configs.1.param.type')).toBeNull()
    expect(document.getElementById('LeaveSettings.configs.page')).toHaveTextContent('Page 2 / 2')
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

  it('propose le bouton de suppression en cascade pour une configuration référencée', async () => {
    configsMock.mockResolvedValue([config({ deletable: false })])

    render(<LeaveSettings />)

    await screen.findByText('CP')
    expect(document.getElementById('LeaveSettings.configs.1.supprimerCascade')).not.toBeNull()
  })

  it('supprime en cascade une configuration après confirmation', async () => {
    configsMock.mockResolvedValue([config({ deletable: false })])
    confirmMock.mockResolvedValue(true)
    deleteConfigCascadeMock.mockResolvedValue(undefined)

    render(<LeaveSettings />)

    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer en cascade' }))

    await waitFor(() => expect(deleteConfigCascadeMock).toHaveBeenCalledWith(1))
    expect(confirmMock).toHaveBeenCalled()
  })

  it('ne propose plus de jour ni de mois de crédit saisis séparément', async () => {
    configsMock.mockResolvedValue([])
    render(<LeaveSettings />)
    await waitFor(() => expect(configsMock).toHaveBeenCalled())

    const frequency = document.getElementById('LeaveSettings.config.frequency') as HTMLSelectElement
    expect(document.getElementById('LeaveSettings.config.creditMonth')).toBeNull()
    expect(document.getElementById('LeaveSettings.config.creditDay')).toBeNull()

    fireEvent.change(frequency, { target: { value: 'YEARLY' } })
    expect(document.getElementById('LeaveSettings.config.creditMonth')).toBeNull()
    expect(document.getElementById('LeaveSettings.config.creditDay')).toBeNull()

    fireEvent.change(frequency, { target: { value: 'QUARTERLY' } })
    expect(document.getElementById('LeaveSettings.config.creditMonth')).toBeNull()
    expect(document.getElementById('LeaveSettings.config.creditDay')).toBeNull()

    fireEvent.change(frequency, { target: { value: 'ONCE' } })
    expect(document.getElementById('LeaveSettings.config.creditMonth')).toBeNull()
    expect(document.getElementById('LeaveSettings.config.creditDay')).toBeNull()
  })

  it('pré-remplit la date d’effet au 1er jour du mois et les autres valeurs par défaut', async () => {
    configsMock.mockResolvedValue([])
    render(<LeaveSettings />)
    await waitFor(() => expect(configsMock).toHaveBeenCalled())

    const effectiveDate = (document.getElementById('LeaveSettings.config.effectiveDate') as HTMLInputElement).value
    const day = effectiveDate.startsWith('0') ? effectiveDate.slice(0, 2) : effectiveDate.slice(-2)
    expect(day).toBe('01')
    expect(
      (document.getElementById('LeaveSettings.config.amount') as HTMLInputElement).value,
    ).toBe('1')
    expect(
      (document.getElementById('LeaveSettings.config.expiration') as HTMLInputElement).value,
    ).toBe('12')
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
    const effectiveDate = (document.getElementById('LeaveSettings.config.effectiveDate') as HTMLInputElement).value
    const day = effectiveDate.startsWith('0') ? effectiveDate.slice(0, 2) : effectiveDate.slice(-2)
    expect(day).toBe('01')
    expect(document.getElementById('LeaveSettings.config.creditMonth')).toBeNull()
    expect(document.getElementById('LeaveSettings.config.creditDay')).toBeNull()
  })

  it('envoie une configuration trimestrielle sans jour ni mois de crédit', async () => {
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
    fireEvent.change(
      document.getElementById('LeaveSettings.config.expiration') as HTMLInputElement,
      { target: { value: '12' } },
    )
    fireEvent.click(document.getElementById('LeaveSettings.config.submit') as HTMLButtonElement)

    await waitFor(() =>
      expect(saveConfigMock).toHaveBeenCalledWith(
        expect.objectContaining({
          accrualFrequency: 'QUARTERLY',
          expirationMonths: 12,
        }),
      ),
    )
    expect(saveConfigMock.mock.calls[0][0]).not.toHaveProperty('creditMonth')
    expect(saveConfigMock.mock.calls[0][0]).not.toHaveProperty('creditDay')
  })

  it('envoie la date de fin d’application et l’autorisation de solde négatif', async () => {
    configsMock.mockResolvedValue([])
    saveConfigMock.mockResolvedValue(config())

    render(<LeaveSettings />)
    await waitFor(() => expect(configsMock).toHaveBeenCalled())

    fireEvent.change(document.getElementById('LeaveSettings.config.amount') as HTMLInputElement, {
      target: { value: '5' },
    })
    fireEvent.change(
      document.getElementById('LeaveSettings.config.effectiveDate') as HTMLInputElement,
      { target: { value: '2026-01-01' } },
    )
    fireEvent.change(document.getElementById('LeaveSettings.config.endDate') as HTMLInputElement, {
      target: { value: '2026-12-31' },
    })
    fireEvent.click(
      document.getElementById('LeaveSettings.config.negativeAllowed') as HTMLInputElement,
    )
    fireEvent.click(document.getElementById('LeaveSettings.config.submit') as HTMLButtonElement)

    await waitFor(() =>
      expect(saveConfigMock).toHaveBeenCalledWith(
        expect.objectContaining({
          effectiveDate: '2026-01-01',
          endDate: '2026-12-31',
          negativeAllowed: false,
        }),
      ),
    )
  })

  it('refuse une date de fin antérieure à la date d’effet', async () => {
    configsMock.mockResolvedValue([])

    render(<LeaveSettings />)
    await waitFor(() => expect(configsMock).toHaveBeenCalled())

    fireEvent.change(
      document.getElementById('LeaveSettings.config.effectiveDate') as HTMLInputElement,
      { target: { value: '2026-06-01' } },
    )
    fireEvent.change(document.getElementById('LeaveSettings.config.endDate') as HTMLInputElement, {
      target: { value: '2026-05-31' },
    })
    fireEvent.submit(document.querySelector('form') as HTMLFormElement)

    expect(saveConfigMock).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(document.getElementById('LeaveSettings.formError')?.textContent).toContain(
        "fin d'application",
      ),
    )
  })
})
