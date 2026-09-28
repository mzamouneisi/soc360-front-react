import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Languages } from './Languages'
import type { AdminBundle } from '../api/i18n'
import type { UserDto } from '../api/types'

const { adminBundleMock, importAllMock, refreshMock, userMock } = vi.hoisted(() => ({
  adminBundleMock: vi.fn(),
  importAllMock: vi.fn(),
  refreshMock: vi.fn(),
  userMock: { value: null as unknown as UserDto },
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: userMock.value }),
}))

vi.mock('../i18n', async () => {
  const { tr } = await vi.importActual<typeof import('../i18n/translate')>('../i18n/translate')
  return { useI18n: () => ({ refresh: refreshMock, t: tr }) }
})

vi.mock('../api/i18n', () => ({
  i18nApi: {
    adminBundle: adminBundleMock,
    importAll: importAllMock,
    saveEntry: vi.fn(),
    createEntry: vi.fn(),
    removeEntry: vi.fn(),
    addLanguage: vi.fn(),
    removeLanguage: vi.fn(),
    autofillLanguage: vi.fn(),
    bundle: vi.fn(),
    exportAll: vi.fn(),
  },
}))

vi.mock('../lib/translate', () => ({ translateTexts: vi.fn() }))

const bundle: AdminBundle = {
  languages: ['fr', 'en'],
  entries: [
    { id: 1, key: 'common.save', translations: { fr: 'Enregistrer', en: 'Save' } },
    { id: 2, key: 'common.cancel', translations: { fr: 'Annuler', en: 'Cancel' } },
  ],
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  userMock.value = null as unknown as UserDto
})

describe('Languages', () => {
  it('exporte les traductions en CSV (clé, langue de référence, langue à saisir)', async () => {
    userMock.value = { role: 'ADMIN', pageSize: 5 } as UserDto
    adminBundleMock.mockResolvedValue(bundle)

    let captured: Blob | null = null
    vi.spyOn(URL, 'createObjectURL').mockImplementation((obj: Blob | MediaSource) => {
      captured = obj as Blob
      return 'blob:test'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    render(<Languages />)
    await screen.findByText('common.save')

    fireEvent.click(screen.getByText('Exporter CSV'))

    await waitFor(() => expect(captured).not.toBeNull())
    const csv = await captured!.text()
    expect(csv).toContain('cle,fr,en')
    expect(csv).toContain('common.save,Enregistrer,Save')
    expect(csv).toContain('common.cancel,Annuler,Cancel')
  })

  it('importe un CSV et met à jour la langue à saisir', async () => {
    userMock.value = { role: 'ADMIN', pageSize: 5 } as UserDto
    adminBundleMock.mockResolvedValue(bundle)
    importAllMock.mockResolvedValue({ inserted: 1, updated: 1, skipped: 0 })

    const { container } = render(<Languages />)
    await screen.findByText('common.save')

    const csv = 'cle,fr,en\ncommon.save,Enregistrer,Save now\ncommon.new,Inconnu,Nouveau\n'
    const file = new File([csv], 'langues.csv', { type: 'text/csv' })
    const input = Array.from(container.querySelectorAll('input[type="file"]')).find((element) =>
      (element as HTMLInputElement).accept.includes('csv'),
    ) as HTMLInputElement

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() =>
      expect(importAllMock).toHaveBeenCalledWith({
        entries: [
          { key: 'common.save', translations: { en: 'Save now' } },
          { key: 'common.new', translations: { en: 'Nouveau' } },
        ],
      }),
    )
  })
})
