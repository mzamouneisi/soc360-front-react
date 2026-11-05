import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ResponsibleSocRoute } from './ResponsibleSocRoute'
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
        <Route
          path="/secret"
          element={(
            <ResponsibleSocRoute>
              <p>Paramètres</p>
            </ResponsibleSocRoute>
          )}
        />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.clearAllMocks()
  userMock.value = null as unknown as UserDto
})

describe('ResponsibleSocRoute', () => {
  it('autorise le responsable de société', () => {
    userMock.value = { role: 'RESPONSIBLE_SOC' } as UserDto
    renderSecret()
    expect(screen.getByText('Paramètres')).toBeInTheDocument()
  })

  it('redirige le manager vers l’accueil', () => {
    userMock.value = { role: 'MANAGER' } as UserDto
    renderSecret()
    expect(screen.getByText('Accueil')).toBeInTheDocument()
    expect(screen.queryByText('Paramètres')).not.toBeInTheDocument()
  })
})
