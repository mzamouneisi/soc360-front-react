import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { LeaveBalances } from './LeaveBalances'
import type { LeaveBalanceResponse, LeaveLotDto, LeaveType } from '../api/types'

const { balanceMock, collaboratorsMock, movementsMock, userMock } = vi.hoisted(() => ({
  balanceMock: vi.fn(),
  collaboratorsMock: vi.fn(),
  movementsMock: vi.fn().mockResolvedValue([]),
  userMock: { value: null as unknown },
}))

const responsibleUser = { id: 1, role: 'RESPONSIBLE_SOC', socId: 5, pageSize: 3, employee: true }

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: userMock.value }),
}))

vi.mock('../soc/SocContext', () => ({
  useSoc: () => ({ selectedSocId: 5 }),
}))

vi.mock('../api/consultants', () => ({
  consultantsApi: { collaborators: collaboratorsMock },
}))

vi.mock('../api/leave', () => ({
  leaveApi: { balance: balanceMock, movements: movementsMock },
}))

function lots(type: LeaveType, count: number): LeaveLotDto[] {
  return Array.from({ length: count }, (_, index) => ({
    id: (type === 'CP' ? 100 : 200) + index,
    leaveType: type,
    periodKey: `${type}-${index + 1}`,
    quantity: 2,
    remaining: 1,
    creditDate: '2026-01-01',
    acquisitionStart: null,
    acquisitionEnd: null,
    usageStart: null,
    usageEnd: null,
    expirationDate: null,
  }))
}

const consultantUser = {
  id: 2,
  role: 'CONSULTANT',
  socId: null,
  consultantId: 10,
  pageSize: 3,
  employee: true,
}

afterEach(() => {
  vi.clearAllMocks()
  movementsMock.mockResolvedValue([])
  userMock.value = responsibleUser
})

