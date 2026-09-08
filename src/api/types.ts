export type Role = 'ADMIN' | 'RESPONSIBLE_SOC' | 'MANAGER' | 'CONSULTANT'

export type CraStatus = 'DRAFT' | 'SUBMITTED' | 'PENDING_SEND' | 'VALIDATED' | 'REJECTED' | 'CANCELLED'

export type DayType =
  | 'WORKED'
  | 'WEEKEND'
  | 'PUBLIC_HOLIDAY'
  | 'LEAVE'
  | 'SICK_LEAVE'
  | 'OTHER'

export type NoteFraisStatus = 'DRAFT' | 'SUBMITTED' | 'VALIDATED' | 'REJECTED' | 'PAID'

export type PaymentMethod = 'CARD' | 'TRANSFER' | 'CHECK' | 'OTHER'

export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED'

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export type NotificationType = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'

export interface PageResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
  totalPages: number
}

export interface SocLiteDto {
  id: number
  name: string
}

export interface AddSocPayload {
  socName: string
  description?: string | null
  infosWeb?: string | null
  siret?: string | null
  codeNaf?: string | null
  urssaf?: string | null
  gerant?: string | null
  categorieEntreprise?: string | null
  dateCreation?: string | null
  dateFermeture?: string | null
  website?: string | null
  street?: string | null
  zipCode?: string | null
  city?: string | null
  country?: string | null
  mine?: boolean
}

export interface UserDto {
  id: number
  username: string
  email: string
  firstName: string
  lastName: string
  phone: string | null
  role: Role
  active: boolean
  socId: number | null
  socName: string | null
  consultantId: number | null
  mustChangePassword: boolean
  lastLoginAt: string | null
  fontSize: number
  theme: string
  tableHeaderColor: string
  tableBorderColor: string
  pageSize: number
}

export interface AuthResponse {
  token: string
  user: UserDto
}

export interface ResetResponse {
  message: string
  resetUrl: string
}

export interface EmailSentResponse {
  message: string
}

export interface ConnectionDto {
  id: number
  loginTime: string
  ipAddress: string
  userAgent: string
  success: boolean
  role: string | null
}

export interface Address {
  street?: string | null
  zipCode?: string | null
  city?: string | null
  country?: string | null
}

export interface SocDto {
  id: number
  name: string
  description?: string | null
  infosWeb?: string | null
  siret?: string | null
  codeNaf?: string | null
  urssaf?: string | null
  gerant?: string | null
  categorieEntreprise?: string | null
  dateCreation?: string | null
  dateFermeture?: string | null
  website?: string | null
  address?: Address | null
}

export interface SubscriptionDto {
  id: number
  plan: string
  status: SubscriptionStatus
  startDate: string
  trialEndDate?: string | null
  endDate?: string | null
  monthlyPrice: number
}

export interface PaymentDto {
  id: number
  amount: number
  paymentDate: string
  method: PaymentMethod
  reference?: string | null
}

export interface SocDetailDto {
  soc: SocDto
  subscriptions: SubscriptionDto[]
  payments: PaymentDto[]
}

export interface ConsultantDto {
  id: number
  username: string
  email: string
  firstName: string
  lastName: string
  phone: string | null
  role: string
  active: boolean
  socId: number | null
  socName: string | null
  managerId: number | null
  managerName: string | null
  position: string | null
  hireDate: string | null
  birthDate: string | null
  socialNumber: string | null
  baseSalary: number | null
  currency: string | null
  nationality: string | null
  emergencyContact: string | null
  mustChangePassword: boolean
  lastLoginAt: string | null
}

export interface ConsultantRequest {
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  position?: string | null
  hireDate?: string | null
  birthDate?: string | null
  socialNumber?: string | null
  baseSalary?: number | null
  currency?: string | null
  nationality?: string | null
  emergencyContact?: string | null
  socId: number
  managerId?: number | null
  username?: string | null
  password?: string | null
  role?: string
  active?: boolean | null
}

export interface ConsultantSummary {
  id: number
  fullName: string
  position: string
  email: string
}

export interface ManagerSummary {
  id: number
  fullName: string
  position: string
}

export interface HistoConsultantDto {
  id: number
  consultantId: number | null
  consultantName: string
  userId: number | null
  userName: string
  dateMaj: string | null
  action: string
  infosAvant: string | null
  infosApres: string | null
  diff: string | null
}
export interface ClientDto {
  id: number
  name: string
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  notes?: string | null
  soc?: { id: number; name: string } | null
  socParent?: { id: number; name: string } | null
  active: boolean
}

export interface ClientRequest {
  name: string
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  notes?: string | null
  socId?: number | null
  socParentId?: number | null
  active: boolean
}

export interface SupplierDto {
  id: number
  name: string
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  notes?: string | null
  soc?: { id: number; name: string } | null
  socParent?: { id: number; name: string } | null
  active: boolean
}

export interface SupplierRequest {
  name: string
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  notes?: string | null
  socId?: number | null
  socParentId?: number | null
  active: boolean
}

export interface ProjectDto {
  id: number
  name: string
  description: string | null
  client?: { id: number; name: string } | null
  soc?: { id: number; name: string } | null
  startDate: string | null
  endDate: string | null
  dailyRate: number | null
  currency: string | null
  active: boolean
}

export interface ProjectRequest {
  name: string
  description?: string | null
  clientId: number
  socId: number
  startDate?: string | null
  endDate?: string | null
  dailyRate?: number | null
  currency?: string | null
  active: boolean
}

