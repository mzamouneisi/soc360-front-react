import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Tables } from './Tables'
import type { UserDto } from '../api/types'

const { listMock, getLinesMock, getColumnsMock, executeSqlMock, getRelationsMock, userMock } =
  vi.hoisted(() => ({
    listMock: vi.fn(),
    getLinesMock: vi.fn(),
    getColumnsMock: vi.fn(),
    executeSqlMock: vi.fn(),
    getRelationsMock: vi.fn(),
    userMock: { value: null as unknown as UserDto },
  }))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: userMock.value,
    initializing: false,
    login: vi.fn(),
    logout: vi.fn(),
    setUser: vi.fn(),
    refreshMe: vi.fn(),
  }),
}))

vi.mock('../api/tables', () => ({
  tablesApi: {
    list: listMock,
    getLines: getLinesMock,
    getColumns: getColumnsMock,
    executeSql: executeSqlMock,
    getRelations: getRelationsMock,
  },
}))

const adminUser = {
  id: 1,
  username: 'admin',
  email: 'admin@soc.fr',
  firstName: 'Ad',
  lastName: 'Min',
  phone: null,
  role: 'ADMIN',
  active: true,
  socId: 5,
  socName: 'SOC Test',
  consultantId: null,
  mustChangePassword: false,
  lastLoginAt: null,
  pageSize: 5,
} as UserDto

afterEach(() => {
  vi.clearAllMocks()
  userMock.value = null as unknown as UserDto
})

function renderPage() {
  return render(
    <MemoryRouter>
      <Tables />
    </MemoryRouter>,
  )
}

describe('Tables', () => {
  it('affiche la liste recherchable et la structure de la table sélectionnée', async () => {
    userMock.value = adminUser
    listMock.mockResolvedValue(['company', 'user_account'])
    getRelationsMock.mockResolvedValue([])
    getLinesMock.mockResolvedValue([{ ID: 1, NAME: 'Acme' }])
    getColumnsMock.mockResolvedValue([
      { columnName: 'ID', dataType: 'BIGINT', nullable: false, size: 19, defaultValue: '0' },
      { columnName: 'NAME', dataType: 'VARCHAR', nullable: false, size: 255, defaultValue: null },
    ])

    renderPage()

    expect(await screen.findByRole('button', { name: 'company' })).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('Rechercher une table'), {
      target: { value: 'user' },
    })
    expect(screen.queryByRole('button', { name: 'company' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'user_account' })).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Rechercher une table'), {
      target: { value: '' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'company' }))

    await waitFor(() =>
      expect(document.getElementById('Tables.left.title')?.textContent).toBe('company (1)'),
    )
    expect(getLinesMock).toHaveBeenCalledWith('company')
    expect(getColumnsMock).toHaveBeenCalledWith('company')
    expect(await screen.findByText('Structure de la table')).toBeInTheDocument()
    expect(document.getElementById('Tables.structure.row.NAME.type')?.textContent).toBe('VARCHAR')
    expect(document.getElementById('Tables.structure.row.NAME.size')?.textContent).toBe('255')
  })

  it('ouvre la ligne dans une popup au clic', async () => {
    userMock.value = adminUser
    listMock.mockResolvedValue(['company'])
    getRelationsMock.mockResolvedValue([])
    getLinesMock.mockResolvedValue([{ ID: 1, NAME: 'Acme' }])
    getColumnsMock.mockResolvedValue([
      { columnName: 'ID', dataType: 'BIGINT', nullable: false, size: 19, defaultValue: null },
      { columnName: 'NAME', dataType: 'VARCHAR', nullable: false, size: 255, defaultValue: null },
    ])

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'company' }))
    fireEvent.click(await screen.findByText('Acme'))

    expect(await screen.findByText('Modifier la ligne — company')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('affiche ou masque la colonne gauche', async () => {
    userMock.value = adminUser
    listMock.mockResolvedValue(['company'])
    getRelationsMock.mockResolvedValue([])

    renderPage()

    await screen.findByRole('button', { name: 'company' })
    expect(document.getElementById('Tables.left.panel')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Masquer la colonne des tables' }))
    expect(document.getElementById('Tables.left.panel')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Afficher la colonne des tables' }))
    expect(document.getElementById('Tables.left.panel')).not.toBeNull()
  })

  it('pré-remplit la console SQL et affiche le nombre de lignes affectées', async () => {
    userMock.value = adminUser
    listMock.mockResolvedValue(['company'])
    getRelationsMock.mockResolvedValue([])
    getLinesMock.mockResolvedValue([{ ID: 1 }])
    getColumnsMock.mockResolvedValue([
      { columnName: 'ID', dataType: 'BIGINT', nullable: false, size: 19, defaultValue: null },
    ])
    executeSqlMock.mockResolvedValue({
      query: false,
      rows: [],
      affectedRows: 3,
      command: 'UPDATE',
    })

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'company' }))
    fireEvent.click(await screen.findByRole('button', { name: 'SQL' }))

    const consoleInput = screen.getByDisplayValue('SELECT * FROM company;')
    fireEvent.change(consoleInput, { target: { value: "UPDATE company SET name = 'x';" } })
    fireEvent.click(screen.getByRole('button', { name: 'Exécuter' }))

    await waitFor(() =>
      expect(executeSqlMock).toHaveBeenCalledWith("UPDATE company SET name = 'x';"),
    )
    expect(await screen.findByText('3 ligne(s) mise(s) à jour')).toBeInTheDocument()
  })
})
