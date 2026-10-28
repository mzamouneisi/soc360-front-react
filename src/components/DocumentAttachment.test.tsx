import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DocumentAttachment } from './DocumentAttachment'

const { uploadMock, downloadMock, deleteMock } = vi.hoisted(() => ({
  uploadMock: vi.fn(),
  downloadMock: vi.fn(),
  deleteMock: vi.fn(),
}))

vi.mock('../api/documents', () => ({
  documentsApi: {
    upload: uploadMock,
    download: downloadMock,
    delete: deleteMock,
    previewUrl: vi.fn().mockResolvedValue('blob:preview'),
  },
}))

afterEach(() => {
  vi.clearAllMocks()
})

describe('DocumentAttachment', () => {
  it('refuse la validation sans fichier sélectionné', () => {
    render(<DocumentAttachment value={null} onChange={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un document' }))
    fireEvent.click(screen.getByRole('button', { name: 'Valider' }))

    expect(screen.getByText('Sélectionnez un fichier.')).toBeInTheDocument()
    expect(uploadMock).not.toHaveBeenCalled()
  })

  it('annule sans téléverser ni associer de document', () => {
    const onChange = vi.fn()
    render(<DocumentAttachment value={null} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un document' }))
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(uploadMock).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('téléverse le fichier et associe le document avec son commentaire', async () => {
    uploadMock.mockResolvedValue({ id: 42, name: 'justificatif.pdf' })
    const onChange = vi.fn()
    render(<DocumentAttachment value={null} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un document' }))
    const fileInput = screen.getByLabelText('Fichier')
    expect(fileInput).toHaveAttribute(
      'accept',
      '.jpg,.jpeg,.png,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.rtf,image/jpeg,image/png,application/pdf,text/plain',
    )
    const file = new File(['contenu'], 'justificatif.pdf', { type: 'application/pdf' })
    fireEvent.change(fileInput, { target: { files: [file] } })
    fireEvent.change(screen.getByLabelText('Commentaire (facultatif)'), {
      target: { value: 'Arrêt de travail' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Valider' }))

    await waitFor(() => expect(uploadMock).toHaveBeenCalled())
    expect(onChange).toHaveBeenCalledWith({
      id: 42,
      name: 'justificatif.pdf',
      comment: 'Arrêt de travail',
      temporary: true,
    })
  })

  it('supprime du serveur un document temporaire retiré', async () => {
    deleteMock.mockResolvedValue(undefined)
    const onChange = vi.fn()
    render(
      <DocumentAttachment
        value={{ id: 43, name: 'erreur.pdf', comment: null, temporary: true }}
        onChange={onChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Retirer le document' }))

    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith(43))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('permet de visualiser le document associé', () => {
    downloadMock.mockResolvedValue(undefined)
    render(
      <DocumentAttachment
        value={{ id: 42, name: 'justificatif.pdf', comment: null }}
        onChange={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Voir le document' }))

    expect(downloadMock).toHaveBeenCalledWith(42, 'justificatif.pdf')
  })

  it('affiche le nom du document associé et permet de le retirer', async () => {
    const onChange = vi.fn()
    render(
      <DocumentAttachment
        value={{ id: 42, name: 'justificatif.pdf', comment: 'Arrêt' }}
        onChange={onChange}
      />,
    )

    expect(screen.getByText('justificatif.pdf')).toBeInTheDocument()
    expect(await screen.findByTitle('Aperçu du document PDF')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ajouter un document' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Retirer le document' }))
    expect(onChange).toHaveBeenCalledWith(null)
    expect(deleteMock).not.toHaveBeenCalled()
  })
})
