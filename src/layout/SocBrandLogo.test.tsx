import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { SocBrandLogo } from './SocBrandLogo'

const { socMock, logoUrlMock } = vi.hoisted(() => ({
  socMock: { value: { id: 5, name: 'Acme', hasLogo: false } as { id: number; name: string; hasLogo?: boolean } | null },
  logoUrlMock: vi.fn(),
}))

vi.mock('../soc/SocContext', () => ({
  useSoc: () => ({ selectedSoc: socMock.value }),
}))

vi.mock('../api/socs', () => ({
  socsApi: { logoUrl: logoUrlMock },
}))

afterEach(() => {
  vi.clearAllMocks()
})

describe('SocBrandLogo', () => {
  it('affiche le logo SOC360 et son texte sans logo personnalisé', () => {
    socMock.value = { id: 5, name: 'Acme', hasLogo: false }

    render(<SocBrandLogo />)

    const image = document.getElementById('MainLayout.logo') as HTMLImageElement
    expect(image.src).toContain('favicon.svg')
    expect(document.getElementById('MainLayout.soc360')).not.toBeNull()
  })

  it('affiche uniquement le logo de la société quand un logo existe', async () => {
    socMock.value = { id: 5, name: 'Acme', hasLogo: true }
    logoUrlMock.mockResolvedValue('blob:company-logo')

    render(<SocBrandLogo />)

    await waitFor(() =>
      expect((document.getElementById('MainLayout.logo') as HTMLImageElement).src).toBe(
        'blob:company-logo',
      ),
    )
    expect(document.getElementById('MainLayout.soc360')).toBeNull()
  })
})
