import { beforeEach, describe, expect, it, vi } from 'vitest'

const { api } = vi.hoisted(() => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    upload: vi.fn(),
    download: vi.fn(),
    postText: vi.fn(),
  },
}))

vi.mock('./client', () => ({ api }))

import { activitiesApi, activityTypesApi } from './activities'
import { clientsApi } from './clients'
import { consultantsApi } from './consultants'
import { crasApi } from './cras'
import { dashboardApi } from './dashboard'
import { documentsApi } from './documents'
import { emailTemplatesApi } from './emailTemplates'
import { fichePaieApi } from './fichePaie'
import { holidaysApi } from './holidays'
import { logsApi } from './logs'
import { messagesApi } from './messages'
import { noteFraisApi } from './noteFrais'
import { notificationsApi } from './notifications'
import { projectsApi } from './projects'
import { socHolidaysApi } from './socHolidays'
import { socsApi } from './socs'
import { suppliersApi } from './suppliers'
import { supportApi } from './support'
import { tablesApi } from './tables'
import { unavailabilityApi } from './unavailability'
import { unavailabilityTypesApi } from './unavailabilityTypes'
import { usersApi } from './users'
import type { ConsultantRequest, ProjectRequest, SupplierRequest, UnavailabilityRequest } from './types'

describe('services API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('activitiesApi couvre CRUD', () => {
    activitiesApi.findAll({ socId: 1 })
    activitiesApi.getById(2)
    activitiesApi.create({} as never)
    activitiesApi.update(2, {} as never)
    activitiesApi.delete(2)

    expect(api.get).toHaveBeenNthCalledWith(1, '/activities', { socId: 1 })
    expect(api.get).toHaveBeenNthCalledWith(2, '/activities/2')
    expect(api.post).toHaveBeenCalledWith('/activities', {})
    expect(api.put).toHaveBeenCalledWith('/activities/2', {})
    expect(api.delete).toHaveBeenCalledWith('/activities/2')
  })

  it('activityTypesApi couvre CRUD', () => {
    activityTypesApi.findAll(1, { all: true })
    activityTypesApi.create({} as never)
    activityTypesApi.update(3, {} as never)
    activityTypesApi.delete(3)

    expect(api.get).toHaveBeenCalledWith('/activity-types', { socId: 1, all: true })
    expect(api.post).toHaveBeenCalledWith('/activity-types', {})
    expect(api.put).toHaveBeenCalledWith('/activity-types/3', {})
    expect(api.delete).toHaveBeenCalledWith('/activity-types/3')
  })

  it('clientsApi couvre CRUD', () => {
    clientsApi.findAll(1)
    clientsApi.create({ name: 'Client' } as never)
    clientsApi.update(1, { name: 'Client' } as never)
    clientsApi.delete(1)

    expect(api.get).toHaveBeenCalledWith('/clients', { socId: 1 })
    expect(api.post).toHaveBeenCalledWith('/clients', { name: 'Client' })
    expect(api.put).toHaveBeenCalledWith('/clients/1', { name: 'Client' })
    expect(api.delete).toHaveBeenCalledWith('/clients/1')
  })

  it('consultantsApi couvre les endpoints principaux', () => {
    consultantsApi.findAll({ socId: 1, page: 0, size: 20 })
    consultantsApi.summaries(1)
    consultantsApi.managed()
    consultantsApi.getById(2)
    consultantsApi.create({} as ConsultantRequest)
    consultantsApi.update(2, {} as ConsultantRequest)
    consultantsApi.delete(2)
    consultantsApi.history(2)
    consultantsApi.updatePerson(3, { firstName: 'A', lastName: 'B', email: null, phone: null })
    consultantsApi.deletePerson(3)

    expect(api.get).toHaveBeenNthCalledWith(1, '/consultants', { socId: 1, page: 0, size: 20 })
    expect(api.get).toHaveBeenNthCalledWith(2, '/consultants/summaries', { socId: 1 })
    expect(api.get).toHaveBeenNthCalledWith(3, '/consultants/managed')
    expect(api.get).toHaveBeenNthCalledWith(4, '/consultants/2')
    expect(api.post).toHaveBeenCalledWith('/consultants', {})
    expect(api.put).toHaveBeenNthCalledWith(1, '/consultants/2', {})
    expect(api.delete).toHaveBeenNthCalledWith(1, '/consultants/2')
    expect(api.get).toHaveBeenNthCalledWith(5, '/consultants/2/history')
    expect(api.put).toHaveBeenNthCalledWith(2, '/consultants/persons/3', {
      firstName: 'A',
      lastName: 'B',
      email: null,
      phone: null,
    })
    expect(api.delete).toHaveBeenNthCalledWith(2, '/consultants/persons/3')
  })

  it('consultantsApi.importCsv envoie un FormData', () => {
    consultantsApi.importCsv(new File(['x'], 'c.csv'), 1)

    expect(api.upload).toHaveBeenCalledTimes(1)
    const [path, formData] = api.upload.mock.calls[0]
    expect(path).toBe('/batch/consultant/import')
    expect(formData).toBeInstanceOf(FormData)
    expect((formData as FormData).get('socId')).toBe('1')
  })

  it('crasApi couvre consultation, workflow et exports', () => {
    crasApi.getOrCreate(1, 2025, 6)
    crasApi.getById(2)
    crasApi.exchanges(2)
    crasApi.history(2)
    crasApi.save(2, {} as never)
    crasApi.submit(2)
    crasApi.validate(2)
    crasApi.reject(2, 'non')
    crasApi.exportCsv({ month: 6, year: 2025, socId: 1 })
    crasApi.exportPdf({ month: 6, year: 2025 })

    expect(api.get).toHaveBeenNthCalledWith(1, '/cras/consultant/1/2025/6', { type: 'CRA' })
    expect(api.get).toHaveBeenNthCalledWith(2, '/cras/2')
    expect(api.get).toHaveBeenNthCalledWith(3, '/cras/2/exchanges')
    expect(api.get).toHaveBeenNthCalledWith(4, '/cras/2/history')
    expect(api.put).toHaveBeenCalledWith('/cras/2/days', {})
    expect(api.post).toHaveBeenNthCalledWith(1, '/cras/2/submit')
    expect(api.post).toHaveBeenNthCalledWith(2, '/cras/2/validate')
    expect(api.post).toHaveBeenNthCalledWith(3, '/cras/2/reject', { comment: 'non' })
    expect(api.download).toHaveBeenNthCalledWith(1, '/cras/export/csv?month=6&year=2025&socId=1', 'cra-6-2025.csv')
    expect(api.download).toHaveBeenNthCalledWith(2, '/cras/export/pdf?month=6&year=2025', 'cra-6-2025.pdf')
  })

  it('dashboardApi interroge le tableau de bord', () => {
    dashboardApi.overview()
    expect(api.get).toHaveBeenCalledWith('/dashboard/overview')
  })

  it('documentsApi couvre liste, partage, upload et téléchargement', () => {
    documentsApi.findAll({ consultantId: 1 })
    documentsApi.shareTargets()
    documentsApi.share(2, [3, 4])
    documentsApi.download(2, 'doc.pdf')
    documentsApi.delete(2)
    documentsApi.upload(new File(['x'], 'doc.pdf'), { category: 'CONTRAT', sharedWith: [3] })

    expect(api.get).toHaveBeenNthCalledWith(1, '/documents', { consultantId: 1 })
    expect(api.get).toHaveBeenNthCalledWith(2, '/documents/share-targets')
    expect(api.post).toHaveBeenCalledWith('/documents/2/share', [3, 4])
    expect(api.download).toHaveBeenCalledWith('/documents/2/download', 'doc.pdf')
    expect(api.delete).toHaveBeenCalledWith('/documents/2')
    expect(api.upload).toHaveBeenCalledWith('/documents/upload', expect.any(FormData))
  })

  it('emailTemplatesApi couvre liste, sauvegarde et réinitialisation', () => {
    emailTemplatesApi.list()
    emailTemplatesApi.save('welcome', { subject: 'S', body: 'B' })
    emailTemplatesApi.reset('welcome')

    expect(api.get).toHaveBeenCalledWith('/email-templates')
    expect(api.put).toHaveBeenCalledWith('/email-templates/welcome', { subject: 'S', body: 'B' })
    expect(api.delete).toHaveBeenCalledWith('/email-templates/welcome')
  })

  it('fichePaieApi couvre les opérations', () => {
    fichePaieApi.findByConsultant(1)
    fichePaieApi.findBySoc(2)
    fichePaieApi.create({ consultantId: 1, period: '2025-06', grossSalary: 1, netSalary: 1 })
    fichePaieApi.delete(3)
    fichePaieApi.download(3, '2025-06')
    fichePaieApi.pdf(3, '2025-06')
    fichePaieApi.uploadFile(3, new File(['x'], 'p.pdf'))

    expect(api.get).toHaveBeenNthCalledWith(1, '/fiche-paie/consultant/1')
    expect(api.get).toHaveBeenNthCalledWith(2, '/fiche-paie/soc/2')
    expect(api.post).toHaveBeenCalledWith('/fiche-paie', {
      consultantId: 1,
      period: '2025-06',
      grossSalary: 1,
      netSalary: 1,
    })
    expect(api.delete).toHaveBeenCalledWith('/fiche-paie/3')
    expect(api.download).toHaveBeenNthCalledWith(1, '/fiche-paie/3/download', 'fiche-paie-2025-06.pdf')
    expect(api.download).toHaveBeenNthCalledWith(2, '/fiche-paie/3/pdf', 'fiche-paie-2025-06.pdf')
    expect(api.upload).toHaveBeenCalledWith('/fiche-paie/3/upload', expect.any(FormData))
  })

  it('holidaysApi interroge les jours fériés', () => {
    holidaysApi.findByCountryYear('FR', 2025)
    holidaysApi.countries()

    expect(api.get).toHaveBeenNthCalledWith(1, '/holidays/FR/2025')
    expect(api.get).toHaveBeenNthCalledWith(2, '/holidays/countries')
  })

  it('logsApi lit les dernières lignes', () => {
    logsApi.tail(100)
    expect(api.get).toHaveBeenCalledWith('/logs', { lines: 100 })
  })

  it('messagesApi couvre boîte, envoi et suppression', () => {
    messagesApi.inbox(0, 10)
    messagesApi.sent()
    messagesApi.unreadCount()
    messagesApi.send(2, 'Sujet', 'Corps')
    messagesApi.markRead(3)
    messagesApi.delete(3)

    expect(api.get).toHaveBeenNthCalledWith(1, '/messages/inbox', { page: 0, size: 10 })
    expect(api.get).toHaveBeenNthCalledWith(2, '/messages/sent', { page: 0, size: 20 })
    expect(api.get).toHaveBeenNthCalledWith(3, '/messages/unread-count')
    expect(api.post).toHaveBeenCalledWith('/messages', { recipientId: 2, subject: 'Sujet', body: 'Corps' })
    expect(api.put).toHaveBeenCalledWith('/messages/3/read')
    expect(api.delete).toHaveBeenCalledWith('/messages/3')
  })

  it('noteFraisApi couvre CRUD, workflow et statistiques', () => {
    noteFraisApi.findBySocYear(1, 2025)
    noteFraisApi.findByConsultantYear(2, 2025)
    noteFraisApi.getById(3)
    noteFraisApi.create({} as never)
    noteFraisApi.update(3, {} as never)
    noteFraisApi.submit(3)
    noteFraisApi.validate(3)
    noteFraisApi.reject(3, 'non')
    noteFraisApi.delete(3)
    noteFraisApi.totalsByMonth(1, 2025)
    noteFraisApi.totalsByCategory(1, 2025)
    noteFraisApi.totalsByConsultant(1, 2025)

    expect(api.get).toHaveBeenNthCalledWith(1, '/note-frais/soc/1/2025')
    expect(api.get).toHaveBeenNthCalledWith(2, '/note-frais/consultant/2/2025')
    expect(api.get).toHaveBeenNthCalledWith(3, '/note-frais/3')
    expect(api.post).toHaveBeenNthCalledWith(1, '/note-frais', {})
    expect(api.put).toHaveBeenCalledWith('/note-frais/3', {})
    expect(api.post).toHaveBeenNthCalledWith(2, '/note-frais/3/submit')
    expect(api.post).toHaveBeenNthCalledWith(3, '/note-frais/3/validate')
    expect(api.post).toHaveBeenNthCalledWith(4, '/note-frais/3/reject', { comment: 'non' })
    expect(api.delete).toHaveBeenCalledWith('/note-frais/3')
    expect(api.get).toHaveBeenNthCalledWith(4, '/note-frais/stats/by-month/1/2025')
    expect(api.get).toHaveBeenNthCalledWith(5, '/note-frais/stats/by-category/1/2025')
    expect(api.get).toHaveBeenNthCalledWith(6, '/note-frais/stats/by-consultant/1/2025')
  })

  it('notificationsApi couvre lecture et suppression', () => {
    notificationsApi.myNotifications(0, 10)
    notificationsApi.unreadCount()
    notificationsApi.markRead(1)
    notificationsApi.markAllRead()
    notificationsApi.delete(1)
    notificationsApi.deleteAll()

    expect(api.get).toHaveBeenNthCalledWith(1, '/notifications', { page: 0, size: 10 })
    expect(api.get).toHaveBeenNthCalledWith(2, '/notifications/unread-count')
    expect(api.put).toHaveBeenNthCalledWith(1, '/notifications/1/read')
    expect(api.put).toHaveBeenNthCalledWith(2, '/notifications/read-all')
    expect(api.delete).toHaveBeenNthCalledWith(1, '/notifications/1')
    expect(api.delete).toHaveBeenNthCalledWith(2, '/notifications/all')
  })

  it('projectsApi couvre CRUD', () => {
    projectsApi.findAll({ socId: 1 })
    projectsApi.getById(2)
    projectsApi.create({} as ProjectRequest)
    projectsApi.update(2, {} as ProjectRequest)
    projectsApi.delete(2)

    expect(api.get).toHaveBeenNthCalledWith(1, '/projects', { socId: 1 })
    expect(api.get).toHaveBeenNthCalledWith(2, '/projects/2')
    expect(api.post).toHaveBeenCalledWith('/projects', {})
    expect(api.put).toHaveBeenCalledWith('/projects/2', {})
    expect(api.delete).toHaveBeenCalledWith('/projects/2')
  })

  it('socHolidaysApi couvre CRUD et duplication', () => {
    socHolidaysApi.list(2025)
    socHolidaysApi.create('2025-05-01', 'Fête du travail', 'CHOME_PAYE')
    socHolidaysApi.delete(1)
    socHolidaysApi.duplicate(2025)

    expect(api.get).toHaveBeenCalledWith('/soc-holidays/2025')
    expect(api.post).toHaveBeenNthCalledWith(1, '/soc-holidays', { date: '2025-05-01', label: 'Fête du travail', isChomePaye: 'CHOME_PAYE' })
    expect(api.delete).toHaveBeenCalledWith('/soc-holidays/1')
    expect(api.post).toHaveBeenNthCalledWith(2, '/soc-holidays/2025/duplicate')
  })

  it('socsApi couvre CRUD, démo et dépendances', () => {
    socsApi.findAll()
    socsApi.getById(1)
    socsApi.create({ name: 'Acme' })
    socsApi.createDemo()
    socsApi.update(1, { name: 'Acme 2' })
    socsApi.remove(1)
    socsApi.removeWithDependencies(1)
    socsApi.dependencies(1)
    socsApi.removeDependency(1, 'project', 2)
    socsApi.updateCraColors(1, { leaveDayColor: '#fef9c3', weekendColor: '#fefce8' })

    expect(api.get).toHaveBeenNthCalledWith(1, '/socs')
    expect(api.get).toHaveBeenNthCalledWith(2, '/socs/1')
    expect(api.post).toHaveBeenNthCalledWith(1, '/socs', { name: 'Acme' })
    expect(api.post).toHaveBeenNthCalledWith(2, '/socs/demo')
    expect(api.put).toHaveBeenCalledWith('/socs/1', { name: 'Acme 2' })
    expect(api.delete).toHaveBeenNthCalledWith(1, '/socs/1')
    expect(api.delete).toHaveBeenNthCalledWith(2, '/socs/1/all')
    expect(api.get).toHaveBeenNthCalledWith(3, '/socs/1/dependencies')
    expect(api.delete).toHaveBeenNthCalledWith(3, '/socs/1/dependencies/project/2')
    expect(api.put).toHaveBeenNthCalledWith(2, '/socs/1/cra-colors', {
      leaveDayColor: '#fef9c3',
      weekendColor: '#fefce8',
    })
  })

  it('suppliersApi couvre CRUD', () => {
    suppliersApi.findAll(1)
    suppliersApi.create({} as SupplierRequest)
    suppliersApi.update(2, {} as SupplierRequest)
    suppliersApi.delete(2)

    expect(api.get).toHaveBeenCalledWith('/suppliers', { socId: 1 })
    expect(api.post).toHaveBeenCalledWith('/suppliers', {})
    expect(api.put).toHaveBeenCalledWith('/suppliers/2', {})
    expect(api.delete).toHaveBeenCalledWith('/suppliers/2')
  })

  it('supportApi couvre tickets et échanges', () => {
    supportApi.findAll({ page: 0, size: 20, mine: true })
    supportApi.getById(1)
    supportApi.exchanges(1)
    supportApi.create({ title: 'T', description: 'D', priority: 'MEDIUM' })
    supportApi.addExchange(1, 'Corps')
    supportApi.updateStatus(1, 'CLOSED', 2)

    expect(api.get).toHaveBeenNthCalledWith(1, '/support', { page: 0, size: 20, mine: true })
    expect(api.get).toHaveBeenNthCalledWith(2, '/support/1')
    expect(api.get).toHaveBeenNthCalledWith(3, '/support/1/exchanges')
    expect(api.post).toHaveBeenNthCalledWith(1, '/support', {
      title: 'T',
      description: 'D',
      priority: 'MEDIUM',
    })
    expect(api.post).toHaveBeenNthCalledWith(2, '/support/1/exchanges', { body: 'Corps' })
    expect(api.put).toHaveBeenCalledWith('/support/1/status', { status: 'CLOSED', assignedToId: 2 })
  })

  it('tablesApi couvre exploration et SQL', () => {
    tablesApi.list()
    tablesApi.getLines('company')
    tablesApi.getColumns('company')
    tablesApi.executeSql('SELECT 1')
    tablesApi.getRelations()

    expect(api.get).toHaveBeenNthCalledWith(1, '/tables')
    expect(api.get).toHaveBeenNthCalledWith(2, '/tables/company')
    expect(api.get).toHaveBeenNthCalledWith(3, '/tables/company/columns')
    expect(api.postText).toHaveBeenCalledWith('/tables/execute', 'SELECT 1')
    expect(api.get).toHaveBeenNthCalledWith(4, '/tables/relations')
  })

  it('unavailabilityApi couvre CRUD et workflow', () => {
    unavailabilityApi.list({ socId: 1 })
    unavailabilityApi.create({} as UnavailabilityRequest)
    unavailabilityApi.update(2, {} as UnavailabilityRequest)
    unavailabilityApi.submit(2)
    unavailabilityApi.cancel(2)
    unavailabilityApi.validate(2, 'ok')
    unavailabilityApi.reject(2, 'non')
    unavailabilityApi.invalidate(2, 'non')
    unavailabilityApi.history(2)
    unavailabilityApi.delete(2)

    expect(api.get).toHaveBeenNthCalledWith(1, '/unavailabilities', { socId: 1 })
    expect(api.post).toHaveBeenNthCalledWith(1, '/unavailabilities', {})
    expect(api.put).toHaveBeenCalledWith('/unavailabilities/2', {})
    expect(api.post).toHaveBeenNthCalledWith(2, '/unavailabilities/2/submit')
    expect(api.post).toHaveBeenNthCalledWith(3, '/unavailabilities/2/cancel')
    expect(api.post).toHaveBeenNthCalledWith(4, '/unavailabilities/2/validate', { comment: 'ok' })
    expect(api.post).toHaveBeenNthCalledWith(5, '/unavailabilities/2/reject', { comment: 'non' })
    expect(api.post).toHaveBeenNthCalledWith(6, '/unavailabilities/2/invalidate', { comment: 'non' })
    expect(api.get).toHaveBeenNthCalledWith(2, '/unavailabilities/2/history')
    expect(api.delete).toHaveBeenCalledWith('/unavailabilities/2')
  })

  it('unavailabilityTypesApi couvre liste, création, modification et désactivation', () => {
    const request = {
      socId: 1,
      name: 'Télétravail',
      durationValue: 2.5,
      durationUnit: 'DAYS' as const,
      countType: 'OUVRE' as const,
      remuneration: null,
      paidLeaveAccrual: true,
      providedByLaw: true,
      providedByCollectiveAgreement: true,
      documentRequired: false,
      mainCondition: null,
    }
    unavailabilityTypesApi.list(1)
    unavailabilityTypesApi.list(null)
    unavailabilityTypesApi.active(1)
    unavailabilityTypesApi.create(request)
    unavailabilityTypesApi.update(2, request)
    unavailabilityTypesApi.disable(2)
    unavailabilityTypesApi.remove(2)

    expect(api.get).toHaveBeenNthCalledWith(1, '/unavailability-types', { socId: 1 })
    expect(api.get).toHaveBeenNthCalledWith(2, '/unavailability-types', { socId: undefined })
    expect(api.get).toHaveBeenNthCalledWith(3, '/unavailability-types/active', { socId: 1 })
    expect(api.post).toHaveBeenNthCalledWith(1, '/unavailability-types', request)
    expect(api.put).toHaveBeenCalledWith('/unavailability-types/2', request)
    expect(api.post).toHaveBeenNthCalledWith(2, '/unavailability-types/2/disable')
    expect(api.delete).toHaveBeenCalledWith('/unavailability-types/2')
  })

  it('usersApi couvre CRUD', () => {
    usersApi.findAll({ page: 0, size: 20 })
    usersApi.getById(1)
    usersApi.create({
      username: 'jdoe',
      email: 'jdoe@soc.fr',
      firstName: 'Jean',
      lastName: 'Dupont',
      phone: null,
      role: 'CONSULTANT',
      socId: 1,
      password: 'secret',
    })
    usersApi.update(1, {
      email: 'jdoe@soc.fr',
      firstName: 'Jean',
      lastName: 'Dupont',
      phone: null,
      role: 'CONSULTANT',
      socId: 1,
      active: true,
    })
    usersApi.delete(1)

    expect(api.get).toHaveBeenNthCalledWith(1, '/users', { page: 0, size: 20 })
    expect(api.get).toHaveBeenNthCalledWith(2, '/users/1')
    expect(api.post).toHaveBeenCalledWith('/users', expect.objectContaining({ username: 'jdoe' }))
    expect(api.put).toHaveBeenCalledWith('/users/1', expect.objectContaining({ active: true }))
    expect(api.delete).toHaveBeenCalledWith('/users/1')
  })
})
