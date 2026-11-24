import { api } from './client'
import type {
  AppearanceConfigDto,
  AppearanceScope,
  EffectiveAppearanceDto,
} from './types'

export const appearanceApi = {
  effective: () => api.get<EffectiveAppearanceDto>('/appearance/effective'),
  get: (scope: AppearanceScope) => api.get<AppearanceConfigDto>(`/appearance/${scope}`),
  save: (scope: AppearanceScope, config: Record<string, string>) =>
    api.put<AppearanceConfigDto>(`/appearance/${scope}`, { config }),
  reset: (scope: AppearanceScope) => api.delete<void>(`/appearance/${scope}`),
}
