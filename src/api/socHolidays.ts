import { api } from './client'
import type { HolidayPaidStatus, SocHolidayDto } from './types'

export const socHolidaysApi = {
  list: (year: number) => api.get<SocHolidayDto[]>(`/soc-holidays/${year}`),
  create: (date: string, label: string, isChomePaye: HolidayPaidStatus) =>
    api.post<SocHolidayDto>('/soc-holidays', { date, label, isChomePaye }),
  update: (id: number, date: string, label: string, isChomePaye: HolidayPaidStatus) =>
    api.put<SocHolidayDto>(`/soc-holidays/${id}`, { date, label, isChomePaye }),
  delete: (id: number) => api.delete<void>(`/soc-holidays/${id}`),
  duplicate: (year: number) => api.post<number>(`/soc-holidays/${year}/duplicate`),
}