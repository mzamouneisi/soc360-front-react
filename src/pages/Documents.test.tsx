import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Documents } from './Documents'
import type { HrDocumentDto, UserDto } from '../api/types'

const { findAllMock, shareTargetsMock, previewUrlMock, summariesMock, userMock } = vi.hoisted(
  () => ({
    findAllMock: vi.fn(),
    shareTargetsMock: vi.fn(),
    previewUrlMock: vi.fn(),
    summariesMock: vi.fn(),
    userMock: { value: null as unknown as UserDto },
  }),
)

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: userMock.value,
    initializing: false,
    login: vi.fn(),
    logout: vi.fn(),
    setUser: vi.fn(),
    refreshMe: vi.fn(),
  }),
}))

vi.mock('../api/documents', () => ({
  documentsApi: {
    findAll: findAllMock,
    shareTargets: shareTargetsMock,
    previewUrl: previewUrlMock,
    download: vi.fn(),
    delete: vi.fn(),
    upload: vi.fn(),
  },
}))

vi.mock('../api/consultants', () => ({
  consultantsApi: { summaries: summariesMock },
}))

const adminUser = {
  id: 1,
  username: 'admin',
  email: 'admin@soc.fr',
  firstName: 'Ad',
  lastName: 'Min',
  phone: null,
  role: 'ADMIN',
  active: true,
  socId: 5,
  socName: 'SOC Test',
  consultantId: null,
  mustChangePassword: false,
  lastLoginAt: null,
  pageSize: 5,
} as UserDto

const document = (overrides: Partial<HrDocumentDto> = {}): HrDocumentDto => ({
  id: 1,
  name: 'facture.pdf',
  category: 'JUSTIFICATIF',
  contentType: 'application/pdf',
  size: 1024,
  expiresAt: null,
  description: null,
  consultantId: null,
  socId: 5,
  uploadedBy: 'Admin',
  visibility: 'PRIVATE',
  createdAt: '2026-10-29T10:00:00Z',
  ...overrides,
})

afterEach(() => {
  vi.clearAllMocks()
  userMock.value = null as unknown as UserDto
})

describe('Documents', () => {
  it('prévisualise le document dans une fenêtre avec zoom au clic sur la ligne', async () => {
    userMock.value = adminUser
    findAllMock.mockResolvedValue([document()])
    shareTargetsMock.mockResolvedValue([])
    summariesMock.mockResolvedValue([])
    previewUrlMock.mockResolvedValue('blob:preview')

    render(
      <MemoryRouter>
        <Documents />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByText('facture.pdf'))

    await waitFor(() => expect(previewUrlMock).toHaveBeenCalledWith(1))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByTitle('Agrandir')).toBeInTheDocument()
  })
})
