import { api } from './client'
import type { CreateNoteFraisRequest, NoteFraisDto, NoteFraisHistoryDto } from './types'

export const noteFraisApi = {
  findBySocYear: (socId: number, year: number) =>
    api.get<NoteFraisDto[]>(`/note-frais/soc/${socId}/${year}`),
  findByConsultantYear: (consultantId: number, year: number) =>
    api.get<NoteFraisDto[]>(`/note-frais/consultant/${consultantId}/${year}`),
  getById: (id: number) => api.get<NoteFraisDto>(`/note-frais/${id}`),
  create: (request: CreateNoteFraisRequest) =>
    api.post<NoteFraisDto>('/note-frais', request),
  update: (id: number, request: CreateNoteFraisRequest) =>
    api.put<NoteFraisDto>(`/note-frais/${id}`, request),
  submit: (id: number) => api.post<NoteFraisDto>(`/note-frais/${id}/submit`),
  cancel: (id: number) => api.post<NoteFraisDto>(`/note-frais/${id}/cancel`),
  history: (id: number) => api.get<NoteFraisHistoryDto[]>(`/note-frais/${id}/history`),
  validate: (id: number) => api.post<NoteFraisDto>(`/note-frais/${id}/validate`),
  reject: (id: number, comment: string) =>
    api.post<NoteFraisDto>(`/note-frais/${id}/reject`, { comment }),
  delete: (id: number) => api.delete<void>(`/note-frais/${id}`),
  extractText: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.upload<{ text: string }>('/note-frais/extract-text', formData)
  },
  totalsByMonth: (socId: number, year: number) =>
    api.get<Record<string, number>>(`/note-frais/stats/by-month/${socId}/${year}`),
  totalsByCategory: (socId: number, year: number) =>
    api.get<Record<string, number>>(`/note-frais/stats/by-category/${socId}/${year}`),
  totalsByConsultant: (socId: number, year: number) =>
    api.get<Record<string, number>>(`/note-frais/stats/by-consultant/${socId}/${year}`),
}
