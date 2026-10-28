import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ApiError } from '../api/client'
import { NoteFraisList } from './NoteFraisList'
import { DialogHost } from '../components/dialog'
import type { NoteFraisDto, UserDto } from '../api/types'

const {
  findBySocYearMock,
  findByConsultantYearMock,
  totalsByMonthMock,
  totalsByCategoryMock,
  createMock,
  submitMock,
  validateMock,
  rejectMock,
  deleteMock,
  summariesMock,
  userMock,
  ocrImageTextMock,
  documentUploadMock,
  documentDownloadMock,
  documentPreviewUrlMock,
} = vi.hoisted(() => ({
  findBySocYearMock: vi.fn(),
  findByConsultantYearMock: vi.fn(),
  totalsByMonthMock: vi.fn(),
  totalsByCategoryMock: vi.fn(),
  createMock: vi.fn(),
  submitMock: vi.fn(),
  validateMock: vi.fn(),
  rejectMock: vi.fn(),
  deleteMock: vi.fn(),
  summariesMock: vi.fn(),
  userMock: { value: null as unknown as UserDto },
  ocrImageTextMock: vi.fn(),
  documentUploadMock: vi.fn(),
  documentDownloadMock: vi.fn(),
  documentPreviewUrlMock: vi.fn(),
}))

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

vi.mock('../api/noteFrais', () => ({
  noteFraisApi: {
    findBySocYear: findBySocYearMock,
    findByConsultantYear: findByConsultantYearMock,
    getById: vi.fn(),
    create: createMock,
    update: vi.fn(),
    submit: submitMock,
    validate: validateMock,
    reject: rejectMock,
    delete: deleteMock,
    totalsByMonth: totalsByMonthMock,
    totalsByCategory: totalsByCategoryMock,
    totalsByConsultant: vi.fn(),
  },
}))

vi.mock('../api/consultants', () => ({
  consultantsApi: { summaries: summariesMock },
}))

vi.mock('../api/documents', () => ({
  documentsApi: {
    upload: documentUploadMock,
    download: documentDownloadMock,
    previewUrl: documentPreviewUrlMock,
  },
}))

vi.mock('../lib/ocr', () => ({
  isImageFile: (name: string) => /\.(png|jpe?g|gif|webp|bmp)$/i.test(name),
  ocrImageText: ocrImageTextMock,
}))

const managerUser = {
  id: 1,
  username: 'manager',
  email: 'manager@soc.fr',
  firstName: 'M',
  lastName: 'Manager',
  phone: null,
  role: 'MANAGER',
  active: true,
  socId: 5,
  socName: 'SOC Test',
  consultantId: null,
  mustChangePassword: false,
  lastLoginAt: null,
} as UserDto

const consultantUser = {
  ...managerUser,
  id: 2,
  role: 'CONSULTANT',
  socId: null,
  socName: null,
  consultantId: 10,
} as UserDto

const nf = (overrides: Partial<NoteFraisDto> = {}): NoteFraisDto => ({
  id: 1,
  consultantId: 10,
  consultantName: 'Alice Martin',
  socId: 5,
  month: 8,
  year: 2026,
  status: 'DRAFT',
  totalAmount: 125.5,
  submittedAt: null,
  validatedAt: null,
  paidAt: null,
  comment: null,
  lines: [
    {
      id: 1,
      date: '2026-08-01',
      category: 'Restaurant',
      label: 'Déjeuner client',
      montantHT: 125.5,
      montantTTC: 125.5,
      enseigne: 'McDonald\'s',
      adresse: '1 rue de Paris',
      reimbursed: false,
      comment: null,
    },
  ],
  ...overrides,
})

function stubFixedNow() {
  const RealDate = Date
  const fixed = new RealDate(2026, 7, 15, 12, 0, 0)
  vi.stubGlobal(
    'Date',
    class extends RealDate {
      constructor() {
        super(fixed.getTime())
      }
      static now() {
        return RealDate.now()
      }
    },
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  ocrImageTextMock.mockReset()
  documentUploadMock.mockReset()
  documentDownloadMock.mockReset()
  documentPreviewUrlMock.mockReset()
  userMock.value = null as unknown as UserDto
})

function renderList() {
  return render(
    <MemoryRouter initialEntries={['/note-frais']}>
      <NoteFraisList />
      <DialogHost />
    </MemoryRouter>,
  )
}

