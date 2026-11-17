import type { Role } from '../api/types'

export interface NavItemLike {
  to: string
  roles?: Role[]
  usernames?: string[]
  employeeOnly?: boolean
}

export const HIDDEN_FOR_CONSULTANT = new Set([
  '/clients',
  '/fournisseurs',
  '/projets',
  '/missions',
  '/consultants',
  '/activites',
  '/types-activites',
  '/facturation',
])

/**
 * Un consultant non salarié n'a ni solde de congés ni acquisition de droits (CP/RTT) : les
 * rubriques réservées aux salariés lui sont masquées. Les autres rôles restent inchangés.
 */
export function isNavItemVisible(
  item: NavItemLike,
  role: Role,
  username: string,
  employee: boolean,
): boolean {
  if (item.roles && !item.roles.includes(role)) return false
  if (item.usernames && !item.usernames.includes(username)) return false
  if (role === 'CONSULTANT' && HIDDEN_FOR_CONSULTANT.has(item.to)) return false
  if (role === 'CONSULTANT' && item.employeeOnly && !employee) return false
  return true
}
