import { api } from './client'
import type { PageResponse } from './types'
import type { ConsultantDto, ConsultantRequest, ConsultantSummary, ManagerSummary, HistoConsultantDto } from './types'

export const consultantsApi = {
  findAll: (params: {
    socId?: number
    search?: string
    page?: number
    size?: number
  }) => api.get<PageResponse<ConsultantDto>>('/consultants', params),
  summaries: (socId: number) => api.get<ConsultantSummary[]>('/consultants/summaries', { socId }),
  managed: () => api.get<ConsultantSummary[]>('/consultants/managed'),
  filterList: () => api.get<ConsultantSummary[]>('/consultants/filter-list'),
  managers: (socId: number) => api.get<ManagerSummary[]>('/consultants/managers', { socId }),
  getById: (id: number) => api.get<ConsultantDto>(`/consultants/${id}`),
  create: (request: ConsultantRequest) => api.post<ConsultantDto>('/consultants', request),
  update: (id: number, request: ConsultantRequest) =>
    api.put<ConsultantDto>(`/consultants/${id}`, request),
  delete: (id: number) => api.delete<void>(`/consultants/${id}`),
  history: (id: number) => api.get<HistoConsultantDto[]>(`/consultants/${id}/history`),
  updatePerson: (userId: number, request: { firstName: string; lastName: string; email: string | null; phone: string | null; role?: string }) =>
    api.put<ConsultantDto>(`/consultants/persons/${userId}`, request),
  deletePerson: (userId: number) => api.delete<void>(`/consultants/persons/${userId}`),
  importCsv: (file: File, socId: number) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('socId', String(socId))
    return api.upload<{ imported: number; errors: number; errorLines: string[] }>(
      '/batch/consultant/import',
      formData,
    )
  },
}
