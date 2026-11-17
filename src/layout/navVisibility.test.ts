import { describe, expect, it } from 'vitest'
import { isNavItemVisible } from './navVisibility'

const leaveBalances = { to: '/soldes-conges', employeeOnly: true }
const cra = { to: '/cras' }

describe('isNavItemVisible', () => {
  it('masque les soldes de congés à un consultant non salarié', () => {
    expect(isNavItemVisible(leaveBalances, 'CONSULTANT', 'alice', false)).toBe(false)
  })

  it('affiche les soldes de congés à un consultant salarié', () => {
    expect(isNavItemVisible(leaveBalances, 'CONSULTANT', 'alice', true)).toBe(true)
  })

  it('ne masque pas les autres rubriques à un consultant non salarié', () => {
    expect(isNavItemVisible(cra, 'CONSULTANT', 'alice', false)).toBe(true)
  })

  it('laisse les soldes accessibles aux managers et responsables', () => {
    expect(isNavItemVisible(leaveBalances, 'MANAGER', 'bob', false)).toBe(true)
    expect(isNavItemVisible(leaveBalances, 'RESPONSIBLE_SOC', 'bob', false)).toBe(true)
  })

  it('applique les restrictions de rôle et de rubriques du consultant', () => {
    expect(
      isNavItemVisible({ to: '/consultants', roles: ['MANAGER'] }, 'CONSULTANT', 'alice', true),
    ).toBe(false)
    expect(isNavItemVisible({ to: '/clients' }, 'CONSULTANT', 'alice', true)).toBe(false)
    expect(isNavItemVisible({ to: '/clients' }, 'MANAGER', 'bob', true)).toBe(true)
    expect(
      isNavItemVisible({ to: '/logs', usernames: ['admin'] }, 'ADMIN', 'bob', true),
    ).toBe(false)
  })
})