describe('LeaveBalances', () => {
  it('pagine les lots CP et RTT avec des ids distincts', async () => {
    userMock.value = responsibleUser
    collaboratorsMock.mockResolvedValue([{ id: 2, fullName: 'Jean Dupont' }])
    const response: LeaveBalanceResponse = {
      consultantId: 2,
      consultantName: 'Jean Dupont',
      referenceDate: '2026-11-05',
      balances: [
        { leaveType: 'CP', balance: 10, accrued: 20, consumed: 8, expired: 0, adjustments: 0, lots: lots('CP', 7) },
        { leaveType: 'RTT', balance: 4, accrued: 8, consumed: 4, expired: 0, adjustments: 0, lots: lots('RTT', 7) },
      ],
    }
    balanceMock.mockResolvedValue(response)

    render(<LeaveBalances />)

    expect(await screen.findByText('Lots de droits CP')).toBeInTheDocument()
    expect(screen.getByText('CP-1')).toBeInTheDocument()
    expect(screen.queryByText('CP-4')).not.toBeInTheDocument()
    expect(document.getElementById('LeaveBalances.CP.lots.page')).toHaveTextContent('Page 1 / 3')
    expect(document.getElementById('LeaveBalances.RTT.lots.page')).toHaveTextContent('Page 1 / 3')

    fireEvent.click(document.getElementById('LeaveBalances.CP.lots.next') as HTMLElement)
    expect(screen.getByText('CP-4')).toBeInTheDocument()
    expect(screen.queryByText('CP-1')).not.toBeInTheDocument()

    fireEvent.click(document.getElementById('LeaveBalances.RTT.lots.next') as HTMLElement)
    expect(screen.getByText('RTT-4')).toBeInTheDocument()
    expect(document.getElementById('LeaveBalances.CP.lots.page')).toHaveTextContent('Page 2 / 3')
    expect(document.getElementById('LeaveBalances.RTT.lots.page')).toHaveTextContent('Page 2 / 3')
  })

  it('affiche le journal d’audit des mouvements avec leur auteur', async () => {
    userMock.value = consultantUser
    balanceMock.mockResolvedValue({
      consultantId: 10,
      consultantName: 'Alice Martin',
      referenceDate: '2026-11-05',
      balances: [
        { leaveType: 'CP', balance: 9, accrued: 10, consumed: 1, expired: 0, adjustments: 0, lots: [] },
      ],
      employee: true,
    })
    movementsMock.mockResolvedValue([
      {
        id: 7,
        leaveType: 'CP',
        movementType: 'CONSUMPTION',
        quantity: -1,
        balanceBefore: 10,
        balanceAfter: 9,
        movementDate: '2026-11-01T23:59:59.999Z',
        lotId: 1,
        expirationDate: null,
        origin: 'ABSENCE_VALIDATION',
        actorId: 10,
        actorName: 'Alice Martin',
        reason: 'Absence validée',
        unavailabilityId: 12,
        operationKey: 'absence-12-consume',
        parentMovementId: null,
        configId: null,
        configEffectiveDate: null,
      },
    ])

    render(<LeaveBalances />)

    expect(await screen.findByText('Journal des mouvements CP')).toBeInTheDocument()
    expect(document.getElementById('LeaveBalances.CP.movement.7.nature')).toHaveTextContent(
      'Consommation',
    )
    expect(document.getElementById('LeaveBalances.CP.movement.7.actor')).toHaveTextContent(
      'Alice Martin',
    )
    expect(document.getElementById('LeaveBalances.CP.movement.7.reason')).toHaveTextContent(
      'Absence validée',
    )
  })

  it('masque les soldes et les droits d’un consultant non salarié', async () => {
    userMock.value = { ...consultantUser, employee: false }
    balanceMock.mockResolvedValue({
      consultantId: 10,
      consultantName: 'Alice Martin',
      referenceDate: '2026-11-05',
      balances: [],
      employee: false,
    })

    render(<LeaveBalances />)

    expect(
      await screen.findByText('Pas de soldes de congés pour les non salariés.'),
    ).toBeInTheDocument()
    expect(document.getElementById('LeaveBalances.non.salarie')).not.toBeNull()
    expect(document.getElementById('LeaveBalances.CP.balance')).toBeNull()
    expect(balanceMock).toHaveBeenCalledWith(10, expect.any(String))
  })

  it('un manager non salarié voit le message mais garde l’accès aux soldes de ses salariés', async () => {
    userMock.value = { ...responsibleUser, role: 'MANAGER', employee: false }
    collaboratorsMock.mockResolvedValue([{ id: 2, fullName: 'Jean Dupont' }])
    balanceMock.mockImplementation((id: number) =>
      Promise.resolve(
        id === 1
          ? {
              consultantId: 1,
              consultantName: 'Moi Même',
              referenceDate: '2026-11-05',
              balances: [],
              employee: false,
            }
          : {
              consultantId: 2,
              consultantName: 'Jean Dupont',
              referenceDate: '2026-11-05',
              balances: [
                { leaveType: 'CP', balance: 8, accrued: 10, consumed: 2, expired: 0, adjustments: 0, lots: [] },
              ],
              employee: true,
            },
      ),
    )

    render(<LeaveBalances />)

    expect(
      await screen.findByText('Pas de soldes de congés pour les non salariés.'),
    ).toBeInTheDocument()
    expect(balanceMock).toHaveBeenCalledWith(1, expect.any(String))

    const select = document.getElementById('LeaveBalances.consultant') as HTMLSelectElement
    expect(select).not.toBeNull()
    await within(select).findByRole('option', { name: 'Jean Dupont' })
    fireEvent.change(select, { target: { value: '2' } })

    expect(await screen.findByText('Solde CP')).toBeInTheDocument()
    expect(document.getElementById('LeaveBalances.non.salarie')).toBeNull()
    expect(document.getElementById('LeaveBalances.CP.balance.value')).toHaveTextContent('8')
  })

  it('affiche le message quand le collaborateur sélectionné n’est pas salarié', async () => {
    userMock.value = responsibleUser
    collaboratorsMock.mockResolvedValue([{ id: 2, fullName: 'Jean Dupont' }])
    balanceMock.mockResolvedValue({
      consultantId: 2,
      consultantName: 'Jean Dupont',
      referenceDate: '2026-11-05',
      balances: [],
      employee: false,
    })

    render(<LeaveBalances />)

    expect(
      await screen.findByText('Pas de soldes de congés pour les non salariés.'),
    ).toBeInTheDocument()
    expect(document.getElementById('LeaveBalances.non.salarie')).not.toBeNull()
    expect(document.getElementById('LeaveBalances.CP.balance')).toBeNull()
  })

  it('affiche les soldes d’un consultant salarié', async () => {
    userMock.value = consultantUser
    balanceMock.mockResolvedValue({
      consultantId: 10,
      consultantName: 'Alice Martin',
      referenceDate: '2026-11-05',
      balances: [
        { leaveType: 'CP', balance: 10, accrued: 20, consumed: 10, expired: 0, adjustments: 0, lots: [] },
      ],
      employee: true,
    })

    render(<LeaveBalances />)

    expect(await screen.findByText('Solde CP')).toBeInTheDocument()
    expect(balanceMock).toHaveBeenCalledWith(10, expect.any(String))
    expect(document.getElementById('LeaveBalances.CP.balance.value')).toHaveTextContent('10')
  })
})
