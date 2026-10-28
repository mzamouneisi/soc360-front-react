import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DocumentPreview } from './DocumentPreview'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('DocumentPreview', () => {
  it('aligne une image à gauche dans la zone d’aperçu', () => {
    render(<DocumentPreview url="blob:preview" name="photo.png" />)

    expect(screen.getByAltText('Aperçu de l’image')).toHaveClass('object-left')
  })

  it('affiche un PDF dans une iframe', () => {
    render(<DocumentPreview url="blob:preview" name="document.pdf" />)

    expect(screen.getByTitle('Aperçu du document PDF')).toBeInTheDocument()
  })

  it('ne rend rien sans document', () => {
    const { container } = render(<DocumentPreview url={null} name={null} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('affiche la première page d’un fichier texte', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('Ligne 1\nLigne 2\nLigne 3'),
      }),
    )
    render(<DocumentPreview url="blob:text" name="notes.txt" />)

    expect(await screen.findByText(/Ligne 1/)).toBeInTheDocument()
  })

  it('affiche un aperçu de première page pour un document bureautique', () => {
    render(<DocumentPreview url="blob:doc" name="rapport.docx" />)

    expect(screen.getByText('rapport.docx')).toBeInTheDocument()
    expect(screen.getByText(/première page/i)).toBeInTheDocument()
  })

  it('ouvre le document complet dans une popup au clic', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('Ligne 1'),
      }),
    )
    render(<DocumentPreview id="preview" url="blob:text" name="notes.txt" />)

    fireEvent.click(screen.getByRole('button', { name: 'Voir le document' }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
  })

  it('permet de zoomer et d’agrandir la popup', () => {
    render(<DocumentPreview url="blob:preview" name="photo.png" />)
    fireEvent.click(screen.getByRole('button', { name: 'Voir le document' }))

    expect(screen.getByText('100%')).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('Zoomer'))
    expect(screen.getByText('125%')).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('Agrandir'))
    expect(screen.getByRole('button', { name: 'Réduire' })).toBeInTheDocument()
  })
})