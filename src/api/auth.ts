import { api } from './client'
import type {
  AddSocPayload,
  AuthResponse,
  ConnectionDto,
  EmailSentResponse,
  SocLiteDto,
  ResetResponse,
  UserDto,
} from './types'

export interface LoginPayload {
  username: string
  password: string
}

export interface RegisterSocPayload {
  socName: string
  description?: string
  siret?: string
  infosWeb?: string
  gerant?: string
  codeNaf?: string
  urssaf?: string
  website?: string
  street?: string
  zipCode?: string
  city?: string
  country?: string
  categorieEntreprise?: string
  dateCreation?: string
  dateFermeture?: string
  adminFirstName: string
  adminLastName: string
  username: string
  email: string
  password: string
}

export interface CompanyLookup {
  name: string | null
  infosWeb: string | null
  siret: string | null
  codeNaf: string | null
  gerant: string | null
  categorieEntreprise: string | null
  dateCreation: string | null
  dateFermeture: string | null
  website: string | null
  tel: string | null
  street: string | null
  zipCode: string | null
  city: string | null
  country: string | null
}

export const authApi = {
  login: (payload: LoginPayload) => api.post<AuthResponse>('/auth/login', payload),
  registerSoc: (payload: RegisterSocPayload) =>
    api.post<EmailSentResponse>('/auth/register-soc', payload),
  searchSoc: (name?: string, siret?: string) =>
    api.get<CompanyLookup[]>('/auth/search-soc', { name, siret }),
  verifyEmail: (token: string, currentPassword: string, newPassword: string) =>
    api.post<AuthResponse>('/auth/verify-email', { token, currentPassword, newPassword }),
  resendVerification: (email: string) =>
    api.post<EmailSentResponse>('/auth/resend-verification', { email }),
  forgotPassword: (email: string) =>
    api.post<ResetResponse>('/auth/forgot-password', { email }),
  resetPassword: (token: string, newPassword: string) =>
    api.post<void>('/auth/reset-password', { token, newPassword }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<void>('/auth/change-password', { currentPassword, newPassword }),
  me: () => api.get<UserDto>('/auth/me'),
  updateFontSize: (fontSize: number) =>
    api.put<UserDto>('/auth/me/font-size', { fontSize }),
  updateTheme: (theme: string) =>
    api.put<UserDto>('/auth/me/theme', { theme }),
  updateTableColors: (tableHeaderColor: string, tableBorderColor: string) =>
    api.put<UserDto>('/auth/me/table-colors', { tableHeaderColor, tableBorderColor }),
  updatePageSize: (pageSize: number) =>
    api.put<UserDto>('/auth/me/page-size', { pageSize }),
  updateButtonSettings: (payload: {
    buttonSmallWidth: number
    buttonLargeWidth: number
    buttonSaveColor: string
    buttonDeleteColor: string
    buttonCancelColor: string
    buttonCancelTextColor: string
    buttonSubmitColor: string
    buttonSubmitTextColor: string
  }) => api.put<UserDto>('/auth/me/button-settings', payload),
  updateBackgroundColor: (backgroundColor: string) =>
    api.put<UserDto>('/auth/me/background-color', { backgroundColor }),
  updateLanguage: (language: string) =>
    api.put<UserDto>('/auth/me/language', { language }),
  mySocs: () => api.get<SocLiteDto[]>('/auth/me/socs'),
  addSoc: (payload: AddSocPayload) =>
    api.post<SocLiteDto>('/auth/me/socs', payload),
  setFavoriteSoc: (socId: number) =>
    api.put<UserDto>(`/auth/me/socs/${socId}/favorite`),
  connections: () => api.get<ConnectionDto[]>('/auth/connections'),
}
