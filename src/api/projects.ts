import { api } from './client'
import type { ProjectDependencyDto, ProjectDto, ProjectRequest } from './types'

export const projectsApi = {
  findAll: (params?: { socId?: number; clientId?: number }) =>
    api.get<ProjectDto[]>('/projects', params),
  getById: (id: number) => api.get<ProjectDto>(`/projects/${id}`),
  create: (request: ProjectRequest) => api.post<ProjectDto>('/projects', request),
  update: (id: number, request: ProjectRequest) =>
    api.put<ProjectDto>(`/projects/${id}`, request),
  delete: (id: number) => api.delete<void>(`/projects/${id}`),
  dependencies: (id: number) =>
    api.get<ProjectDependencyDto[]>(`/projects/${id}/dependencies`),
  deactivate: (id: number) => api.post<ProjectDto>(`/projects/${id}/deactivate`),
}
