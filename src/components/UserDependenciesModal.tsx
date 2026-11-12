import { useEffect, useState } from 'react'
import { tr } from '../i18n/translate'
import { consultantsApi, type ConsultantDependency } from '../api/consultants'
import { ApiError } from '../api/client'
import { Button, IconButton } from './ui'
import { LoadingBlock, Modal } from './data'
import { dialog } from './dialog'

export interface UserRef {
  id: number
  firstName?: string | null
  lastName?: string | null
  username?: string | null
}

const DEPENDENCY_LABEL_KEYS: Record<string, string> = {
  timesheet: 'Consultants.dep.cra',
  expense_report: 'Consultants.dep.note.frais',
  payslip: 'Consultants.dep.fiche.paie',
  activity: 'Consultants.dep.activite',
  unavailability: 'Consultants.dep.indisponibilite',
  hr_document: 'Consultants.dep.document',
  leave_lot: 'Consultants.dep.solde.conges',
  leave_movement: 'Consultants.dep.mouvement.conges',
  billing_document: 'Consultants.dep.document.facturation',
}

interface DependencyTreeNodeData {
  id: string
  label: string
  depth: number
  item?: ConsultantDependency
  children?: DependencyTreeNodeData[]
}

function DependencyTreeNode({
  node,
  onDelete,
  disabled,
}: {
  node: DependencyTreeNodeData
  onDelete: (item: ConsultantDependency) => void
  disabled: boolean
}) {
  const [open, setOpen] = useState(true)
  const hasChildren = (node.children?.length ?? 0) > 0
  return (
    <li id={`Consultants.dependances.node.${node.id}`} className="list-none">
      <div
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50"
        style={{ paddingLeft: `${8 + node.depth * 20}px` }}
      >
        {hasChildren ? (
          <button
            id={`Consultants.dependances.node.${node.id}.toggle`}
            type="button"
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-500 hover:bg-gray-200"
            aria-expanded={open}
            aria-label={open ? tr('Consultants.dependances.reduire') : tr('Consultants.dependances.developper')}
            onClick={() => setOpen((v) => !v)}
          >
            <span className={open ? 'rotate-90' : ''}>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8.59 16.59 10 18l6-6-6-6-1.41 1.41L13.17 12l-4.58 4.59Z" />
              </svg>
            </span>
          </button>
        ) : (
          <span className="h-5 w-5 shrink-0" aria-hidden="true" />
        )}
        <span
          id={`Consultants.dependances.node.${node.id}.label`}
          className={hasChildren ? 'truncate text-sm font-medium text-gray-800' : 'truncate text-sm text-gray-700'}
        >
          {node.label}
        </span>
        {node.item && (
          <span id={`Consultants.dependances.node.${node.id}.type`} className="ml-auto shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            {tr(DEPENDENCY_LABEL_KEYS[node.item.type] ?? node.item.type)}
          </span>
        )}
        {node.item && (
          <IconButton
            icon="delete"
            label={tr('common.delete')}
            variant="danger"
            onClick={() => onDelete(node.item!)}
            disabled={disabled}
            id={`Consultants.dependances.${node.item.type}.${node.item.id}.delete`}
          />
        )}
      </div>
      {hasChildren && open && (
        <ul className="space-y-0.5">
          {node.children!.map((child) => (
            <DependencyTreeNode key={child.id} node={child} onDelete={onDelete} disabled={disabled} />
          ))}
        </ul>
      )}
    </li>
  )
}

function userLabel(user: UserRef): string {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  return fullName || user.username || `#${user.id}`
}

