import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ApiError } from '../api/client'
import { Login } from './Login'

const { loginMock } = vi.hoisted(() => ({ loginMock: vi.fn() }))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    initializing: false,
    login: loginMock,
    logout: vi.fn(),
    setUser: vi.fn(),
    refreshMe: vi.fn(),
  }),
}))

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Login />
    </MemoryRouter>,
  )
}

describe('Login', () => {
  it('affiche le formulaire de connexion', () => {
    renderLogin()
    expect(screen.getByText('SOC360')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('email ou identifiant')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument()
  })

  it('appelle login avec les identifiants saisis', async () => {
    loginMock.mockResolvedValue({ id: 1 })

    renderLogin()
    fireEvent.change(screen.getByPlaceholderText('email ou identifiant'), {
      target: { value: 'alice' },
    })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'secret' },
    })
    fireEvent.submit(screen.getByRole('button', { name: 'Se connecter' }).closest('form')!)

    await waitFor(() => expect(loginMock).toHaveBeenCalledWith('alice', 'secret'))
  })

  it('affiche le message d’erreur du serveur en cas d’échec', async () => {
    loginMock.mockRejectedValue(new ApiError(401, 'Identifiants invalides'))

    renderLogin()
    fireEvent.change(screen.getByPlaceholderText('email ou identifiant'), {
      target: { value: 'alice' },
    })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'mauvais' },
    })
    fireEvent.submit(screen.getByRole('button', { name: 'Se connecter' }).closest('form')!)

    expect(await screen.findByText('Identifiants invalides')).toBeInTheDocument()
  })

  it('affiche un message générique pour une erreur inattendue', async () => {
    loginMock.mockRejectedValue(new Error('boom'))

    renderLogin()
    fireEvent.change(screen.getByPlaceholderText('email ou identifiant'), {
      target: { value: 'alice' },
    })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'secret' },
    })
    fireEvent.submit(screen.getByRole('button', { name: 'Se connecter' }).closest('form')!)

    expect(await screen.findByText('Erreur inattendue')).toBeInTheDocument()
  })
})
