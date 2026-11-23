import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LeaveSettings } from './LeaveSettings'
import type { LeaveConfigDto } from '../api/types'

const {
  configsMock,
  saveConfigMock,
  setConfigActiveMock,
  deleteConfigCascadeMock,
  confirmMock,
} = vi.hoisted(() => ({
  configsMock: vi.fn(),
  saveConfigMock: vi.fn(),
  setConfigActiveMock: vi.fn(),
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
    acquisitionMode: 'START_OF_PERIOD',
    referencePeriod: 'CALENDAR_YEAR',
    referenceStartMonth: null,
    referenceStartDay: null,
    acquisitionStartMonth: null,
    acquisitionStartDay: null,
    acquisitionEndMonth: null,
    acquisitionEndDay: null,
    usageStartMonth: null,
    usageStartDay: null,
    usageEndMonth: null,
    usageEndDay: null,
    expirationPolicy: 'AFTER_DURATION',
    expirationMonths: 12,
    expirationDate: null,
    expirationMonth: null,
    carryoverAllowed: false,
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

async function waitForRow() {
  await waitFor(() => expect(document.getElementById('LeaveSettings.configs.1.param.type')).not.toBeNull())
}

function parseDateField(value: string): { day: string; month: string; year: string } {
  if (value.includes('/')) {
    const [day, month, year] = value.split('/')
    return { day, month, year }
  }
  const [year, month, day] = value.split('-')
  return { day, month, year }
}

describe('LeaveSettings — refonte des règles', () => {
  it('affiche l’historique d’activation par utilisateur après clic sur le bouton', async () => {
    configsMock.mockResolvedValue([config()])

    render(<LeaveSettings />)
    await waitForRow()

    expect(document.getElementById('LeaveSettings.configs.1.historique.table')).toBeNull()
    fireEvent.click(document.getElementById('LeaveSettings.configs.1.historique.toggle') as HTMLElement)

    expect(document.getElementById('LeaveSettings.configs.1.historique.table')).not.toBeNull()
    expect(
      document.getElementById('LeaveSettings.configs.1.historique.row.100.statut')?.textContent,
    ).toBe('Activation')
    expect(
      document.getElementById('LeaveSettings.configs.1.historique.row.100.user')?.textContent,
    ).toBe('Alice Martin')
  })

  it('affiche une synthèse des règles de chaque configuration', async () => {
    configsMock.mockResolvedValue([
      config({
        accrualAmount: 2.5,
        accrualFrequency: 'MONTHLY',
        acquisitionMode: 'END_OF_PERIOD',
        referencePeriod: 'CUSTOM',
        referenceStartMonth: 6,
        referenceStartDay: 1,
        expirationPolicy: 'MONTH_OF_FOLLOWING_PERIOD',
        expirationMonths: null,
        expirationMonth: 5,
        carryoverAllowed: true,
        carryoverMax: 10,
        carryoverExpirationMonths: 3,
        negativeAllowed: false,
      }),
    ])

    render(<LeaveSettings />)
    await waitForRow()

    const value = (key: string) =>
      document.getElementById(`LeaveSettings.configs.1.param.${key}`)?.textContent ?? ''
    expect(value('type')).toBe('CP')
    expect(value('acquisition')).toContain('2.5')
    expect(value('acquisition')).toContain('Mensuelle')
    expect(value('acquisition')).toContain('Fin de période')
    expect(value('reference')).toBe('Cycle 01/06')
    expect(value('expiration')).toBe('Mois 5 (période suivante)')
    expect(value('report')).toBe('Max 10 j (échéance 3 mois)')
    expect(value('negative')).toBe('Non autorisé')
    expect(document.getElementById('LeaveSettings.configs.1.statut')).toHaveTextContent('Actif')
  })

  it('pagine le tableau des configurations existantes', async () => {
    configsMock.mockResolvedValue(
      Array.from({ length: 7 }, (_, index) =>
        config({ id: index + 1, leaveType: index % 2 === 0 ? 'CP' : 'RTT' }),
      ),
    )

    render(<LeaveSettings />)
    await waitFor(() => expect(configsMock).toHaveBeenCalled())
    expect(document.getElementById('LeaveSettings.configs.page')).toHaveTextContent('Page 1 / 2')

    fireEvent.click(document.getElementById('LeaveSettings.configs.next') as HTMLElement)

    await waitFor(() =>
      expect(document.getElementById('LeaveSettings.configs.6.param.type')).toBeInTheDocument(),
    )
    expect(document.getElementById('LeaveSettings.configs.1.param.type')).toBeNull()
  })

  it('désactive une configuration active via le bouton', async () => {
    configsMock.mockResolvedValue([config()])
    setConfigActiveMock.mockResolvedValue(config({ active: false }))

    render(<LeaveSettings />)
    const toggle = (await screen.findByRole('button', { name: 'Désactiver' })) as HTMLButtonElement
    fireEvent.click(toggle)

    await waitFor(() => expect(setConfigActiveMock).toHaveBeenCalledWith(1, false))
  })

  it('propose le bouton de suppression en cascade pour une configuration référencée', async () => {
    configsMock.mockResolvedValue([config({ deletable: false })])

    render(<LeaveSettings />)
    await waitForRow()
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

  it('pré-remplit la date d’effet au 1er janvier de l’année en cours et les valeurs par défaut', async () => {
    configsMock.mockResolvedValue([])
    render(<LeaveSettings />)
    await waitFor(() => expect(configsMock).toHaveBeenCalled())

    const effectiveDate = (document.getElementById('LeaveSettings.config.effectiveDate') as HTMLInputElement).value
    const parsed = parseDateField(effectiveDate)
    expect(parsed.day).toBe('01')
    expect(parsed.month).toBe('01')
    expect(parsed.year).toBe(String(new Date().getFullYear()))
    expect((document.getElementById('LeaveSettings.config.amount') as HTMLInputElement).value).toBe('1')
    expect(document.getElementById('LeaveSettings.config.creditMonth')).toBeNull()
    expect(document.getElementById('LeaveSettings.config.creditDay')).toBeNull()
  })

  it('affiche les champs d’expiration selon la politique choisie', async () => {
    configsMock.mockResolvedValue([])
    render(<LeaveSettings />)
    await waitFor(() => expect(configsMock).toHaveBeenCalled())

    const policy = document.getElementById('LeaveSettings.config.expirationPolicy') as HTMLSelectElement
    expect(document.getElementById('LeaveSettings.config.expirationMonths')).not.toBeNull()

    fireEvent.change(policy, { target: { value: 'NONE' } })
    expect(document.getElementById('LeaveSettings.config.expirationMonths')).toBeNull()
    expect(document.getElementById('LeaveSettings.config.expirationDate')).toBeNull()

    fireEvent.change(policy, { target: { value: 'FIXED_DATE' } })
    expect(document.getElementById('LeaveSettings.config.expirationDate')).not.toBeNull()

    fireEvent.change(policy, { target: { value: 'MONTH_OF_FOLLOWING_PERIOD' } })
    expect(document.getElementById('LeaveSettings.config.expirationMonth')).not.toBeNull()
  })

  it('n’affiche le maximum d’anticipation que si le solde négatif est autorisé', async () => {
    configsMock.mockResolvedValue([])
    render(<LeaveSettings />)
    await waitFor(() => expect(configsMock).toHaveBeenCalled())

    expect(document.getElementById('LeaveSettings.config.negativeLimit')).not.toBeNull()
    fireEvent.click(document.getElementById('LeaveSettings.config.negativeAllowed') as HTMLInputElement)
    expect(document.getElementById('LeaveSettings.config.negativeLimit')).toBeNull()
  })

  it('n’affiche les champs de report que si le report est autorisé', async () => {
    configsMock.mockResolvedValue([])
    render(<LeaveSettings />)
    await waitFor(() => expect(configsMock).toHaveBeenCalled())

    expect(document.getElementById('LeaveSettings.config.carryoverMax')).toBeNull()
    fireEvent.click(document.getElementById('LeaveSettings.config.carryoverAllowed') as HTMLInputElement)
    expect(document.getElementById('LeaveSettings.config.carryoverMax')).not.toBeNull()
    expect(document.getElementById('LeaveSettings.config.carryoverExpirationMonths')).not.toBeNull()
  })

  it('affiche les champs de cycle personnalisé lorsque la période est personnalisée', async () => {
    configsMock.mockResolvedValue([])
    render(<LeaveSettings />)
    await waitFor(() => expect(configsMock).toHaveBeenCalled())

    expect(document.getElementById('LeaveSettings.config.referenceStartMonth')).toBeNull()
    fireEvent.change(document.getElementById('LeaveSettings.config.referencePeriod') as HTMLSelectElement, {
      target: { value: 'CUSTOM' },
    })
    expect(document.getElementById('LeaveSettings.config.referenceStartMonth')).not.toBeNull()
    expect(document.getElementById('LeaveSettings.config.referenceStartDay')).not.toBeNull()
  })

  it('modifie une configuration existante en pré-remplissant le formulaire', async () => {
    configsMock.mockResolvedValue([config({ accrualAmount: 7 })])
    render(<LeaveSettings />)
    await waitForRow()

    fireEvent.click(document.getElementById('LeaveSettings.configs.1.modifier') as HTMLElement)

    expect(document.getElementById('LeaveSettings.config.title')).toHaveTextContent('Modifier')
    expect((document.getElementById('LeaveSettings.config.amount') as HTMLInputElement).value).toBe('7')
    expect(document.getElementById('LeaveSettings.config.cancel')).not.toBeNull()
  })

  it('duplique une configuration avec une nouvelle date d’effet', async () => {
    configsMock.mockResolvedValue([config({ effectiveDate: '2026-03-15' })])
    render(<LeaveSettings />)
    await waitForRow()

    fireEvent.click(document.getElementById('LeaveSettings.configs.1.dupliquer') as HTMLElement)

    const effectiveDate = (document.getElementById('LeaveSettings.config.effectiveDate') as HTMLInputElement).value
    const day = effectiveDate.startsWith('0') ? effectiveDate.slice(0, 2) : effectiveDate.slice(-2)
    expect(day).toBe('01')
    expect(effectiveDate).not.toBe('2026-03-15')
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
        expect(document.getElementById('LeaveSettings.formError')?.textContent).toContain('supérieure à 0'),
      )
    }
  })

  it('refuse une durée d’expiration hors bornes', async () => {
    configsMock.mockResolvedValue([])
    render(<LeaveSettings />)
    await waitFor(() => expect(configsMock).toHaveBeenCalled())

    fireEvent.change(document.getElementById('LeaveSettings.config.amount') as HTMLInputElement, {
      target: { value: '5' },
    })
    const expiration = document.getElementById('LeaveSettings.config.expirationMonths') as HTMLInputElement

    for (const value of ['0', '121']) {
      fireEvent.change(expiration, { target: { value } })
      fireEvent.submit(document.querySelector('form') as HTMLFormElement)
      expect(saveConfigMock).not.toHaveBeenCalled()
      await waitFor(() =>
        expect(document.getElementById('LeaveSettings.formError')?.textContent).toContain('1 et 120'),
      )
    }
  })

  it('accepte une durée d’expiration supérieure à 12 mois', async () => {
    configsMock.mockResolvedValue([])
    saveConfigMock.mockResolvedValue(config())
    render(<LeaveSettings />)
    await waitFor(() => expect(configsMock).toHaveBeenCalled())

    fireEvent.change(document.getElementById('LeaveSettings.config.amount') as HTMLInputElement, {
      target: { value: '5' },
    })
    fireEvent.change(document.getElementById('LeaveSettings.config.expirationMonths') as HTMLInputElement, {
      target: { value: '24' },
    })
    fireEvent.submit(document.querySelector('form') as HTMLFormElement)

    await waitFor(() =>
      expect(saveConfigMock).toHaveBeenCalledWith(
        expect.objectContaining({ expirationPolicy: 'AFTER_DURATION', expirationMonths: 24 }),
      ),
    )
  })

  it('refuse une date de fin antérieure à la date d’effet', async () => {
    configsMock.mockResolvedValue([])
    render(<LeaveSettings />)
    await waitFor(() => expect(configsMock).toHaveBeenCalled())

    fireEvent.change(document.getElementById('LeaveSettings.config.effectiveDate') as HTMLInputElement, {
      target: { value: '2026-06-01' },
    })
    fireEvent.change(document.getElementById('LeaveSettings.config.endDate') as HTMLInputElement, {
      target: { value: '2026-05-31' },
    })
    fireEvent.submit(document.querySelector('form') as HTMLFormElement)

    expect(saveConfigMock).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(document.getElementById('LeaveSettings.formError')?.textContent).toContain("fin d'application"),
    )
  })

  it('envoie la politique d’expiration, le report et le cycle personnalisé', async () => {
    configsMock.mockResolvedValue([])
    saveConfigMock.mockResolvedValue(config())
    render(<LeaveSettings />)
    await waitFor(() => expect(configsMock).toHaveBeenCalled())

    fireEvent.change(document.getElementById('LeaveSettings.config.amount') as HTMLInputElement, {
      target: { value: '5' },
    })
    fireEvent.change(document.getElementById('LeaveSettings.config.acquisitionMode') as HTMLSelectElement, {
      target: { value: 'END_OF_PERIOD' },
    })
    fireEvent.change(document.getElementById('LeaveSettings.config.referencePeriod') as HTMLSelectElement, {
      target: { value: 'CUSTOM' },
    })
    fireEvent.change(document.getElementById('LeaveSettings.config.referenceStartMonth') as HTMLInputElement, {
      target: { value: '6' },
    })
    fireEvent.change(document.getElementById('LeaveSettings.config.referenceStartDay') as HTMLInputElement, {
      target: { value: '1' },
    })
    fireEvent.change(document.getElementById('LeaveSettings.config.expirationPolicy') as HTMLSelectElement, {
      target: { value: 'FIXED_DATE' },
    })
    fireEvent.change(document.getElementById('LeaveSettings.config.expirationDate') as HTMLInputElement, {
      target: { value: '2027-06-30' },
    })
    fireEvent.click(document.getElementById('LeaveSettings.config.carryoverAllowed') as HTMLInputElement)
    fireEvent.change(document.getElementById('LeaveSettings.config.carryoverMax') as HTMLInputElement, {
      target: { value: '10' },
    })
    fireEvent.change(document.getElementById('LeaveSettings.config.carryoverExpirationMonths') as HTMLInputElement, {
      target: { value: '3' },
    })
    fireEvent.change(document.getElementById('LeaveSettings.config.negativeLimit') as HTMLInputElement, {
      target: { value: '5' },
    })
    fireEvent.click(document.getElementById('LeaveSettings.config.submit') as HTMLButtonElement)

    await waitFor(() =>
      expect(saveConfigMock).toHaveBeenCalledWith(
        expect.objectContaining({
          acquisitionMode: 'END_OF_PERIOD',
          referencePeriod: 'CUSTOM',
          referenceStartMonth: 6,
          referenceStartDay: 1,
          expirationPolicy: 'FIXED_DATE',
          expirationDate: '2027-06-30',
          carryoverAllowed: true,
          carryoverMax: 10,
          carryoverExpirationMonths: 3,
          negativeAllowed: true,
          negativeLimit: 5,
        }),
      ),
    )
  })
})
