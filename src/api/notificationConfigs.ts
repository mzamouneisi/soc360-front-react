import { api } from './client'
import type {
  NotificationConfigDto,
  NotificationConfigRequest,
  NotificationConfigStatus,
  NotificationExecutionDto,
} from './types'

export const notificationConfigsApi = {
  list: (socId?: number | null) => api.get<NotificationConfigDto[]>('/notification-configs', { socId }),
  get: (id: number) => api.get<NotificationConfigDto>(`/notification-configs/${id}`),
  save: (request: NotificationConfigRequest) =>
    api.post<NotificationConfigDto>('/notification-configs', request),
  setStatus: (id: number, status: NotificationConfigStatus) =>
    api.post<NotificationConfigDto>(`/notification-configs/${id}/status?status=${status}`, {}),
  run: (id: number) => api.post<NotificationExecutionDto>(`/notification-configs/${id}/run`, {}),
  remove: (id: number) => api.delete<void>(`/notification-configs/${id}`),
  executions: (socId?: number | null) =>
    api.get<NotificationExecutionDto[]>('/notification-configs/executions', { socId }),
  executionsByConfig: (id: number) =>
    api.get<NotificationExecutionDto[]>(`/notification-configs/${id}/executions`),
}
