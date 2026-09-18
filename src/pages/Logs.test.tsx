import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ApiError } from '../api/client'
import { Logs } from './Logs'

const { tailMock } = vi.hoisted(() => ({
  tailMock: vi.fn(),
}))

vi.mock('../api/logs', () => ({
  logsApi: {
    tail: tailMock,
  },
}))

afterEach(() => {
  vi.clearAllMocks()
})

describe('Logs', () => {
  it('affiche les dernières lignes du log', async () => {
    tailMock.mockResolvedValue({ file: 'C:/logs/soc360.log', lines: ['ligne 1', 'ligne 2'] })

    render(<Logs />)

    expect(await screen.findByText(/ligne 1/)).toBeInTheDocument()
    expect(screen.getByText(/ligne 2/)).toBeInTheDocument()
    expect(tailMock).toHaveBeenCalledWith(100)
    expect(screen.getByText(/2 lignes/)).toBeInTheDocument()
  })

  it('change le nombre de lignes et rafraîchit', async () => {
    tailMock.mockResolvedValue({ file: 'log.txt', lines: [] })

    render(<Logs />)
    await screen.findByText('Aucune ligne de log')

    tailMock.mockResolvedValue({
      file: 'log.txt',
      lines: Array.from({ length: 50 }, (_, i) => `L${i}`),
    })

    fireEvent.change(screen.getByLabelText('Nombre de lignes'), { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: 'Afficher' }))

    await waitFor(() => expect(tailMock).toHaveBeenCalledWith(500))
    expect(await screen.findByText(/L49/)).toBeInTheDocument()
    expect(screen.getByText(/L0/)).toBeInTheDocument()
  })

  it('filtre les lignes affichées', async () => {
    tailMock.mockResolvedValue({
      file: 'log.txt',
      lines: ['INFO Démarrage', 'WARN Démarrage lent', 'INFO Arrêt'],
    })

    render(<Logs />)
    await screen.findByText(/Démarrage/)

    fireEvent.change(screen.getByLabelText('Filtrer les lignes'), { target: { value: 'warn' } })

    expect(await screen.findByText(/WARN Démarrage lent/)).toBeInTheDocument()
    expect(screen.queryByText(/INFO Arrêt/)).not.toBeInTheDocument()
    expect(screen.getByText(/1 ligne \/ 3/)).toBeInTheDocument()
  })

  it('copie les lignes affichées dans le presse-papiers', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    tailMock.mockResolvedValue({ file: 'log.txt', lines: ['ligne-a', 'ligne-b'] })

    render(<Logs />)
    await screen.findByText(/ligne-a/)

    fireEvent.click(screen.getByRole('button', { name: 'Copier' }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('ligne-a\nligne-b'))
    expect(await screen.findByRole('button', { name: 'Copié !' })).toBeInTheDocument()
  })

  it('affiche l’erreur API', async () => {
    tailMock.mockRejectedValue(new ApiError(403, 'Accès refusé'))

    render(<Logs />)

    expect(await screen.findByText('Accès refusé')).toBeInTheDocument()
  })

  it('affiche un état vide quand aucun fichier de log est configuré', async () => {
    tailMock.mockResolvedValue({ file: '', lines: [] })

    render(<Logs />)

    expect(await screen.findByText('Aucune ligne de log')).toBeInTheDocument()
    expect(
      screen.getByText('Aucun fichier de log configuré sur le serveur.'),
    ).toBeInTheDocument()
  })
})
