import type {
  CraStatus,
  DayType,
  NoteFraisStatus,
  Role,
  SubscriptionStatus,
  TicketPriority,
  TicketStatus,
  UnavailabilityStatus,
  UnavailabilityType,
} from '../api/types'

export const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

export const MONTHS_FR_SHORT = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
  'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc',
]

export const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export const MONTHS_EN_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

let currentLocale = 'fr-FR'
let currentLanguage: 'fr' | 'en' = 'fr'

export function setFormatLocale(locale: string): void {
  currentLocale = locale || 'fr-FR'
  currentLanguage = locale?.toLowerCase().startsWith('en') ? 'en' : 'fr'
}

export function getFormatLocale(): string {
  return currentLocale
}

export function monthLabel(month: number): string {
  const months = currentLanguage === 'en' ? MONTHS_EN : MONTHS_FR
  return months[month - 1] ?? String(month)
}

export function monthShort(month: number): string {
  const months = currentLanguage === 'en' ? MONTHS_EN_SHORT : MONTHS_FR_SHORT
  return months[month - 1] ?? String(month)
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(currentLocale)
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(currentLocale, { dateStyle: 'short', timeStyle: 'short' })
}

export function formatMoney(
  value: number | null | undefined,
  currency: string | null | undefined = 'EUR',
): string {
  if (value === null || value === undefined) return '—'
  if (currency && currency !== 'EUR') {
    if (currentLanguage === 'en') {
      return new Intl.NumberFormat(currentLocale, {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value)
    }
    return `${new Intl.NumberFormat(currentLocale, { maximumFractionDigits: 2 }).format(value)} ${currency}`
  }
  return new Intl.NumberFormat(currentLocale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatSize(bytes: number): string {
  const units = currentLanguage === 'en'
    ? { b: 'B', kb: 'KB', mb: 'MB' }
    : { b: 'o', kb: 'Ko', mb: 'Mo' }
  if (bytes < 1024) return `${bytes} ${units.b}`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ${units.kb}`
  return `${(bytes / (1024 * 1024)).toFixed(1)} ${units.mb}`
}

export function initials(firstName?: string, lastName?: string): string {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || '?'
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrateur',
  RESPONSIBLE_SOC: 'Responsable société',
  MANAGER: 'Manager',
  CONSULTANT: 'Consultant',
}

export const CRA_STATUS_LABELS: Record<CraStatus, string> = {
  DRAFT: 'Brouillon',
  SUBMITTED: 'Soumis',
  PENDING_SEND: 'En attente d’envoi',
  VALIDATED: 'Validé',
  VALREJ: 'Partiellement validé',
  REJECTED: 'Rejeté',
  CANCELLED: 'Annulé',
}

export const NOTE_FRAIS_STATUS_LABELS: Record<NoteFraisStatus, string> = {
  DRAFT: 'Brouillon',
  SUBMITTED: 'Soumise',
  VALIDATED: 'Validée',
  REJECTED: 'Rejetée',
  PAID: 'Payée',
}

export const UNAVAILABILITY_STATUS_LABELS: Record<UnavailabilityStatus, string> = {
  DRAFT: 'Brouillon',
  SUBMITTED: 'Soumise',
  VALIDATED: 'Validée',
  REJECTED: 'Rejetée',
}

export const UNAVAILABILITY_TYPE_LABELS: Record<UnavailabilityType, string> = {
  CONGE_PAYE: 'Congé payé',
  CONGE_RTT: 'Congé RTT',
  CONGE_NON_PAYE: 'Congé non payé',
  CONGE_MALADIE: 'Congé maladie',
  CONGE_MATERNITE: 'Congé maternité',
}

export const DAY_TYPE_LABELS: Record<DayType, string> = {
  WORKED: 'Travail',
  WEEKEND: 'Week-end',
  PUBLIC_HOLIDAY: 'Jour férié',
  LEAVE: 'Congé',
  SICK_LEAVE: 'Maladie',
  OTHER: 'Autre',
}

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  TRIAL: 'Essai',
  ACTIVE: 'Active',
  SUSPENDED: 'Suspendue',
  EXPIRED: 'Expirée',
  CANCELLED: 'Annulée',
}

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Ouvert',
  IN_PROGRESS: 'En cours',
  RESOLVED: 'Résolu',
  CLOSED: 'Clos',
}

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: 'Basse',
  MEDIUM: 'Moyenne',
  HIGH: 'Haute',
  URGENT: 'Urgente',
}

export const DOCUMENT_CATEGORIES = [
  'Contrat',
  'Avenant',
  'Fiche de paie',
  'Attestation',
  'RIB',
  'Identité',
  'Diplôme',
  'Carte vitale',
  'Convention',
  'Autre',
] as const

export const NOTE_FRAIS_CATEGORIES = [
  'Restaurant',
  'Déplacement',
  'Hébergement',
  'Transport',
  'Essence',
  'Péage',
  'Stationnement',
  'Téléphone',
  'Matériel',
  'Autre',
] as const

export function badgeClasses(kind: string): string {
  switch (kind) {
    case 'success':
      return 'bg-green-100 text-green-800'
    case 'warning':
      return 'bg-amber-100 text-amber-800'
    case 'error':
      return 'bg-red-100 text-red-800'
    case 'info':
      return 'bg-sky-100 text-sky-800'
    case 'muted':
      return 'bg-gray-100 text-gray-700'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

export function statusBadge(status: string): string {
  switch (status) {
    case 'VALIDATED':
    case 'PAID':
    case 'ACTIVE':
    case 'RESOLVED':
      return 'success'
    case 'SUBMITTED':
    case 'PENDING_SEND':
    case 'IN_PROGRESS':
    case 'TRIAL':
      return 'info'
    case 'REJECTED':
    case 'SUSPENDED':
    case 'EXPIRED':
    case 'ERROR':
      return 'error'
    case 'DRAFT':
    case 'OPEN':
      return 'muted'
    case 'WARNING':
      return 'warning'
    case 'VALREJ':
      return 'info'
    case 'CANCELLED':
      return 'warning'
    default:
      return 'muted'
  }
}
