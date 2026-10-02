import { api } from './client'
import type { UnavailabilityTypeConfigDto, UnavailabilityTypeConfigRow } from './types'

export const unavailabilityTypesApi = {
  list: (socId?: number | null) =>
    api.get<UnavailabilityTypeConfigDto[]>('/unavailability-types', { socId: socId ?? undefined }),
  save: (socId: number | null, rows: UnavailabilityTypeConfigRow[]) =>
    api.put<UnavailabilityTypeConfigDto[]>('/unavailability-types', { socId, rows }),
}
