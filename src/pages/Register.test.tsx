import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Register } from './Register'
import { DialogHost } from '../components/dialog'

const { searchSoc, registerSoc } = vi.hoisted(() => ({ searchSoc: vi.fn(), registerSoc: vi.fn() }))

vi.mock('../api/auth', () => ({
  authApi: {
    searchSoc,
    registerSoc,
  },
}))

function renderRegister() {
  return render(
    <MemoryRouter>
      <Register />
      <DialogHost />
    </MemoryRouter>,
  )
}

describe('Register company search controls', () => {
  beforeEach(() => {
    searchSoc.mockReset()
    registerSoc.mockReset()
  })

  it('searches by company name and displays matching companies', async () => {
    searchSoc.mockResolvedValue([
      {
        name: 'VEOLIA WATER STI',
        infosWeb: null,
        siret: '35338571900433',
        codeNaf: '28.29B',
        gerant: null,
        categorieEntreprise: null,
        dateCreation: null,
        dateFermeture: null,
        website: null,
        street: null,
        zipCode: null,
        city: 'SAINT-MAURICE',
        country: 'FR',
      },
      {
        name: 'VEOLIA ENERGIE FRANCE',
        infosWeb: null,
        siret: '50886712400051',
        codeNaf: '35.30Z',
        gerant: null,
        categorieEntreprise: null,
        dateCreation: null,
        dateFermeture: null,
        website: null,
        street: null,
        zipCode: null,
        city: 'PARIS',
        country: 'FR',
      },
    ])

    const user = userEvent.setup()
    renderRegister()
    await user.type(screen.getByPlaceholderText('Ma société de conseil'), 'veolia')
    await user.click(screen.getByRole('button', { name: 'Rechercher' }))

    expect(searchSoc).toHaveBeenCalledWith('veolia', undefined)
    expect(await screen.findByText('VEOLIA WATER STI')).toBeInTheDocument()
  })

  it('leaves the website empty when no company is found', async () => {
    searchSoc.mockResolvedValue([])

    const user = userEvent.setup()
    renderRegister()
    await user.type(screen.getByPlaceholderText('Ma société de conseil'), 'Ma Société')
    await user.click(screen.getByRole('button', { name: 'Rechercher' }))

    expect(screen.getByLabelText('Site web')).toHaveValue('')
  })

  it('clears all form fields after confirmation', async () => {
    const user = userEvent.setup()
    renderRegister()
    await user.type(screen.getByPlaceholderText('Ma société de conseil'), 'Veolia')
    await user.type(screen.getByPlaceholderText('123 456 789 00012'), '123')
    await user.click(screen.getByRole('button', { name: 'Effacer' }))

    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Effacer' }))

    await waitFor(() => expect(screen.getByPlaceholderText('Ma société de conseil')).toHaveValue(''))
    expect(screen.getByPlaceholderText('123 456 789 00012')).toHaveValue('')
  })

  it('keeps the account credentials in the public registration payload', async () => {
    registerSoc.mockResolvedValue({ message: 'ok' })

    const user = userEvent.setup()
    renderRegister()
    await user.type(screen.getByPlaceholderText('Ma société de conseil'), 'Ma Société')
    await user.type(screen.getByPlaceholderText('Marie'), 'Marie')
    await user.type(screen.getByPlaceholderText('Durand'), 'Durand')
    await user.type(screen.getByPlaceholderText('marie.durand'), 'mdurand')
    await user.type(screen.getByPlaceholderText('marie.durand@exemple.fr'), 'mdurand@example.com')
    const passwordFields = screen.getAllByPlaceholderText('••••••••')
    await user.type(passwordFields[0], 'secret')
    await user.type(passwordFields[1], 'secret')
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    expect(registerSoc).toHaveBeenCalledWith(expect.objectContaining({
      username: 'mdurand',
      email: 'mdurand@example.com',
      password: 'secret',
    }))
  })
})
