import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import {
  Alert,
  Button,
  Card,
  Field,
  FullPageSpinner,
  InlineButton,
  Input,
  Select,
  Spinner,
  Textarea,
} from './ui'

describe('Spinner', () => {
  it('affiche un élément avec animation', () => {
    const { container } = render(<Spinner />)
    const el = container.querySelector('span')
    expect(el).toHaveClass('animate-spin')
  })
})

describe('FullPageSpinner', () => {
  it('affiche le texte de chargement', () => {
    render(<FullPageSpinner />)
    expect(screen.getByText('Chargement…')).toBeInTheDocument()
  })
})

describe('Input', () => {
  it('transmet les propriétés et le changement', () => {
    const onChange = vi.fn()
    render(<Input placeholder="Nom" value="Jean" onChange={onChange} />)

    const input = screen.getByPlaceholderText('Nom')
    expect(input).toHaveValue('Jean')

    fireEvent.change(input, { target: { value: 'Paul' } })
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('peut être désactivé', () => {
    render(<Input disabled />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })
})

describe('Button', () => {
  it('affiche les enfants et gère le clic', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Créer</Button>)

    const button = screen.getByRole('button', { name: 'Créer' })
    expect(button).toHaveClass('w-auto')
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('est désactivé quand disabled est vrai', () => {
    render(<Button disabled>OK</Button>)
    expect(screen.getByRole('button', { name: 'OK' })).toBeDisabled()
  })
})

describe('InlineButton', () => {
  it('affiche les enfants et le clic', () => {
    const onClick = vi.fn()
    render(<InlineButton onClick={onClick}>Annuler</InlineButton>)

    const button = screen.getByRole('button', { name: 'Annuler' })
    expect(button).toHaveClass('border-gray-300')
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('Alert', () => {
  it('utilise role alert pour le variant error', () => {
    render(<Alert variant="error">Erreur fatale</Alert>)
    expect(screen.getByRole('alert')).toHaveTextContent('Erreur fatale')
  })

  it('utilise role status pour les variants success et info', () => {
    render(<Alert variant="success">Succès</Alert>)
    render(<Alert variant="info">Info</Alert>)
    expect(screen.getAllByRole('status')).toHaveLength(2)
  })
})

describe('Card', () => {
  it('affiche son contenu', () => {
    render(<Card>Contenu de la carte</Card>)
    expect(screen.getByText('Contenu de la carte')).toBeInTheDocument()
  })
})

describe('Field', () => {
  it('affiche le label et les enfants', () => {
    render(
      <Field label="Nom">
        <Input />
      </Field>,
    )
    expect(screen.getByText('Nom')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('affiche le message d’erreur', () => {
    render(
      <Field label="Nom" error="Champ obligatoire">
        <Input />
      </Field>,
    )
    expect(screen.getByText('Champ obligatoire')).toBeInTheDocument()
  })
})

describe('Select', () => {
  it('affiche les options', () => {
    render(
      <Select value="1" onChange={() => {}}>
        <option value="1">Un</option>
        <option value="2">Deux</option>
      </Select>,
    )
    expect(screen.getByRole('combobox')).toHaveValue('1')
    expect(screen.getByText('Deux')).toBeInTheDocument()
  })
})

describe('Textarea', () => {
  it('transmet la valeur', () => {
    render(<Textarea value="message" readOnly />)
    expect(screen.getByRole('textbox')).toHaveValue('message')
  })
})