export function UserDependenciesModal({
  user,
  onClose,
  onDeleted,
}: {
  user: UserRef | null
  onClose: () => void
  onDeleted: () => void
}) {
  const [dependencies, setDependencies] = useState<ConsultantDependency[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const userId = user?.id

  useEffect(() => {
    if (userId == null) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setDependencies([])
    consultantsApi
      .dependencies(userId)
      .then((items) => {
        if (!cancelled) setDependencies(items)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : tr('Consultants.suppression.impossible'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const dependencyTree: DependencyTreeNodeData[] = (() => {
    const groups = new Map<string, ConsultantDependency[]>()
    for (const item of dependencies) {
      const list = groups.get(item.type) ?? []
      list.push(item)
      groups.set(item.type, list)
    }
    return Array.from(groups.entries()).map(([type, items]) => ({
      id: `groupe.${type}`,
      label: `${tr(DEPENDENCY_LABEL_KEYS[type] ?? type)} (${items.length})`,
      depth: 0,
      children: items.map((item) => ({
        id: `${item.type}.${item.id}`,
        label: item.label,
        depth: 1,
        item,
      })),
    }))
  })()

  async function handleDeleteDependency(item: ConsultantDependency) {
    if (userId == null) return
    if (!(await dialog.confirm(tr('Consultants.supprimer.objet.confirmation', { label: item.label }), {
      variant: 'warning',
      danger: true,
      okLabel: tr('common.delete'),
    }))) return
    setLoading(true)
    setError(null)
    try {
      await consultantsApi.deleteDependency(userId, item.type, item.id)
      setDependencies(await consultantsApi.dependencies(userId))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tr('Consultants.suppression.impossible'))
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteAllDependencies() {
    if (!user || dependencies.length === 0) return
    if (!(await dialog.confirm(
      tr('Consultants.dependances.tout.supprimer.confirmation', { name: userLabel(user) }),
      { variant: 'warning', danger: true, okLabel: tr('common.delete') },
    ))) return
    setLoading(true)
    setError(null)
    try {
      await consultantsApi.deleteAllDependencies(user.id)
      setDependencies(await consultantsApi.dependencies(user.id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tr('Consultants.suppression.impossible'))
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteUser() {
    if (!user || dependencies.length > 0) return
    if (!(await dialog.confirm(tr('Consultants.supprimer.le.collaborateur', { name: userLabel(user) }), {
      variant: 'warning',
      danger: true,
      okLabel: tr('common.delete'),
    }))) return
    setLoading(true)
    setError(null)
    try {
      await consultantsApi.delete(user.id)
      onDeleted()
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tr('Consultants.suppression.impossible'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={user != null}
      onClose={onClose}
      titleId="Consultants.dependances.title"
      title={user
        ? tr('Consultants.dependances.title', { name: userLabel(user) })
        : tr('Consultants.dependances.title')}
      footer={
        <>
          <IconButton icon="close" label={tr('common.close')} type="button" onClick={onClose} disabled={loading} id="Consultants.dependances.close" />
          <Button
            id="Consultants.dependances.tout.supprimer"
            type="button"
            variant="danger"
            className="!w-auto"
            onClick={() => void handleDeleteAllDependencies()}
            disabled={loading || dependencies.length === 0}
          >
            {tr('Consultants.dependances.tout.supprimer')}
          </Button>
          <Button
            id="Consultants.dependances.supprimer.utilisateur"
            type="button"
            variant="danger"
            className="!w-auto"
            onClick={() => void handleDeleteUser()}
            disabled={loading || dependencies.length > 0}
          >
            {tr('Consultants.supprimer.l.utilisateur')}
          </Button>
        </>
      }
    >
      {error && (
        <div id="Consultants.dependances.error" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {dependencies.length > 0 && (
        <div id="Consultants.dependances.avertissement" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {tr('Consultants.dependances.description')}
        </div>
      )}
      <p id="Consultants.dependances.count" className="mt-3 text-sm font-medium text-gray-700">
        {tr('Consultants.dependances.count', { count: dependencies.length })}
      </p>
      {loading && <LoadingBlock />}
      {!loading && dependencies.length === 0 && (
        <p id="Consultants.dependances.empty" className="mt-2 text-sm text-green-700">
          {tr('Consultants.dependances.empty')}
        </p>
      )}
      {!loading && dependencies.length > 0 && (
        <div
          id="Consultants.dependances.tree"
          role="tree"
          className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-gray-200 p-2"
        >
          <ul className="space-y-0.5">
            {dependencyTree.map((node) => (
              <DependencyTreeNode
                key={node.id}
                node={node}
                onDelete={(item) => void handleDeleteDependency(item)}
                disabled={loading}
              />
            ))}
          </ul>
        </div>
      )}
    </Modal>
  )
}
