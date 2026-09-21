import { afterEach, describe, expect, it } from 'vitest'
import {
  DAY_TYPE_LABELS,
  MONTHS_FR,
  MONTHS_FR_SHORT,
  NOTE_FRAIS_STATUS_LABELS,
  ROLE_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  badgeClasses,
  formatDate,
  formatDateTime,
  formatMoney,
  formatSize,
  initials,
  monthLabel,
  monthShort,
  setFormatLocale,
  statusBadge,
} from './format'

describe('monthLabel / monthShort', () => {
  it('renvoie le mois français pour un numéro valide', () => {
    expect(monthLabel(1)).toBe('Janvier')
    expect(monthLabel(12)).toBe('Décembre')
    expect(monthShort(6)).toBe('Juin')
  })

  it('renvoie la valeur brute pour un numéro hors bornes', () => {
    expect(monthLabel(13)).toBe('13')
    expect(monthShort(0)).toBe('0')
  })

  it('les tableaux ont 12 entrées', () => {
    expect(MONTHS_FR).toHaveLength(12)
    expect(MONTHS_FR_SHORT).toHaveLength(12)
  })
})

describe('formatDate / formatDateTime', () => {
  it('renvoie un tiret pour les valeurs vides', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate(undefined)).toBe('—')
    expect(formatDate('')).toBe('—')
    expect(formatDateTime(null)).toBe('—')
  })

  it('formate une date ISO', () => {
    expect(formatDate('2025-06-15')).toBe('15/06/2025')
  })

  it('formate une date-heure', () => {
    const out = formatDateTime('2025-06-15T10:30:00Z')
    expect(out).toContain('15/06/2025')
    expect(out).toContain('10:30')
  })

  it('renvoie la valeur brute si la date est invalide', () => {
    expect(formatDate('pas-une-date')).toBe('pas-une-date')
  })
})

describe('formatMoney', () => {
  it('renvoie un tiret pour les valeurs vides', () => {
    expect(formatMoney(null)).toBe('—')
    expect(formatMoney(undefined)).toBe('—')
  })

  it('formate en euros par défaut', () => {
    expect(formatMoney(0)).toContain('0,00')
    expect(formatMoney(1234.5)).toContain('1')
    expect(formatMoney(1234.5)).toContain('€')
    expect(formatMoney(9.99)).toContain('9,99')
  })

  it('ajoute la devise pour une devise non EUR', () => {
    expect(formatMoney(100, 'USD')).toBe('100 USD')
    expect(formatMoney(250, 'CHF')).toBe('250 CHF')
  })

  it('arrondit à deux décimales', () => {
    expect(formatMoney(12.345)).toContain('12,35')
  })
})

describe('formatSize', () => {
  it('affiche les octets', () => {
    expect(formatSize(512)).toBe('512 o')
  })

  it('affiche les Ko', () => {
    expect(formatSize(2048)).toBe('2.0 Ko')
  })

  it('affiche les Mo', () => {
    expect(formatSize(3 * 1024 * 1024)).toBe('3.0 Mo')
  })
})

describe('initials', () => {
  it('combine les initiales', () => {
    expect(initials('Jean', 'Dupont')).toBe('JD')
  })

  it('gère un nom manquant', () => {
    expect(initials('Jean')).toBe('J')
    expect(initials(undefined, 'Dupont')).toBe('D')
  })

  it('retourne ? sans aucune valeur', () => {
    expect(initials()).toBe('?')
  })
})

describe('libellés', () => {
  it('contient tous les rôles', () => {
    expect(Object.keys(ROLE_LABELS)).toEqual(['ADMIN', 'RESPONSIBLE_SOC', 'MANAGER', 'CONSULTANT'])
  })

  it('couvre tous les statuts de CRA et notes de frais', () => {
    expect(DAY_TYPE_LABELS.WORKED).toBe('Travail')
    expect(NOTE_FRAIS_STATUS_LABELS.DRAFT).toBe('Brouillon')
    expect(SUBSCRIPTION_STATUS_LABELS.TRIAL).toBe('Essai')
    expect(TICKET_STATUS_LABELS.IN_PROGRESS).toBe('En cours')
    expect(TICKET_PRIORITY_LABELS.URGENT).toBe('Urgente')
  })
})

describe('badgeClasses', () => {
  it('mappe les variantes connues', () => {
    expect(badgeClasses('success')).toBe('bg-green-100 text-green-800')
    expect(badgeClasses('warning')).toBe('bg-amber-100 text-amber-800')
    expect(badgeClasses('error')).toBe('bg-red-100 text-red-800')
    expect(badgeClasses('info')).toBe('bg-sky-100 text-sky-800')
    expect(badgeClasses('muted')).toBe('bg-gray-100 text-gray-700')
  })

  it('retombe sur muted pour une variante inconnue', () => {
    expect(badgeClasses('whatever')).toBe('bg-gray-100 text-gray-700')
  })
})

describe('statusBadge', () => {
  it('mappe les statuts réussis', () => {
    expect(statusBadge('VALIDATED')).toBe('success')
    expect(statusBadge('PAID')).toBe('success')
    expect(statusBadge('ACTIVE')).toBe('success')
    expect(statusBadge('RESOLVED')).toBe('success')
  })

  it('mappe les statuts en cours', () => {
    expect(statusBadge('SUBMITTED')).toBe('info')
    expect(statusBadge('IN_PROGRESS')).toBe('info')
    expect(statusBadge('TRIAL')).toBe('info')
  })

  it('mappe les statuts en erreur', () => {
    expect(statusBadge('REJECTED')).toBe('error')
    expect(statusBadge('SUSPENDED')).toBe('error')
    expect(statusBadge('EXPIRED')).toBe('error')
    expect(statusBadge('ERROR')).toBe('error')
  })

  it('mappe les statuts neutres et les cas inconnus', () => {
    expect(statusBadge('DRAFT')).toBe('muted')
    expect(statusBadge('OPEN')).toBe('muted')
    expect(statusBadge('INCONNU')).toBe('muted')
  })
})

describe('formatage localisé', () => {
  afterEach(() => setFormatLocale('fr-FR'))

  it('formate les dates et les mois en anglais', () => {
    setFormatLocale('en-US')
    expect(monthLabel(1)).toBe('January')
    expect(monthShort(12)).toBe('Dec')
    expect(formatDate('2025-06-15')).toBe('6/15/2025')
  })

  it('formate la devise et les tailles en anglais', () => {
    setFormatLocale('en-US')
    expect(formatMoney(1234.5)).toContain('€')
    expect(formatMoney(1234.5)).toContain('1,234.50')
    expect(formatSize(2048)).toBe('2.0 KB')
  })

  it('revient au français après réinitialisation', () => {
    setFormatLocale('fr-FR')
    expect(monthLabel(6)).toBe('Juin')
    expect(formatSize(2048)).toBe('2.0 Ko')
  })
})
