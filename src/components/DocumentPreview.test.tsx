import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DocumentPreview } from './DocumentPreview'

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
})