export interface ActivityTypeDto {
  id: number
  code: string
  labelFr: string
  labelEn?: string | null
  labelAr?: string | null
  color?: string | null
  active: boolean
  socId: number
  socName: string | null
}

export interface ActivityTypeRequest {
  socId: number
  code: string
  labelFr: string
  labelEn?: string | null
  labelAr?: string | null
  color?: string | null
  active: boolean
}

export interface ActivityDto {
  id: number
  name: string
  description: string | null
  price: number
  currency: string
  startDate: string | null
  endDate: string | null
  type?: { id: number; code: string; labelFr: string; color?: string | null } | null
  project?: { id: number; name: string; clientName?: string | null } | null
  consultant?: { id: number; firstName: string; lastName: string } | null
  soc?: { id: number; name: string } | null
  active: boolean
  indispo: boolean
}

export interface ActivityRequest {
  name: string
  description?: string | null
  price: number
  currency?: string | null
  startDate?: string | null
  endDate?: string | null
  typeId: number
  projectId?: number | null
  consultantId?: number | null
  socId: number
  active: boolean
  indispo?: boolean
}

export interface CraDayActivityDto {
  id: number
  activityId: number
  activityName: string
  activityColor: string | null
  hours: number
  days: number
  valid: boolean
  comment: string | null
}

export interface CraDayDto {
  id: number
  date: string
  dayType: DayType
  workedHours: number
  hours: number
  comment: string | null
  activities: CraDayActivityDto[]
}

export interface CraDto {
  id: number
  consultantId: number
  consultantName: string | null
  managerId: number | null
  month: number
  year: number
  type: string
  status: CraStatus
  totalWorkedDays: number
  totalHours: number
  submittedAt: string | null
  validatedAt: string | null
  comment: string | null
  days: CraDayDto[]
}

export interface CraExchangeDto {
  id: number
  dateTime: string
  sender: string
  receiver: string
  comment: string | null
}

export interface CraDayActivityRequest {
  activityId: number
  hours?: number | null
  days?: number | null
  valid?: boolean | null
  comment?: string | null
}

export interface CraDayRequest {
  date: string
  dayType: DayType
  workedHours?: number | null
  hours?: number | null
  comment?: string | null
  activities?: CraDayActivityRequest[]
}

export interface SaveCraRequest {
  month: number
  year: number
  days: CraDayRequest[]
}

export interface NoteFraisLineDto {
  id: number
  date: string
  category: string
  label: string
  montantHT: number
  montantTTC: number
  enseigne: string | null
  adresse: string | null
  reimbursed: boolean
  comment: string | null
}

export interface NoteFraisDto {
  id: number
  consultantId: number
  consultantName: string
  socId: number
  month: number
  year: number
  status: NoteFraisStatus
  totalAmount: number
  submittedAt: string | null
  validatedAt: string | null
  paidAt: string | null
  comment: string | null
  infosFacture?: string | null
  lines: NoteFraisLineDto[]
}

export interface NoteFraisLineRequest {
  date: string
  category: string
  label: string
  montantHT: number
  montantTTC: number
  enseigne?: string | null
  adresse?: string | null
  reimbursed: boolean
  comment?: string | null
}

export interface CreateNoteFraisRequest {
  consultantId: number
  month: number
  year: number
  lines: NoteFraisLineRequest[]
  infosFacture?: string | null
}

export interface HrDocumentDto {
  id: number
  name: string
  category: string
  contentType: string
  size: number
  expiresAt: string | null
  description: string | null
  consultantId: number | null
  socId: number | null
  uploadedBy: string
  visibility: string
  createdAt: string
}

export interface FichePaieDto {
  id: number
  period: string
  grossSalary: number
  netSalary: number
  employerCost: number | null
  taxes: number | null
  issuedAt: string | null
  comment: string | null
  consultant?: { id: number; firstName: string; lastName: string } | null
}

export interface MessageDto {
  id: number
  subject: string
  body: string
  read: boolean
  deleted: boolean
  createdAt: string
  sender?: { id: number; firstName: string; lastName: string; username: string } | null
  recipient?: { id: number; firstName: string; lastName: string; username: string } | null
}

export interface NotificationDto {
  id: number
  title: string
  body: string | null
  type: NotificationType
  read: boolean
  link: string | null
  createdAt: string
}

export interface SupportTicketDto {
  id: number
  title: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  category: string | null
  createdAt: string
  creator?: { id: number; firstName: string; lastName: string; username: string } | null
  assignedTo?: { id: number; firstName: string; lastName: string; username: string } | null
}

export interface SupportExchangeDto {
  id: number
  body: string
  createdAt: string
  author?: { id: number; firstName: string; lastName: string; username: string } | null
}

export interface PublicHolidayDto {
  id: number
  country: string
  date: string
  label: string
}

export interface SocHolidayDto {
  id: number
  socId: number
  date: string
  label: string
}

export interface DashboardOverview {
  user: string
  role: Role
  socId: number | null
  unreadMessages: number
  unreadNotifications: number
  totalUsers?: number
  totalSocs?: number
  totalConsultants?: number
  activeSubscriptions?: number
  consultants?: number
  pendingNoteFrais?: number
  craYearSubmitted?: number
  craYearValidated?: number
  craYearRejected?: number
  craYearTotal?: number
  craStatus?: CraStatus
  craTotalHours?: number
  craTotalDays?: number
  noteFraisStatus?: NoteFraisStatus
  noteFraisTotal?: number
}
