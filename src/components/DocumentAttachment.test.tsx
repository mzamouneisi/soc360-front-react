import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DocumentAttachment } from './DocumentAttachment'

const { uploadMock, downloadMock } = vi.hoisted(() => ({
  uploadMock: vi.fn(),
  downloadMock: vi.fn(),
}))

vi.mock('../api/documents', () => ({
  documentsApi: {
    upload: uploadMock,
    download: downloadMock,
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
    const file = new File(['contenu'], 'justificatif.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText('Fichier'), { target: { files: [file] } })
    fireEvent.change(screen.getByLabelText('Commentaire (facultatif)'), {
      target: { value: 'Arrêt de travail' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Valider' }))

    await waitFor(() => expect(uploadMock).toHaveBeenCalled())
    expect(onChange).toHaveBeenCalledWith({
      id: 42,
      name: 'justificatif.pdf',
      comment: 'Arrêt de travail',
    })
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
    fireEvent.click(screen.getByRole('button', { name: 'Retirer le document' }))
    expect(onChange).toHaveBeenCalledWith(null)
  })
})
