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

function spyDownload() {
  let captured: Blob | null = null
  vi.spyOn(URL, 'createObjectURL').mockImplementation((obj: Blob | MediaSource) => {
    captured = obj as Blob
    return 'blob:test'
  })
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  return () => captured
}

async function renderLoaded() {
  userMock.value = { role: 'ADMIN', pageSize: 5 } as UserDto
  adminBundleMock.mockResolvedValue(bundle)
  const utils = render(<Languages />)
  await screen.findByText('common.save')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Exporter' })).toBeEnabled())
  return utils
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  userMock.value = null as unknown as UserDto
})

describe('Languages', () => {
  it('exporte les colonnes cochées en CSV', async () => {
    const captured = spyDownload()
    await renderLoaded()

    fireEvent.click(screen.getByRole('button', { name: 'Exporter' }))

    await waitFor(() => expect(captured()).not.toBeNull())
    const csv = await captured()!.text()
    expect(csv).toContain('cle,fr,en')
    expect(csv).toContain('common.save,Enregistrer,Save')
    expect(csv).toContain('common.cancel,Annuler,Cancel')
  })

  it('exporte en JSON quand le format JSON est sélectionné', async () => {
    const captured = spyDownload()
    await renderLoaded()

    fireEvent.click(screen.getByRole('radio', { name: 'JSON' }))
    fireEvent.click(screen.getByRole('button', { name: 'Exporter' }))

    await waitFor(() => expect(captured()).not.toBeNull())
    const payload = JSON.parse(await captured()!.text()) as {
      languages: string[]
      entries: { key: string; translations: Record<string, string> }[]
    }
    expect(payload.languages).toEqual(['fr', 'en'])
    expect(payload.entries[0]).toEqual({
      key: 'common.save',
      translations: { fr: 'Enregistrer', en: 'Save' },
    })
  })

  it('importe un CSV et met à jour les langues cochées', async () => {
    const { container } = await renderLoaded()
    importAllMock.mockResolvedValue({ inserted: 1, updated: 1, skipped: 0 })

    const csv = 'cle,fr,en\ncommon.save,Enregistrer,Save now\ncommon.new,Inconnu,Nouveau\n'
    const file = new File([csv], 'langues.csv', { type: 'text/csv' })
    const input = container.querySelector('input[type="file"]') as HTMLInputElement

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() =>
      expect(importAllMock).toHaveBeenCalledWith({
        entries: [
          { key: 'common.save', translations: { fr: 'Enregistrer', en: 'Save now' } },
          { key: 'common.new', translations: { fr: 'Inconnu', en: 'Nouveau' } },
        ],
      }),
    )
  })

  it('désactive l’export avec moins de deux langues cochées', async () => {
    await renderLoaded()

    fireEvent.click(screen.getByRole('checkbox', { name: 'en-English' }))

    expect(screen.getByRole('button', { name: 'Exporter' })).toBeDisabled()
  })
})
