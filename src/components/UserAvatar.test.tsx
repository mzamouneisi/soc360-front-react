import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UserAvatar } from './UserAvatar'

const { photoUrlMock } = vi.hoisted(() => ({ photoUrlMock: vi.fn() }))

vi.mock('../api/consultants', () => ({
  consultantsApi: { photoUrl: photoUrlMock },
}))

afterEach(() => {
  vi.clearAllMocks()
})

describe('UserAvatar', () => {
  it('affiche les initiales quand aucune photo n’existe', () => {
    photoUrlMock.mockResolvedValue('blob:photo')

    render(<UserAvatar userId={5} firstName="Jean" lastName="Dupont" hasPhoto={false} />)

    expect(screen.getByText('JD')).toBeInTheDocument()
    expect(photoUrlMock).not.toHaveBeenCalled()
  })

  it('affiche la photo de profil quand elle existe', async () => {
    photoUrlMock.mockResolvedValue('blob:photo')

    render(<UserAvatar userId={5} firstName="Jean" lastName="Dupont" hasPhoto />)

    const image = await screen.findByRole('img', { name: 'Jean Dupont' })
    expect(image).toHaveAttribute('src', 'blob:photo')
  })
})
