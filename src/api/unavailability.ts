import { api } from './client'
import type { UnavailabilityDto, UnavailabilityHistoryDto, UnavailabilityRequest } from './types'

export const unavailabilityApi = {
  list: (params: { consultantId?: number; socId?: number } = {}) =>
    api.get<UnavailabilityDto[]>('/unavailabilities', params),
  create: (request: UnavailabilityRequest) =>
    api.post<UnavailabilityDto>('/unavailabilities', request),
  update: (id: number, request: UnavailabilityRequest) =>
    api.put<UnavailabilityDto>(`/unavailabilities/${id}`, request),
  submit: (id: number) => api.post<UnavailabilityDto>(`/unavailabilities/${id}/submit`),
  cancel: (id: number) => api.post<UnavailabilityDto>(`/unavailabilities/${id}/cancel`),
  validate: (id: number, comment: string) =>
    api.post<UnavailabilityDto>(`/unavailabilities/${id}/validate`, { comment }),
  reject: (id: number, comment: string) =>
    api.post<UnavailabilityDto>(`/unavailabilities/${id}/reject`, { comment }),
  history: (id: number) => api.get<UnavailabilityHistoryDto[]>(`/unavailabilities/${id}/history`),
  delete: (id: number) => api.delete<void>(`/unavailabilities/${id}`),
}