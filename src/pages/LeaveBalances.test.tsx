import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { LeaveBalances } from './LeaveBalances'
import type { LeaveBalanceResponse, LeaveLotDto, LeaveType } from '../api/types'

const { balanceMock, collaboratorsMock, userMock } = vi.hoisted(() => ({
  balanceMock: vi.fn(),
  collaboratorsMock: vi.fn(),
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
  leaveApi: { balance: balanceMock },
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

  it('masque les soldes et les droits d’un consultant non salarié', async () => {
    userMock.value = { ...consultantUser, employee: false }

    render(<LeaveBalances />)

    expect(
      await screen.findByText(/ne concernent que les collaborateurs salariés/),
    ).toBeInTheDocument()
    expect(document.getElementById('LeaveBalances.non.salarie')).not.toBeNull()
    expect(document.getElementById('LeaveBalances.CP.balance')).toBeNull()
    expect(balanceMock).not.toHaveBeenCalled()
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
    })

    render(<LeaveBalances />)

    expect(await screen.findByText('Solde CP')).toBeInTheDocument()
    expect(balanceMock).toHaveBeenCalledWith(10, expect.any(String))
    expect(document.getElementById('LeaveBalances.CP.balance.value')).toHaveTextContent('10')
  })
})
