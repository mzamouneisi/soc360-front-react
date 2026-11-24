import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AppearanceSettings } from './AppearanceSettings'
import type { EffectiveAppearanceDto } from '../api/types'

const { effectiveMock, getMock, saveMock, resetMock, confirmMock, userMock } = vi.hoisted(() => ({
  effectiveMock: vi.fn(),
  getMock: vi.fn(),
  saveMock: vi.fn(),
  resetMock: vi.fn(),
  confirmMock: vi.fn(),
  userMock: { value: { id: 2, role: 'RESPONSIBLE_SOC', socId: 10 } },
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: userMock.value }),
}))

vi.mock('../api/appearance', () => ({
  appearanceApi: {
    effective: effectiveMock,
    get: getMock,
    save: saveMock,
    reset: resetMock,
  },
}))

vi.mock('../components/dialog', () => ({
  dialog: { success: vi.fn(), error: vi.fn(), confirm: confirmMock },
}))

function effective(overrides: Partial<EffectiveAppearanceDto> = {}): EffectiveAppearanceDto {
  return {
    config: {
      primaryColor: '#16a34a',
      menuColor: '#424242',
      backgroundColor: '#000000',
    },
    sources: {
      primaryColor: 'SOC',
      menuColor: 'GLOBAL',
      backgroundColor: 'USER',
    },
    userDefined: true,
    socDefined: true,
    ...overrides,
  }
}

afterEach(() => {
  vi.clearAllMocks()
  userMock.value = { id: 2, role: 'RESPONSIBLE_SOC', socId: 10 }
})

describe('AppearanceSettings', () => {
  it('affiche l’apparence effective et l’origine de chaque paramètre', async () => {
    effectiveMock.mockResolvedValue(effective())
    getMock.mockResolvedValue({ scope: 'USER', scopeId: 2, config: {}, defined: false })

    render(<AppearanceSettings />)

    await waitFor(() =>
      expect(document.getElementById('Appearance.effective.primaryColor.value')?.textContent).toBe(
        '#16a34a',
      ),
    )
    expect(document.getElementById('Appearance.effective.primaryColor.source')?.textContent).toBe(
      'Société',
    )
    expect(document.getElementById('Appearance.effective.menuColor.source')?.textContent).toBe(
      'SOC360',
    )
    expect(
      document.getElementById('Appearance.effective.backgroundColor.source')?.textContent,
    ).toBe('Utilisateur')
  })

  it('enregistre la personnalisation individuelle', async () => {
    userMock.value = { id: 2, role: 'CONSULTANT', socId: 10 }
    effectiveMock.mockResolvedValue(effective())
    getMock.mockResolvedValue({
      scope: 'USER',
      scopeId: 2,
      config: { primaryColor: '#111111' },
      defined: true,
    })
    saveMock.mockResolvedValue({ scope: 'USER', scopeId: 2, config: {}, defined: true })

    render(<AppearanceSettings />)
    await waitFor(() =>
      expect(
        (document.getElementById('Appearance.USER.primaryColor') as HTMLInputElement).value,
      ).toBe('#111111'),
    )

    fireEvent.change(
      document.getElementById('Appearance.USER.backgroundColor') as HTMLInputElement,
      { target: { value: '#222222' } },
    )
    fireEvent.click(document.getElementById('Appearance.save') as HTMLButtonElement)

    await waitFor(() =>
      expect(saveMock).toHaveBeenCalledWith('USER', {
        primaryColor: '#111111',
        backgroundColor: '#222222',
      }),
    )
  })

  it('restaure le paramétrage de la société après confirmation', async () => {
    userMock.value = { id: 2, role: 'CONSULTANT', socId: 10 }
    effectiveMock.mockResolvedValue(effective({ userDefined: false }))
    getMock.mockResolvedValue({ scope: 'USER', scopeId: 2, config: {}, defined: true })
    resetMock.mockResolvedValue(undefined)
    confirmMock.mockResolvedValue(true)

    render(<AppearanceSettings />)
    await screen.findByText('Apparence effective')
    fireEvent.click(document.getElementById('Appearance.reset') as HTMLButtonElement)

    await waitFor(() => expect(resetMock).toHaveBeenCalledWith('USER'))
    expect(confirmMock).toHaveBeenCalled()
  })

  it('propose le niveau société au responsable de société', async () => {
    effectiveMock.mockResolvedValue(effective())
    getMock.mockResolvedValue({ scope: 'USER', scopeId: 2, config: {}, defined: false })

    render(<AppearanceSettings />)
    await waitFor(() => expect(document.getElementById('Appearance.scope.SOC')).not.toBeNull())
    expect(document.getElementById('Appearance.scope.GLOBAL')).toBeNull()
  })
})
