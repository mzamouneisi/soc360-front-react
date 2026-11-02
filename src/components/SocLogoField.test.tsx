import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SocLogoField } from './SocLogoField'
import type { SocDto } from '../api/types'

const { logoUrlMock, uploadLogoMock, removeLogoMock, confirmMock } = vi.hoisted(() => ({
  logoUrlMock: vi.fn(),
  uploadLogoMock: vi.fn(),
  removeLogoMock: vi.fn(),
  confirmMock: vi.fn(),
}))

vi.mock('../api/socs', () => ({
  socsApi: {
    logoUrl: logoUrlMock,
    uploadLogo: uploadLogoMock,
    removeLogo: removeLogoMock,
  },
}))

vi.mock('./dialog', () => ({
  dialog: { confirm: confirmMock, error: vi.fn() },
}))

const saved: SocDto = {
  id: 5,
  name: 'Acme',
  hasLogo: true,
  logoFilename: 'logo.png',
  logoMimeType: 'image/png',
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('SocLogoField', () => {
  it('affiche le logo SOC360 par défaut sans logo personnalisé', () => {
    render(<SocLogoField socId={5} hasLogo={false} onChange={vi.fn()} />)

    const image = document.getElementById('SocLogo.apercu.image') as HTMLImageElement
    expect(image.src).toContain('favicon.svg')
    expect(document.getElementById('SocLogo.supprimer')).toBeNull()
  })

  it('refuse un fichier non conforme', () => {
    render(<SocLogoField socId={5} hasLogo={false} onChange={vi.fn()} />)

    const input = document.getElementById('SocLogo.choisir.input') as HTMLInputElement
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'logo.gif', { type: 'image/gif' })] },
    })

    expect(screen.getByText(/Format de logo non accepté/)).toBeInTheDocument()
    expect(uploadLogoMock).not.toHaveBeenCalled()
  })

  it('téléverse un logo valide et notifie le parent', async () => {
    uploadLogoMock.mockResolvedValue(saved)
    const onChange = vi.fn()
    render(<SocLogoField socId={5} hasLogo={false} onChange={onChange} />)

    const input = document.getElementById('SocLogo.choisir.input') as HTMLInputElement
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'logo.png', { type: 'image/png' })] },
    })

    await waitFor(() => expect(uploadLogoMock).toHaveBeenCalledWith(5, expect.any(File)))
    expect(onChange).toHaveBeenCalledWith(saved)
  })

  it('supprime le logo après confirmation', async () => {
    logoUrlMock.mockResolvedValue('blob:logo')
    removeLogoMock.mockResolvedValue({ ...saved, hasLogo: false })
    confirmMock.mockResolvedValue(true)
    const onChange = vi.fn()
    render(<SocLogoField socId={5} hasLogo onChange={onChange} />)

    const remove = await screen.findByRole('button', { name: 'Supprimer le logo' })
    fireEvent.click(remove)

    await waitFor(() => expect(removeLogoMock).toHaveBeenCalledWith(5))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ hasLogo: false }))
  })
})
