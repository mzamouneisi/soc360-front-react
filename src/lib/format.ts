import type {
  CraStatus,
  DayType,
  NoteFraisStatus,
  Role,
  SubscriptionStatus,
  TicketPriority,
  TicketStatus,
} from '../api/types'

export const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

export const MONTHS_FR_SHORT = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
  'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc',
]

export function monthLabel(month: number): string {
  return MONTHS_FR[month - 1] ?? String(month)
}

export function monthShort(month: number): string {
  return MONTHS_FR_SHORT[month - 1] ?? String(month)
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('fr-FR')
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

const currencyFormat = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatMoney(
  value: number | null | undefined,
  currency: string | null | undefined = 'EUR',
): string {
  if (value === null || value === undefined) return '—'
  if (currency && currency !== 'EUR') {
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value)} ${currency}`
  }
  return currencyFormat.format(value)
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
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
  SEMI_VALID: 'Semi-validé',
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
    case 'SEMI_VALID':
      return 'info'
    case 'CANCELLED':
      return 'warning'
    default:
      return 'muted'
  }
}
