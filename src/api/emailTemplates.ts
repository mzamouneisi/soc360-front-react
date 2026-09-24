import { api } from './client'

export interface EmailTemplateView {
  key: string
  subject: string
  body: string
  custom: boolean
  variables: string[]
  defaultSubject: string
  defaultBody: string
}

export interface EmailTemplateSaveRequest {
  subject: string
  body: string
}

export const emailTemplatesApi = {
  list: () => api.get<EmailTemplateView[]>('/email-templates'),
  save: (key: string, payload: EmailTemplateSaveRequest) =>
    api.put<EmailTemplateView>(`/email-templates/${encodeURIComponent(key)}`, payload),
  reset: (key: string) => api.delete<void>(`/email-templates/${encodeURIComponent(key)}`),
}
