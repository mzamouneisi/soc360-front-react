import { api } from './client'
import type {
  AdjustmentRequest,
  LeaveBalanceDto,
  LeaveBalanceResponse,
  LeaveConfigDto,
  LeaveConfigRequest,
  LeaveEligibilityDto,
  LeaveEligibilityRequest,
  LeaveLotDto,
  LeaveMovementDto,
  LeaveType,
} from './types'

export const leaveApi = {
  configs: (socId?: number | null) => api.get<LeaveConfigDto[]>('/leave/configs', { socId }),
  saveConfig: (request: LeaveConfigRequest) => api.post<LeaveConfigDto>('/leave/configs', request),
  eligibilities: (socId: number | null | undefined, leaveType: LeaveType) =>
    api.get<LeaveEligibilityDto[]>('/leave/eligibilities', { socId, leaveType }),
  saveEligibility: (request: LeaveEligibilityRequest) =>
    api.post<LeaveEligibilityDto>('/leave/eligibilities', request),
  balance: (consultantId: number, date?: string) =>
    api.get<LeaveBalanceResponse>('/leave/balance', { consultantId, date }),
  lots: (consultantId: number, leaveType: LeaveType) =>
    api.get<LeaveLotDto[]>('/leave/lots', { consultantId, leaveType }),
  movements: (consultantId: number, leaveType?: LeaveType, from?: string, to?: string) =>
    api.get<LeaveMovementDto[]>('/leave/movements', { consultantId, leaveType, from, to }),
  adjust: (request: AdjustmentRequest) => api.post<LeaveBalanceDto>('/leave/adjust', request),
}
