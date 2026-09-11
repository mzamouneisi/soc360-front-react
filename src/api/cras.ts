import { api } from './client'
import type { CraDto, CraExchangeDto, SaveCraRequest } from './types'

export const crasApi = {
  getOrCreate: (consultantId: number, year: number, month: number, type = 'CRA') =>
    api.get<CraDto>(`/cras/consultant/${consultantId}/${year}/${month}`, { type }),
  getById: (id: number) => api.get<CraDto>(`/cras/${id}`),
  exchanges: (id: number) => api.get<CraExchangeDto[]>(`/cras/${id}/exchanges`),
  findByConsultant: (consultantId: number, year: number, type = 'CRA') =>
    api.get<CraDto[]>(`/cras/consultant/${consultantId}/${year}`, { type }),
  findByMonth: (year: number, month: number, socId?: number, type = 'CRA') =>
    api.get<CraDto[]>(`/cras/month/${year}/${month}`, { socId, type }),
  findBySocYear: (socId: number, year: number, type = 'CRA') =>
    api.get<CraDto[]>(`/cras/soc/${socId}/${year}`, { type }),
  save: (id: number, request: SaveCraRequest) =>
    api.put<CraDto>(`/cras/${id}/days`, request),
  submit: (id: number) => api.post<CraDto>(`/cras/${id}/submit`),
  convertToCra: (id: number) => api.post<CraDto>(`/cras/${id}/convert`),
  validate: (id: number) => api.post<CraDto>(`/cras/${id}/validate`),
  reject: (id: number, comment: string) =>
    api.post<CraDto>(`/cras/${id}/reject`, { comment }),
  sendBack: (id: number, comment: string) =>
    api.post<CraDto>(`/cras/${id}/send-back`, { comment }),
  delete: (id: number) => api.delete<void>(`/cras/${id}`),
  // Indispos (congés) : validation par le manager
  setActivityValid: (id: number, cdaId: number) =>
    api.post<CraDto>(`/cras/${id}/activities/${cdaId}/valid`),
  setActivityInvalid: (id: number, cdaId: number) =>
    api.post<CraDto>(`/cras/${id}/activities/${cdaId}/invalid`),
  validateRange: (id: number, startDate: string, endDate: string) =>
    api.post<CraDto>(`/cras/${id}/validate-range`, { startDate, endDate }),
  invalidateRange: (id: number, startDate: string, endDate: string) =>
    api.post<CraDto>(`/cras/${id}/invalidate-range`, { startDate, endDate }),
  markPendingSend: (id: number) => api.post<CraDto>(`/cras/${id}/indispo/save`),
  sendIndispo: (id: number, comment?: string) =>
    api.post<CraDto>(`/cras/${id}/indispo/send`, { comment: comment ?? null }),
  cancel: (id: number, comment: string) =>
    api.post<CraDto>(`/cras/${id}/cancel`, { comment }),
  exportCsv: (params: { socId?: number; month: number; year: number }) =>
    api.download(`/cras/export/csv?month=${params.month}&year=${params.year}${params.socId ? `&socId=${params.socId}` : ''}`, `cra-${params.month}-${params.year}.csv`),
  exportPdf: (params: { socId?: number; month: number; year: number }) =>
    api.download(`/cras/export/pdf?month=${params.month}&year=${params.year}${params.socId ? `&socId=${params.socId}` : ''}`, `cra-${params.month}-${params.year}.pdf`),
  exportClientPdf: (id: number) =>
    api.download(`/cras/${id}/export/client`, `cra-client.pdf`),
  exportCompanyPdf: (id: number) =>
    api.download(`/cras/${id}/export/company`, `cra-societe.pdf`),
}
