import { MESSAGES } from './messages'

let currentLanguage = 'fr'
let remoteMessages: Record<string, string> = {}

export function setTranslationState(
  language: string,
  messages: Record<string, string>,
): void {
  currentLanguage = language
  remoteMessages = messages ?? {}
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  )
}

export function tr(key: string, params?: Record<string, string | number>): string {
  const template =
    remoteMessages[key] ??
    MESSAGES[currentLanguage]?.[key] ??
    MESSAGES.fr[key] ??
    key
  return interpolate(template, params)
}
