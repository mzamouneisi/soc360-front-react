import { api } from './client'
import type {
  UnavailabilityTypeConfigDto,
  UnavailabilityTypeConfigRequest,
} from './types'

export const unavailabilityTypesApi = {
  list: (socId?: number | null) =>
    api.get<UnavailabilityTypeConfigDto[]>('/unavailability-types', { socId: socId ?? undefined }),
  active: (socId?: number | null) =>
    api.get<UnavailabilityTypeConfigDto[]>('/unavailability-types/active', {
      socId: socId ?? undefined,
    }),
  create: (request: UnavailabilityTypeConfigRequest) =>
    api.post<UnavailabilityTypeConfigDto>('/unavailability-types', request),
  update: (id: number, request: UnavailabilityTypeConfigRequest) =>
    api.put<UnavailabilityTypeConfigDto>(`/unavailability-types/${id}`, request),
  disable: (id: number) =>
    api.post<UnavailabilityTypeConfigDto>(`/unavailability-types/${id}/disable`),
  remove: (id: number) => api.delete<void>(`/unavailability-types/${id}`),
}
