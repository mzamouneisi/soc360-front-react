import { api } from './client'
import type { HrDocumentDto } from './types'

export interface DocumentUploadRequest {
  consultantId?: number | null
  socId?: number | null
  category: string
  expiresAt?: string | null
  description?: string | null
  visibility?: string
  sharedWith?: number[]
}

export interface ShareTarget {
  id: number
  fullName: string
  role: string
}

export const documentsApi = {
  findAll: (params?: { consultantId?: number; socId?: number }) =>
    api.get<HrDocumentDto[]>('/documents', params),
  shareTargets: () => api.get<ShareTarget[]>('/documents/share-targets'),
  upload: (file: File, request: DocumentUploadRequest) => {
    const formData = new FormData()
    formData.append('file', file)
    if (request.consultantId) formData.append('consultantId', String(request.consultantId))
    if (request.socId) formData.append('socId', String(request.socId))
    formData.append('category', request.category)
    if (request.expiresAt) formData.append('expiresAt', request.expiresAt)
    if (request.description) formData.append('description', request.description)
    formData.append('visibility', request.visibility ?? 'PRIVATE')
    for (const userId of request.sharedWith ?? []) {
      formData.append('sharedWith', String(userId))
    }
    return api.upload<HrDocumentDto>('/documents/upload', formData)
  },
  share: (id: number, userIds: number[]) =>
    api.post<void>(`/documents/${id}/share`, userIds),
  download: (id: number, name: string) => api.download(`/documents/${id}/download`, name),
  previewUrl: (id: number) => api.blobUrl(`/documents/${id}/download`),
  delete: (id: number) => api.delete<void>(`/documents/${id}`),
}
