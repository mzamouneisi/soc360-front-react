import { api } from './client'
import type { Address, SocDetailDto, SocDto } from './types'

export interface SocRequest {
  name: string
  description?: string | null
  infosWeb?: string | null
  siret?: string | null
  codeNaf?: string | null
  urssaf?: string | null
  gerant?: string | null
  categorieEntreprise?: string | null
  dateCreation?: string | null
  dateFermeture?: string | null
  website?: string | null
  address?: Address | null
}

export interface SocDependency {
  type: string
  id: number
  label: string
}

export interface DemoSocDto {
  number: number
  socId: number
  socName: string
  username: string
  password: string
  clientName: string
  projectName: string
  activityName: string
  consultantName: string
}

export const socsApi = {
  findAll: () => api.get<SocDto[]>('/socs'),
  getById: (id: number) => api.get<SocDetailDto>(`/socs/${id}`),
  create: (request: SocRequest) => api.post<SocDto>('/socs', request),
  createDemo: () => api.post<DemoSocDto>('/socs/demo'),
  update: (id: number, request: Partial<SocDto>) =>
    api.put<SocDto>(`/socs/${id}`, request),
  remove: (id: number) => api.delete<void>(`/socs/${id}`),
  removeWithDependencies: (id: number) => api.delete<void>(`/socs/${id}/all`),
  dependencies: (id: number) => api.get<SocDependency[]>(`/socs/${id}/dependencies`),
  removeDependency: (socId: number, type: string, id: number) =>
    api.delete<void>(`/socs/${socId}/dependencies/${type}/${id}`),
}
