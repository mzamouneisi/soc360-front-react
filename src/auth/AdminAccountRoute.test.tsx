import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AdminAccountRoute } from './AdminAccountRoute'
import type { UserDto } from '../api/types'

const { userMock } = vi.hoisted(() => ({ userMock: { value: null as unknown as UserDto } }))

vi.mock('./AuthContext', () => ({
  useAuth: () => ({ user: userMock.value }),
}))

function renderSecret() {
  render(
    <MemoryRouter initialEntries={['/secret']}>
      <Routes>
        <Route path="/" element={<p>Accueil</p>} />
        <Route path="/secret" element={<AdminAccountRoute><p>Configuration</p></AdminAccountRoute>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.clearAllMocks()
  userMock.value = null as unknown as UserDto
})

describe('AdminAccountRoute', () => {
  it('autorise le username admin', () => {
    userMock.value = { username: 'admin', role: 'ADMIN' } as UserDto
    renderSecret()
    expect(screen.getByText('Configuration')).toBeInTheDocument()
  })

  it('redirige un autre administrateur', () => {
    userMock.value = { username: 'autre', role: 'ADMIN' } as UserDto
    renderSecret()
    expect(screen.getByText('Accueil')).toBeInTheDocument()
  })
})
