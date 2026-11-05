import { api } from './client'
import type { ProspectDto, ProspectNoteRequest, ProspectRequest, ProspectTarget } from './types'

export const prospectsApi = {
  findAll: (socId?: number) => api.get<ProspectDto[]>('/prospects', { socId }),
  get: (id: number) => api.get<ProspectDto>(`/prospects/${id}`),
  create: (request: ProspectRequest) => api.post<ProspectDto>('/prospects', request),
  update: (id: number, request: ProspectRequest) =>
    api.put<ProspectDto>(`/prospects/${id}`, request),
  delete: (id: number) => api.delete<void>(`/prospects/${id}`),
  addNote: (id: number, request: ProspectNoteRequest) =>
    api.post<ProspectDto>(`/prospects/${id}/notes`, request),
  deleteNote: (id: number, noteId: number) =>
    api.delete<ProspectDto>(`/prospects/${id}/notes/${noteId}`),
  convert: (id: number, target: ProspectTarget) =>
    api.post<ProspectDto>(`/prospects/${id}/convert?target=${target}`, {}),
}
