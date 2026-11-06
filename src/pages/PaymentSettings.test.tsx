import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PaymentSettings } from './PaymentSettings'

const { configMock, updateMock, historyMock } = vi.hoisted(() => ({
  configMock: vi.fn(),
  updateMock: vi.fn(),
  historyMock: vi.fn(),
}))

vi.mock('../api/subscriptionBilling', () => ({
  subscriptionBillingApi: {
    config: configMock,
    updateConfig: updateMock,
    configHistory: historyMock,
  },
}))

const config = {
  id: 1,
  cardEnabled: true,
  paypalEnabled: true,
  cardProvider: 'STRIPE',
  cardPublicKey: null,
  cardSecretConfigured: false,
  cardWebhookConfigured: false,
  paypalClientId: null,
  paypalSecretConfigured: false,
  paypalMode: 'SANDBOX',
  bankAccountHolder: null,
  bankRib: null,
  bankIban: null,
  bankBic: null,
  bankSheetUrl: 'https://docs.google.com/spreadsheets/d/test',
  trialEnabled: true,
  billingEnabled: true,
  currency: 'EUR',
  monthlyPrice: 49,
  updatedAt: '2026-11-05T08:00:00Z',
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('PaymentSettings', () => {
  it('charge la configuration et l’enregistre', async () => {
    configMock.mockResolvedValue(config)
    historyMock.mockResolvedValue([])
    updateMock.mockResolvedValue(config)

    render(<PaymentSettings />)

    const price = await screen.findByDisplayValue('49')
    expect(price).toBeInTheDocument()
    fireEvent.change(price, { target: { value: '59' } })
    fireEvent.submit(document.getElementById('PaymentSettings.form') as HTMLElement)

    await waitFor(() => expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      monthlyPrice: 59,
      cardEnabled: true,
      paypalEnabled: true,
    })))
  })
})