describe('NoteFraisList', () => {
  it('affiche le tableau, les totaux et les graphiques pour un manager', async () => {
    userMock.value = managerUser
    findBySocYearMock.mockResolvedValue([nf()])
    totalsByMonthMock.mockResolvedValue({ '8': 125.5 })
    totalsByCategoryMock.mockResolvedValue({ Restaurant: 125.5 })
    summariesMock.mockResolvedValue([])

    renderList()

    expect(await screen.findByText('Alice Martin')).toBeInTheDocument()
    expect(findBySocYearMock).toHaveBeenCalledWith(5, 2026)
    expect(screen.getByText('Août 2026')).toBeInTheDocument()
    expect(screen.getByText('Brouillon')).toBeInTheDocument()
    expect(screen.getByText('Total 2026')).toBeInTheDocument()
    expect(screen.getByText('Montants par mois')).toBeInTheDocument()
    expect(screen.getByText('Montants par catégorie')).toBeInTheDocument()
    expect(screen.getByText('Restaurant · 125,50 €')).toBeInTheDocument()
    expect(screen.getAllByText('125,50 €').length).toBeGreaterThan(0)
  })

  it('affiche l’état vide pour un consultant et appelle l’API avec son identifiant', async () => {
    userMock.value = consultantUser
    findByConsultantYearMock.mockResolvedValue([])

    renderList()

    expect(await screen.findByText('Aucune note de frais pour 2026')).toBeInTheDocument()
    expect(findByConsultantYearMock).toHaveBeenCalledWith(10, 2026)
    expect(screen.queryByText('Montants par mois')).not.toBeInTheDocument()
  })

  it('soumet une note de frais au statut Brouillon', async () => {
    userMock.value = managerUser
    findBySocYearMock.mockResolvedValue([nf()])
    totalsByMonthMock.mockResolvedValue({})
    totalsByCategoryMock.mockResolvedValue({})
    summariesMock.mockResolvedValue([])
    submitMock.mockResolvedValue(nf({ status: 'SUBMITTED' }))

    renderList()

    fireEvent.click(await screen.findByRole('button', { name: 'Soumettre' }))

    await waitFor(() => expect(submitMock).toHaveBeenCalledWith(1))
  })

  it('valide une note de frais soumise', async () => {
    userMock.value = managerUser
    findBySocYearMock.mockResolvedValue([nf({ status: 'SUBMITTED' })])
    totalsByMonthMock.mockResolvedValue({})
    totalsByCategoryMock.mockResolvedValue({})
    summariesMock.mockResolvedValue([])
    validateMock.mockResolvedValue(nf({ status: 'VALIDATED' }))

    renderList()

    fireEvent.click(await screen.findByRole('button', { name: 'Valider' }))

    await waitFor(() => expect(validateMock).toHaveBeenCalledWith(1))
  })

  it('rejette une note de frais avec le motif saisi', async () => {
    userMock.value = managerUser
    findBySocYearMock.mockResolvedValue([nf({ status: 'SUBMITTED' })])
    totalsByMonthMock.mockResolvedValue({})
    totalsByCategoryMock.mockResolvedValue({})
    summariesMock.mockResolvedValue([])
    rejectMock.mockResolvedValue(nf({ status: 'REJECTED', comment: 'Justificatif manquant' }))

    renderList()

    fireEvent.click(await screen.findByRole('button', { name: 'Rejeter' }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByRole('textbox'), {
      target: { value: 'Justificatif manquant' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmer' }))

    await waitFor(() => expect(rejectMock).toHaveBeenCalledWith(1, 'Justificatif manquant'))
  })

  it('supprime une note de frais après confirmation', async () => {
    userMock.value = managerUser
    findBySocYearMock.mockResolvedValue([nf()])
    totalsByMonthMock.mockResolvedValue({})
    totalsByCategoryMock.mockResolvedValue({})
    summariesMock.mockResolvedValue([])
    deleteMock.mockResolvedValue(undefined)

    renderList()

    fireEvent.click(await screen.findByRole('button', { name: 'Suppr.' }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Supprimer' }))

    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith(1))
  })

  it('masque les libellés obligatoires quand tous les champs sont remplis', async () => {
    userMock.value = managerUser
    findBySocYearMock.mockResolvedValue([])
    totalsByMonthMock.mockResolvedValue({})
    totalsByCategoryMock.mockResolvedValue({})
    summariesMock.mockResolvedValue([])
    documentUploadMock.mockResolvedValue({ id: 77, name: 'facture.png' })
    ocrImageTextMock.mockResolvedValue('')

    renderList()
    fireEvent.click(screen.getByRole('button', { name: 'Nouvelle note de frais' }))

    const dialog = await screen.findByRole('dialog')
    expect(document.getElementById('NoteFraisList.justificatif.obligatoire')).not.toBeNull()
    expect(document.getElementById('NoteFraisList.champs.obligatoires')).not.toBeNull()

    fireEvent.change(within(dialog).getByLabelText(/Joindre une facture/), {
      target: { files: [new File(['fake'], 'facture.png', { type: 'image/png' })] },
    })
    await waitFor(() =>
      expect(within(dialog).getByLabelText(/Joindre une facture/)).toBeDisabled(),
    )
    fireEvent.change(within(dialog).getByPlaceholderText('Nom enseigne'), {
      target: { value: 'SNCF' },
    })
    fireEvent.change(within(dialog).getByPlaceholderText('Libellé / action'), {
      target: { value: 'Train' },
    })
    fireEvent.change(within(dialog).getByPlaceholderText('Adresse'), {
      target: { value: '1 rue de Paris' },
    })
    fireEvent.change(within(dialog).getByPlaceholderText('Montant HT €'), {
      target: { value: '45' },
    })
    fireEvent.change(within(dialog).getByPlaceholderText('Montant TTC €'), {
      target: { value: '55' },
    })

    await waitFor(() => {
      expect(document.getElementById('NoteFraisList.justificatif.obligatoire')).toBeNull()
      expect(document.getElementById('NoteFraisList.champs.obligatoires')).toBeNull()
    })
  })

  it('affiche l’aperçu du document en modification', async () => {
    userMock.value = managerUser
    findBySocYearMock.mockResolvedValue([
      nf({ documentId: 77, documentName: 'facture.png' }),
    ])
    totalsByMonthMock.mockResolvedValue({})
    totalsByCategoryMock.mockResolvedValue({})
    summariesMock.mockResolvedValue([])
    documentPreviewUrlMock.mockResolvedValue('blob:preview')

    renderList()
    fireEvent.click(await screen.findByRole('button', { name: 'Modifier' }))

    const dialog = await screen.findByRole('dialog')
    await waitFor(() => expect(documentPreviewUrlMock).toHaveBeenCalledWith(77))
    expect(within(dialog).getByAltText(/Aperçu de l.image/)).toHaveAttribute(
      'src',
      'blob:preview',
    )
    expect(within(dialog).getByRole('button', { name: 'Télécharger le justificatif' })).toBeInTheDocument()
  })

  it('pré-sélectionne le collaborateur connecté', async () => {
    userMock.value = managerUser
    findBySocYearMock.mockResolvedValue([])
    totalsByMonthMock.mockResolvedValue({})
    totalsByCategoryMock.mockResolvedValue({})
    summariesMock.mockResolvedValue([])

    renderList()
    fireEvent.click(screen.getByRole('button', { name: 'Nouvelle note de frais' }))

    const dialog = await screen.findByRole('dialog')
    const select = within(dialog).getAllByRole('combobox')[0]
    expect(select).toHaveValue('1')
    expect(within(select).getByRole('option', { name: 'M Manager' })).toBeInTheDocument()
  })

  it('crée une note de frais depuis le formulaire', async () => {
    userMock.value = managerUser
    findBySocYearMock.mockResolvedValue([])
    totalsByMonthMock.mockResolvedValue({})
    totalsByCategoryMock.mockResolvedValue({})
    summariesMock.mockResolvedValue([
      { id: 10, fullName: 'Alice Martin', position: 'Consultante', email: 'alice@soc.fr' },
    ])
    createMock.mockResolvedValue(nf())
    documentUploadMock.mockResolvedValue({ id: 77, name: 'facture.png' })
    ocrImageTextMock.mockResolvedValue('')
    stubFixedNow()

    renderList()

    const today = new Date().toISOString().slice(0, 10)

    fireEvent.click(screen.getByRole('button', { name: 'Nouvelle note de frais' }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/Joindre une facture/), {
      target: { files: [new File(['fake'], 'facture.png', { type: 'image/png' })] },
    })
    await waitFor(() => expect(documentUploadMock).toHaveBeenCalled())
    await within(dialog).findByText('facture.png')
    const selects = within(dialog).getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: '10' } })
    fireEvent.change(within(dialog).getByPlaceholderText('Nom enseigne'), {
      target: { value: 'SNCF' },
    })
    fireEvent.change(within(dialog).getByPlaceholderText('Libellé / action'), {
      target: { value: 'Train' },
    })
    fireEvent.change(within(dialog).getByPlaceholderText('Adresse'), {
      target: { value: '1 rue de Paris' },
    })
    fireEvent.change(within(dialog).getByPlaceholderText('Montant HT €'), {
      target: { value: '45' },
    })
    fireEvent.change(within(dialog).getByPlaceholderText('Montant TTC €'), {
      target: { value: '55' },
    })
    const createButton = within(dialog).getByRole('button', { name: 'Créer' })
    await waitFor(() => expect(createButton).toBeEnabled())
    fireEvent.click(createButton)

    await waitFor(() =>
      expect(createMock).toHaveBeenCalledWith({
        consultantId: 10,
        month: 8,
        year: 2026,
        lines: [
          {
            date: today,
            category: 'Déplacement',
            label: 'Train',
            montantHT: 45,
            montantTTC: 55,
            enseigne: 'SNCF',
            adresse: '1 rue de Paris',
            reimbursed: false,
            comment: null,
          },
        ],
        infosFacture: null,
        documentId: 77,
        documentName: 'facture.png',
      }),
    )
  })

  it('désactive la création tant que le justificatif manque', async () => {
    userMock.value = managerUser
    findBySocYearMock.mockResolvedValue([])
    totalsByMonthMock.mockResolvedValue({})
    totalsByCategoryMock.mockResolvedValue({})
    summariesMock.mockResolvedValue([
      { id: 10, fullName: 'Alice Martin', position: 'Consultante', email: 'alice@soc.fr' },
    ])

    renderList()
    fireEvent.click(screen.getByRole('button', { name: 'Nouvelle note de frais' }))

    const dialog = await screen.findByRole('dialog')
    const selects = within(dialog).getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: '10' } })
    fireEvent.change(within(dialog).getByPlaceholderText('Libellé / action'), {
      target: { value: 'Train' },
    })
    fireEvent.change(within(dialog).getByPlaceholderText('Montant HT €'), {
      target: { value: '45' },
    })

    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Créer' })).toBeDisabled(),
    )
    expect(createMock).not.toHaveBeenCalled()
  })

  it('téléverse le justificatif et propose son téléchargement', async () => {
    userMock.value = managerUser
    findBySocYearMock.mockResolvedValue([])
    totalsByMonthMock.mockResolvedValue({})
    totalsByCategoryMock.mockResolvedValue({})
    summariesMock.mockResolvedValue([])
    documentUploadMock.mockResolvedValue({ id: 77, name: 'facture.png' })
    documentDownloadMock.mockResolvedValue(undefined)
    ocrImageTextMock.mockResolvedValue('')

    renderList()
    fireEvent.click(screen.getByRole('button', { name: 'Nouvelle note de frais' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByTitle('Joindre une facture (image / PDF)')).toHaveTextContent('+')
    const fileInput = within(dialog).getByLabelText(/Joindre une facture/)
    fireEvent.change(fileInput, {
      target: { files: [new File(['fake'], 'facture.png', { type: 'image/png' })] },
    })

    await waitFor(() => expect(documentUploadMock).toHaveBeenCalled())
    await waitFor(() => expect(fileInput).toBeDisabled())
    const download = await within(dialog).findByRole('button', {
      name: 'Télécharger le justificatif',
    })
    fireEvent.click(download)
    await waitFor(() => expect(documentDownloadMock).toHaveBeenCalledWith(77, 'facture.png'))
  })

  it('désactive la création si une ligne est incomplète', async () => {
    userMock.value = managerUser
    findBySocYearMock.mockResolvedValue([])
    totalsByMonthMock.mockResolvedValue({})
    totalsByCategoryMock.mockResolvedValue({})
    summariesMock.mockResolvedValue([
      { id: 10, fullName: 'Alice Martin', position: 'Consultante', email: 'alice@soc.fr' },
    ])
    documentUploadMock.mockResolvedValue({ id: 77, name: 'facture.png' })
    ocrImageTextMock.mockResolvedValue('')

    renderList()
    fireEvent.click(screen.getByRole('button', { name: 'Nouvelle note de frais' }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/Joindre une facture/), {
      target: { files: [new File(['fake'], 'facture.png', { type: 'image/png' })] },
    })
    await within(dialog).findByText('facture.png')
    const selects = within(dialog).getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: '10' } })
    fireEvent.change(within(dialog).getByPlaceholderText('Libellé / action'), {
      target: { value: 'Train' },
    })
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Créer' })).toBeDisabled(),
    )
    expect(createMock).not.toHaveBeenCalled()
  })

  it('affiche l’erreur API dans un bloc d’erreur', async () => {
    userMock.value = managerUser
    findBySocYearMock.mockRejectedValue(new ApiError(500, 'Erreur serveur'))
    totalsByMonthMock.mockResolvedValue({})
    totalsByCategoryMock.mockResolvedValue({})
    summariesMock.mockResolvedValue([])

    renderList()

    expect(await screen.findByText('Erreur serveur')).toBeInTheDocument()
  })

  it('lit une image via OCR et pré-remplit les champs', async () => {
    userMock.value = managerUser
    findBySocYearMock.mockResolvedValue([])
    totalsByMonthMock.mockResolvedValue({})
    totalsByCategoryMock.mockResolvedValue({})
    summariesMock.mockResolvedValue([])
    documentUploadMock.mockResolvedValue({ id: 77, name: 'facture.png' })
    ocrImageTextMock.mockResolvedValue('Restaurant McDo 25,50 € le 12/03/2026')

    renderList()
    fireEvent.click(screen.getByRole('button', { name: 'Nouvelle note de frais' }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/Joindre une facture/), {
      target: { files: [new File(['fake'], 'facture.png', { type: 'image/png' })] },
    })

    await waitFor(() => expect(ocrImageTextMock).toHaveBeenCalled())
    await waitFor(() => expect(within(dialog).getByPlaceholderText('Montant TTC €')).toHaveValue(25.5))
    expect(within(dialog).getByPlaceholderText('Libellé / action')).toHaveValue('facture')
    expect(
      within(dialog).getByPlaceholderText(
        'Collez ou saisissez ici le contenu de la facture / du ticket…',
      ),
    ).toHaveValue('Restaurant McDo 25,50 € le 12/03/2026')
  })

  it('désactive le bouton + après le premier justificatif', async () => {
    userMock.value = managerUser
    findBySocYearMock.mockResolvedValue([])
    totalsByMonthMock.mockResolvedValue({})
    totalsByCategoryMock.mockResolvedValue({})
    summariesMock.mockResolvedValue([])
    documentUploadMock.mockResolvedValue({ id: 77, name: 'facture1.png' })
    ocrImageTextMock.mockResolvedValue(
      'ALLO PIZZA DI NAPOLI\n26 RUE DE BOISSY\n91480 QUINCY SOUS SENART\n16/01/2025 20:44\nNET A PAYER TTC EURO 25.00',
    )

    renderList()
    fireEvent.click(screen.getByRole('button', { name: 'Nouvelle note de frais' }))

    const dialog = await screen.findByRole('dialog')
    const fileInput = within(dialog).getByLabelText(/Joindre une facture/)
    fireEvent.change(fileInput, {
      target: { files: [new File(['fake'], 'facture1.png', { type: 'image/png' })] },
    })

    await waitFor(() => expect(fileInput).toBeDisabled())
    expect(within(dialog).getAllByPlaceholderText('Montant TTC €')).toHaveLength(1)
    expect(within(dialog).getByPlaceholderText('Montant TTC €')).toHaveValue(25)
    expect(within(dialog).getByPlaceholderText('Nom enseigne')).toHaveValue(
      'ALLO PIZZA DI NAPOLI',
    )

    fireEvent.change(fileInput, {
      target: { files: [new File(['fake'], 'facture2.png', { type: 'image/png' })] },
    })
    expect(within(dialog).getAllByPlaceholderText('Montant TTC €')).toHaveLength(1)
  })

  it('affiche une erreur quand l’OCR ne trouve pas de texte dans l’image', async () => {
    userMock.value = managerUser
    findBySocYearMock.mockResolvedValue([])
    totalsByMonthMock.mockResolvedValue({})
    totalsByCategoryMock.mockResolvedValue({})
    summariesMock.mockResolvedValue([])
    documentUploadMock.mockResolvedValue({ id: 77, name: 'facture.png' })
    ocrImageTextMock.mockResolvedValue('')

    renderList()
    fireEvent.click(screen.getByRole('button', { name: 'Nouvelle note de frais' }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/Joindre une facture/), {
      target: { files: [new File(['fake'], 'facture.png', { type: 'image/png' })] },
    })

    await waitFor(() =>
      expect(
        within(dialog).getByText(/OCR non disponible pour cette image/),
      ).toBeInTheDocument(),
    )
  })
})
