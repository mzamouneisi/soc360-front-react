import { api } from './client'
import type {
  PaymentConfigDto,
  PaymentConfigHistoryDto,
  PaymentConfigRequest,
  PaymentMethod,
  PaymentOptionsDto,
  SubscriptionPaymentResultDto,
} from './types'

export const subscriptionBillingApi = {
  config: () => api.get<PaymentConfigDto>('/subscription-billing/config'),
  paymentOptions: () => api.get<PaymentOptionsDto>('/subscription-billing/payment-options'),
  updateConfig: (request: PaymentConfigRequest) =>
    api.put<PaymentConfigDto>('/subscription-billing/config', request),
  configHistory: () =>
    api.get<PaymentConfigHistoryDto[]>('/subscription-billing/config/history'),
  overlaps: (socId?: number | null) =>
    api.get<import('./types').OverlapInfoDto>('/subscription-billing/overlaps', { socId }),
  resolveOverlaps: (socId?: number | null) =>
    api.post<import('./types').OverlapInfoDto>(
      `/subscription-billing/overlaps/resolve${socId != null ? `?socId=${socId}` : ''}`, {}),
  pay: (months: number, method: PaymentMethod, socId?: number | null, confirmReplace = false) => {
    const params = new URLSearchParams({ months: String(months), method })
    if (socId != null) params.set('socId', String(socId))
    if (confirmReplace) params.set('confirmReplace', 'true')
    return api.post<SubscriptionPaymentResultDto>(`/subscription-billing/pay?${params.toString()}`, {})
  },
  invoiceUrl: (paymentId: number) => api.blobUrl(`/subscription-billing/payments/${paymentId}/invoice`),
}
