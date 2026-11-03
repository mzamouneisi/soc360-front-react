import { api } from './client'
import type {
  BillingDocumentDto,
  BillingSendHistoryDto,
  CreateBillingDocumentRequest,
  GeneratableMonthDto,
  UpdateBillingDocumentRequest,
} from './types'

export const billingApi = {
  list: (socId?: number | null, type?: string) => {
    const params = new URLSearchParams()
    if (socId != null) params.set('socId', String(socId))
    if (type) params.set('type', type)
    const qs = params.toString()
    return api.get<BillingDocumentDto[]>(`/billing${qs ? '?' + qs : ''}`)
  },
  byProject: (projectId: number) => api.get<BillingDocumentDto[]>(`/billing/project/${projectId}`),
  getById: (id: number) => api.get<BillingDocumentDto>(`/billing/${id}`),
  create: (request: CreateBillingDocumentRequest) => api.post<BillingDocumentDto>('/billing', request),
  update: (id: number, request: UpdateBillingDocumentRequest) => api.put<BillingDocumentDto>(`/billing/${id}`, request),
  delete: (id: number) => api.delete<void>(`/billing/${id}`),
  pdfUrl: (id: number) => api.blobUrl(`/billing/${id}/pdf`),
  sendPreview: (id: number) =>
    api.get<{ recipient: string; subject: string; body: string }>(`/billing/${id}/send-preview`),
  send: (id: number) => api.post<BillingDocumentDto>(`/billing/${id}/send`, {}),
  sendHistory: (id: number) => api.get<BillingSendHistoryDto[]>(`/billing/${id}/sends`),
  generateMonths: (socId?: number | null) => {
    const params = new URLSearchParams()
    if (socId != null) params.set('socId', String(socId))
    const qs = params.toString()
    return api.get<GeneratableMonthDto[]>(`/billing/generate-months${qs ? '?' + qs : ''}`)
  },
  generateMonthly: (year: number, month: number, socId?: number | null, overwrite = false) => {
    const params = new URLSearchParams({ year: String(year), month: String(month) })
    if (socId != null) params.set('socId', String(socId))
    if (overwrite) params.set('overwrite', 'true')
    return api.post<BillingDocumentDto[]>(`/billing/generate-monthly?${params.toString()}`, {})
  },
}