import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import {
  Badge,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  Modal,
  PageHeader,
  Pagination,
  Table,
} from './data'

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    initializing: false,
    login: vi.fn(),
    logout: vi.fn(),
    setUser: vi.fn(),
    refreshMe: vi.fn(),
  }),
}))

describe('Badge', () => {
  it('affiche le contenu avec la classe de la variante', () => {
    const { container } = render(<Badge kind="success">Actif</Badge>)
    expect(screen.getByText('Actif')).toHaveClass('bg-green-100', 'text-green-800')
    expect(container.firstChild).toHaveClass('rounded-full')
  })
})

describe('PageHeader', () => {
  it('affiche titre et sous-titre', () => {
    render(<PageHeader title="Clients" subtitle="Liste des clients" />)
    expect(screen.getByText('Clients')).toBeInTheDocument()
    expect(screen.getByText('Liste des clients')).toBeInTheDocument()
  })

  it('affiche les actions', () => {
    render(<PageHeader title="Clients" actions={<button>Exporter</button>} />)
    expect(screen.getByRole('button', { name: 'Exporter' })).toBeInTheDocument()
  })
})

describe('EmptyState', () => {
  it('affiche titre, description et action', () => {
    render(
      <EmptyState
        title="Vide"
        description="Rien ici"
        action={<button>Créer</button>}
      />,
    )
    expect(screen.getByText('Vide')).toBeInTheDocument()
    expect(screen.getByText('Rien ici')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Créer' })).toBeInTheDocument()
  })
})

describe('ErrorBlock', () => {
  it('affiche le message d’erreur', () => {
    render(<ErrorBlock message="Échec du chargement" />)
    expect(screen.getByText('Échec du chargement')).toBeInTheDocument()
  })
})

describe('LoadingBlock', () => {
  it('affiche un spinner', () => {
    const { container } = render(<LoadingBlock />)
    expect(container.querySelector('.animate-spin')).not.toBeNull()
  })
})

interface Row {
  id: number
  name: string
}

const columns = [{ key: 'name', label: 'Nom', render: (r: Row) => r.name }]
const rows: Row[] = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
]

describe('Table', () => {
  it('affiche l’en-tête et les lignes', () => {
    render(<Table rowKey={(r) => r.id} rows={rows} columns={columns} />)
    expect(screen.getByText('Nom')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('déclenche onRowClick au clic sur une ligne', () => {
    const onRowClick = vi.fn()
    render(<Table rowKey={(r) => r.id} rows={rows} columns={columns} onRowClick={onRowClick} />)

    fireEvent.click(screen.getByText('Alice'))
    expect(onRowClick).toHaveBeenCalledWith(rows[0])
  })

  it('affiche un état vide par défaut', () => {
    render(<Table rowKey={(r) => r.id} rows={[]} columns={columns} />)
    expect(screen.getByText('Aucun élément')).toBeInTheDocument()
  })

  it('affiche le contenu custom empty s’il est fourni', () => {
    render(
      <Table rowKey={(r) => r.id} rows={[]} columns={columns} empty={<p>Aucune donnée custom</p>} />,
    )
    expect(screen.getByText('Aucune donnée custom')).toBeInTheDocument()
  })

  it('affiche un bloc de chargement quand loading', () => {
    const { container } = render(<Table rowKey={(r) => r.id} rows={rows} columns={columns} loading />)
    expect(container.querySelector('.animate-spin')).not.toBeNull()
  })
})

describe('Pagination', () => {
  it('ne rend rien pour une seule page', () => {
    const { container } = render(<Pagination page={0} totalPages={1} onChange={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('affiche la page courante et le total', () => {
    render(<Pagination page={0} totalPages={3} total={12} onChange={vi.fn()} />)
    expect(screen.getByText('Page 1 / 3')).toBeInTheDocument()
    expect(screen.getByText('12 éléments')).toBeInTheDocument()
  })

  it('désactive Précédent sur la première page', () => {
    render(<Pagination page={0} totalPages={3} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Précédent' })).toBeDisabled()
  })

  it('désactive Suivant sur la dernière page', () => {
    render(<Pagination page={2} totalPages={3} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Suivant' })).toBeDisabled()
  })

  it('navigue avec les boutons', () => {
    const onChange = vi.fn()
    render(<Pagination page={0} totalPages={3} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Suivant' }))
    expect(onChange).toHaveBeenCalledWith(1)
  })

  it('préfixe les ids pour plusieurs paginations sur une page', () => {
    render(<Pagination page={0} totalPages={3} onChange={vi.fn()} idPrefix="LeaveBalances.CP.lots" />)
    expect(document.getElementById('LeaveBalances.CP.lots.previous')).toBeInTheDocument()
    expect(document.getElementById('LeaveBalances.CP.lots.page')).toHaveTextContent('Page 1 / 3')
    expect(document.getElementById('LeaveBalances.CP.lots.next')).toBeInTheDocument()
  })
})

describe('Modal', () => {
  it('ne rend rien quand fermé', () => {
    const { container } = render(
      <Modal open={false} title="Titre" onClose={vi.fn()}>
        Contenu
      </Modal>,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('affiche titre, contenu et boutons de pied de page', () => {
    render(
      <Modal
        open
        title="Nouveau client"
        onClose={vi.fn()}
        footer={<button>Valider</button>}
      >
        Corps du formulaire
      </Modal>,
    )
    expect(screen.getByText('Nouveau client')).toBeInTheDocument()
    expect(screen.getByText('Corps du formulaire')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Valider' })).toBeInTheDocument()
  })

  it('se ferme avec la touche Échap', () => {
    const onClose = vi.fn()
    render(
      <Modal open title="Titre" onClose={onClose}>
        Contenu
      </Modal>,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
