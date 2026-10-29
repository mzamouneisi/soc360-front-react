import { tr } from '../i18n/translate'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { tablesApi, type ColumnDetails, type SqlExecutionResult, type TableRelation } from '../api/tables'
import { useAsync } from '../lib/useAsync'
import { usePagination } from '../lib/usePagination'
import { IconButton, InlineButton, Input, RefreshButton, Textarea } from '../components/ui'
import { EmptyState, ErrorBlock, LoadingBlock, Modal, PageHeader, Pagination } from '../components/data'
import { dialog } from '../components/dialog'
import { RelationsGraph } from '../components/RelationsGraph'

type Tab = 'data' | 'sql' | 'relations'

function cellValue(row: Record<string, unknown>, column: string): unknown {
  if (column in row) return row[column]
  const key = Object.keys(row).find((k) => k.toLowerCase() === column.toLowerCase())
  return key !== undefined ? row[key] : null
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

function inputTypeFor(column: ColumnDetails): string {
  const t = column.dataType.toUpperCase()
  if (t.includes('TIMESTAMP')) return 'datetime-local'
  if (t.includes('DATE')) return 'date'
  if (t.includes('BOOL')) return 'checkbox'
  if (
    t.includes('INT') ||
    t.includes('NUMERIC') ||
    t.includes('DECIMAL') ||
    t.includes('REAL') ||
    t.includes('DOUBLE') ||
    t.includes('FLOAT') ||
    t.includes('SERIAL')
  ) {
    return 'number'
  }
  return 'text'
}

function formatInputValue(column: ColumnDetails, value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  const t = column.dataType.toUpperCase()
  if (t.includes('TIMESTAMP')) {
    const match = s.match(/(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/)
    return match ? `${match[1]}T${match[2]}` : s
  }
  if (t.includes('DATE')) return s.substring(0, 10)
  return s
}

function formatSqlValue(column: ColumnDetails, value: unknown): string {
  if (value === null || value === undefined || String(value).toUpperCase() === 'NULL') return 'NULL'
  const t = column.dataType.toUpperCase()
  if (t.includes('BOOL')) {
    return value === true || value === 1 || value === 'true' || value === '1' ? 'true' : 'false'
  }
  if (
    t.includes('INT') ||
    t.includes('NUMERIC') ||
    t.includes('DECIMAL') ||
    t.includes('REAL') ||
    t.includes('DOUBLE') ||
    t.includes('FLOAT') ||
    t.includes('SERIAL')
  ) {
    return String(value).trim() === '' ? 'NULL' : String(value)
  }
  return `'${String(value).replace(/'/g, "''")}'`
}

function idKeyOf(columns: ColumnDetails[]): string | null {
  return columns.find((c) => c.columnName.toUpperCase() === 'ID')?.columnName ?? null
}

function sqlResultMessage(result: SqlExecutionResult): string {
  const count = result.affectedRows ?? 0
  switch (result.command) {
    case 'INSERT':
      return tr('Tables.lignes.inserees', { count })
    case 'UPDATE':
      return tr('Tables.lignes.mises.a.jour', { count })
    case 'DELETE':
      return tr('Tables.lignes.supprimees', { count })
    default:
      return tr('Tables.commande.executee')
  }
}

export function Tables() {
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      navigate('/', { replace: true })
    }
  }, [user, navigate])

  const [tables, setTables] = useState<string[]>([])
  const [selected, setSelected] = useState('')
  const [search, setSearch] = useState('')
  const [leftPercent, setLeftPercent] = useState(20)
  const [leftVisible, setLeftVisible] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [columns, setColumns] = useState<ColumnDetails[]>([])
  const [tab, setTab] = useState<Tab>('data')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)

  const [sql, setSql] = useState('')
  const [sqlResult, setSqlResult] = useState<SqlExecutionResult | null>(null)
  const [sqlError, setSqlError] = useState<string | null>(null)
  const [sqlLoading, setSqlLoading] = useState(false)

  const [draft, setDraft] = useState<Record<string, unknown> | null>(null)
  const [inserting, setInserting] = useState(false)
  const [saving, setSaving] = useState(false)

  const relations = useAsync<TableRelation[]>(() => tablesApi.getRelations(), [])

  const loadTables = useCallback(async () => {
    try {
      setError(null)
      setTables(await tablesApi.list())
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('common.unexpectedError'))
    }
  }, [])

  const loadTable = useCallback(async (name: string) => {
    setLoading(true)
    setError(null)
    setRows([])
    setColumns([])
    setSqlResult(null)
    setSqlError(null)
    setSql(`SELECT * FROM ${name};`)
    setTab('data')
    setPage(0)
    try {
      const [lineRows, lineColumns] = await Promise.all([
        tablesApi.getLines(name),
        tablesApi.getColumns(name),
      ])
      setRows(lineRows)
      setColumns(lineColumns)
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('common.unexpectedError'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTables()
  }, [loadTables])

  const idKey = useMemo(() => idKeyOf(columns), [columns])
  const idColumn = useMemo(
    () => columns.find((c) => c.columnName === idKey) ?? null,
    [columns, idKey],
  )

  const pageSize = user?.pageSize ?? 5
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const safePage = Math.min(page, totalPages - 1)
  const pagedRows = rows.slice(safePage * pageSize, safePage * pageSize + pageSize)
  const sqlRows = sqlResult?.rows ?? []
  const sqlPage = usePagination(sqlRows, pageSize)
  const sqlColumns = sqlRows.length > 0 ? Object.keys(sqlRows[0]) : []

  const filteredTables = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return tables
    return tables.filter((name) => name.toLowerCase().includes(query))
  }, [tables, search])

  const selectTable = (name: string) => {
    setSelected(name)
    if (name) void loadTable(name)
  }

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const container = containerRef.current
    if (!container) return
    event.preventDefault()
    const rect = container.getBoundingClientRect()
    const move = (moveEvent: PointerEvent) => {
      const percent = ((moveEvent.clientX - rect.left) / rect.width) * 100
      setLeftPercent(Math.min(45, Math.max(12, percent)))
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  const openInsert = () => {
    if (!columns.length) return
    const empty: Record<string, unknown> = {}
    columns.forEach((c) => {
      empty[c.columnName] = null
    })
    setDraft(empty)
    setInserting(true)
  }

  const runSql = async () => {
    if (!sql.trim()) return
    setSqlLoading(true)
    setSqlError(null)
    setSqlResult(null)
    try {
      const result = await tablesApi.executeSql(sql)
      setSqlResult(result)
    } catch (err) {
      setSqlError(err instanceof Error ? err.message : tr('common.unexpectedError'))
    } finally {
      setSqlLoading(false)
    }
  }

  const saveRow = async () => {
    if (!selected || !draft || !idKey || !idColumn) return
    setSaving(true)
    setError(null)
    try {
      const idValue = draft[idKey]
      const where =
        idValue === null || idValue === undefined || String(idValue).toUpperCase() === 'NULL'
          ? `${idKey} IS NULL`
          : `${idKey} = ${formatSqlValue(idColumn, idValue)}`
      const setClause = columns
        .filter((c) => c.columnName !== idKey)
        .map((c) => `${c.columnName} = ${formatSqlValue(c, draft[c.columnName])}`)
        .join(', ')
      await tablesApi.executeSql(`UPDATE ${selected} SET ${setClause} WHERE ${where}`)
      setDraft(null)
      await loadTable(selected)
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('common.unexpectedError'))
    } finally {
      setSaving(false)
    }
  }

  const insertRow = async () => {
    if (!selected || !draft) return
    setSaving(true)
    setError(null)
    try {
      const cols = columns.filter((c) => {
        const v = draft[c.columnName]
        return v !== null && v !== undefined && String(v).toUpperCase() !== 'NULL'
      })
      const columnList = cols.map((c) => c.columnName).join(', ')
      const valueList = cols.map((c) => formatSqlValue(c, draft[c.columnName])).join(', ')
      await tablesApi.executeSql(
        `INSERT INTO ${selected} (${columnList}) VALUES (${valueList})`,
      )
      setDraft(null)
      setInserting(false)
      await loadTable(selected)
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('common.unexpectedError'))
    } finally {
      setSaving(false)
    }
  }

  const deleteRow = async (row: Record<string, unknown>) => {
    if (!selected || !idKey || !idColumn) return
    const idValue = cellValue(row, idKey)
    if (!(await dialog.confirm(tr('Tables.supprimer.la.ligne', { key: idKey, value: displayValue(idValue) }), { variant: 'warning', danger: true, okLabel: tr('common.delete') }))) return
    setSaving(true)
    setError(null)
    try {
      const where =
        idValue === null || idValue === undefined || String(idValue).toUpperCase() === 'NULL'
          ? `${idKey} IS NULL`
          : `${idKey} = ${formatSqlValue(idColumn, idValue)}`
      await tablesApi.executeSql(`DELETE FROM ${selected} WHERE ${where}`)
      await loadTable(selected)
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('common.unexpectedError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={tr('Tables.base.de.donnees')}
        titleId="Tables.base.de.donnees"
        subtitle={tr('Tables.gestion.des.tables.de.la.base.administration')}
        subtitleId="Tables.gestion.des.tables.de.la.base.administration"
        actions={<RefreshButton onClick={() => void loadTables()} disabled={loading} />}
      />

      {error && <ErrorBlock message={error} />}

      <div ref={containerRef} className="mt-4 flex min-h-[600px] items-stretch">
        {leftVisible && (
          <>
        <aside
          id="Tables.left.panel"
          className="flex shrink-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
          style={{ width: `${leftPercent}%` }}
        >
          <div className="border-b border-gray-200 px-3 py-3">
            <div className="flex items-start justify-between gap-2">
              <h2 id="Tables.left.title" className="text-sm font-semibold text-gray-900">
                {selected || tr('Tables.base.de.donnees')} ({selected ? rows.length : tables.length})
              </h2>
              <IconButton
                icon="chevronLeft"
                label={tr('Tables.masquer.la.colonne.gauche')}
                variant="neutral"
                onClick={() => setLeftVisible(false)}
                id="Tables.left.toggle"
              />
            </div>
            <Input
              id="Tables.search"
              className="mt-2"
              placeholder={tr('Tables.rechercher.une.table')}
              title={tr('Tables.rechercher.une.table')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <ol
            id="Tables.table.list"
            className="overflow-y-auto py-1"
            style={{ height: '500px' }}
          >
            {filteredTables.map((name) => (
              <li id={`Tables.table.list.${name}`} key={name}>
                <button
                  id={`Tables.table.${name}`}
                  type="button"
                  onClick={() => selectTable(name)}
                  className={`block w-full truncate px-3 py-1.5 text-left text-sm transition ${
                    selected === name
                      ? 'bg-brand-50 font-semibold text-brand-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  title={name}
                >
                  {name}
                </button>
              </li>
            ))}
          </ol>

          {selected && (
            <div className="min-h-0 flex-1 overflow-y-auto border-t border-gray-200 px-3 py-3">
              <h3 id="Tables.structure" className="mb-2 text-sm font-semibold text-gray-900">
                {tr('Tables.structure')}
              </h3>
              <table className="w-full table-fixed text-xs">
                <thead className="text-left text-gray-500">
                  <tr>
                    <th id="Tables.structure.colonne" className="py-1 pr-2 font-semibold">{tr('Tables.colonne')}</th>
                    <th id="Tables.structure.type" className="py-1 pr-2 font-semibold">{tr('Tables.type')}</th>
                    <th id="Tables.structure.taille" className="py-1 pr-2 font-semibold">{tr('Tables.taille')}</th>
                    <th id="Tables.structure.defaut" className="py-1 font-semibold">{tr('Tables.valeur.defaut')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {columns.map((column) => (
                    <tr id={`Tables.structure.row.${column.columnName}`} key={column.columnName}>
                      <td id={`Tables.structure.row.${column.columnName}.name`} className="truncate py-1 pr-2 font-medium text-gray-800" title={column.columnName}>{column.columnName}</td>
                      <td id={`Tables.structure.row.${column.columnName}.type`} className="truncate py-1 pr-2 text-gray-600" title={column.dataType}>{column.dataType}</td>
                      <td id={`Tables.structure.row.${column.columnName}.size`} className="py-1 pr-2 text-gray-600">{column.size ?? '—'}</td>
                      <td id={`Tables.structure.row.${column.columnName}.default`} className="truncate py-1 text-gray-600" title={column.defaultValue ?? ''}>{column.defaultValue ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </aside>

        <div
          id="Tables.resizer"
          role="separator"
          aria-orientation="vertical"
          title={tr('Tables.redimensionner')}
          onPointerDown={startResize}
          className="mx-1 w-1.5 shrink-0 cursor-col-resize rounded bg-gray-200 transition hover:bg-brand-400"
        />
          </>
        )}

        <section className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {!leftVisible && (
                <IconButton
                  icon="chevronRight"
                  label={tr('Tables.afficher.la.colonne.gauche')}
                  variant="neutral"
                  onClick={() => setLeftVisible(true)}
                  id="Tables.left.toggle"
                />
              )}
              {selected && (
                <h2 id="Tables.right.title" className="text-sm font-semibold text-gray-900">
                  {selected} ({rows.length})
                </h2>
              )}
            </div>
            {selected && (
              <div className="flex flex-wrap items-center gap-2">
                <InlineButton variant="soft" onClick={() => void loadTable(selected)} disabled={loading}>
                  {tr('Tables.recharger')}
                </InlineButton>
                <IconButton
                  icon="add"
                  label={tr('Tables.ajouter.une.ligne')}
                  variant="new"
                  onClick={openInsert}
                  disabled={loading || columns.length === 0}
                  id="Tables.ajouter.une.ligne"
                />
              </div>
            )}
          </div>

          {!selected && (
            <EmptyState
              title={tr('Tables.aucune.table.selectionnee')}
              description={tr('Tables.selectionnez.une.table.pour.la.gerer')}
            />
          )}

          {selected && (
            <>

              <div className="mb-4 flex gap-1">
                {(
                  [
                    ['data', tr('Tables.donnees'), 'Tables.tab.data'],
                    ['sql', tr('Tables.sql'), 'Tables.tab.sql'],
                    ['relations', tr('Tables.relations'), 'Tables.tab.relations'],
                  ] as [Tab, string, string][]
                ).map(([value, label, id]) => (
                  <button
                    key={value}
                    id={id}
                    onClick={() => setTab(value)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                      tab === value ? 'text-white hover:brightness-95' : 'bg-white text-gray-700 hover:bg-gray-100'
                    }`}
                    style={tab === value ? { backgroundColor: 'var(--btn-save-color)' } : undefined}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tab === 'data' && (
                <>
                  {loading && <LoadingBlock />}
                  {!loading && rows.length === 0 && (
                    <EmptyState
                      title={tr('Tables.table.vide')}
                      description={tr('Tables.aucune.ligne.dans.cette.table')}
                      action={
                        <IconButton icon="add" label="Ajouter une ligne" variant="new" onClick={openInsert} />
                      }
                    />
                  )}
                  {!loading && rows.length > 0 && (
                    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                          <thead style={{ backgroundColor: 'var(--table-header)' }}>
                            <tr>
                              <th className="w-12 px-3 py-2 text-right text-xs font-bold uppercase tracking-wide text-gray-400">
                                #
                              </th>
                              {columns.map((c) => (
                                <th
                                  key={c.columnName}
                                  className="whitespace-nowrap px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-gray-500"
                                >
                                  {c.columnName}
                                  <span className="ml-1 font-normal normal-case text-gray-400">
                                    {c.dataType}
                                  </span>
                                </th>
                              ))}
                              <th className="px-3 py-2 text-right">{tr('Tables.actions')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {pagedRows.map((row, i) => (
                              <tr
                                key={i}
                                onClick={() => {
                                  setInserting(false)
                                  setDraft({ ...row })
                                }}
                                className="cursor-pointer even:bg-gray-50 hover:bg-gray-100"
                              >
                                <td className="w-12 whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums text-gray-400">
                                  {safePage * pageSize + i + 1}
                                </td>
                                {columns.map((c) => (
                                  <td
                                    key={c.columnName}
                                    className="max-w-72 truncate px-3 py-2 text-gray-700"
                                    title={displayValue(cellValue(row, c.columnName))}
                                  >
                                    {displayValue(cellValue(row, c.columnName))}
                                  </td>
                                ))}
                                <td className="whitespace-nowrap px-3 py-2 text-right">
                                  <IconButton
                                    icon="edit"
                                    label={tr('Tables.modifier')}
                                    variant="primary"
                                    className="mr-1.5"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setInserting(false)
                                      setDraft({ ...row })
                                    }} id="Tables.modifier" />
                                  <IconButton
                                    icon="delete"
                                    label={tr('Tables.supprimer')}
                                    variant="danger"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      void deleteRow(row)
                                    }} id="Tables.supprimer" />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="px-4 pb-3">
                        <Pagination page={safePage} totalPages={totalPages} total={rows.length} onChange={setPage} />
                      </div>
                    </div>
                  )}
                </>
              )}

              {tab === 'sql' && (
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                      <p id="Tables.console.sql" className="text-sm font-semibold text-gray-900">{tr('Tables.console.sql')}</p>
                      <InlineButton variant="primary" onClick={() => void runSql()} disabled={sqlLoading || !sql.trim()}>
                        {tr('Tables.executer')}
                      </InlineButton>
                    </div>
                    <Textarea
                      id="Tables.sql.textarea"
                      className="min-h-40 rounded-none border-0 bg-gray-50 font-mono text-xs focus:ring-0"
                      placeholder={'SELECT * FROM ' + (selected || 'TABLE') + ' ;'}
                      value={sql}
                      onChange={(e) => setSql(e.target.value)}
                    />
                  </div>
                  {sqlError && <ErrorBlock message={sqlError} />}
                  {sqlLoading && <LoadingBlock />}
                  {!sqlLoading && sqlResult && !sqlResult.query && (
                    <div id="Tables.sql.message" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                      {sqlResultMessage(sqlResult)}
                    </div>
                  )}
                  {!sqlLoading && sqlResult?.query && sqlRows.length > 0 && (
                    <div>
                      <p id="Tables.sql.result.title" className="mb-2 text-sm font-semibold text-gray-900">
                        {tr('Tables.resultat')} ({sqlRows.length})
                      </p>
                      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead style={{ backgroundColor: 'var(--table-header)' }}>
                              <tr>
                                <th className="w-12 px-3 py-2 text-right text-xs font-bold uppercase tracking-wide text-gray-400">
                                  #
                                </th>
                                {sqlColumns.map((col) => (
                                  <th
                                    key={col}
                                    className="whitespace-nowrap px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-gray-500"
                                  >
                                    {col}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {sqlPage.pageItems.map((row, i) => (
                                <tr key={i} className="even:bg-gray-50">
                                  <td className="w-12 whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums text-gray-400">
                                    {sqlPage.offset + i + 1}
                                  </td>
                                  {sqlColumns.map((col) => (
                                    <td
                                      key={col}
                                      className="max-w-72 truncate px-3 py-2 text-gray-700"
                                      title={displayValue(row[col])}
                                    >
                                      {displayValue(row[col])}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="px-4 pb-3">
                          <Pagination page={sqlPage.page} totalPages={sqlPage.totalPages} total={sqlPage.total} onChange={sqlPage.setPage} />
                        </div>
                      </div>
                    </div>
                  )}
                  {!sqlLoading && sqlResult?.query && sqlRows.length === 0 && (
                    <EmptyState title={tr('Tables.aucun.resultat')} description={tr('Tables.requete.executee.avec.succes')} />
                  )}
                </div>
              )}

              {tab === 'relations' && (
                <>
                  {relations.loading && <LoadingBlock />}
                  {relations.error && <ErrorBlock message={relations.error} />}
                  {!relations.loading && !relations.error && (
                    <>
                      {relations.data && relations.data.length === 0 && (
                        <EmptyState title={tr('Tables.aucune.relation')} description={tr('Tables.aucune.cle.etrangere.detectee')} />
                      )}
                      {relations.data && relations.data.length > 0 && (
                        <RelationsGraph relations={relations.data} focusedTable={selected} />
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </section>
      </div>

      {!selected && !loading && tables.length === 0 && (
        <EmptyState title={tr('Tables.aucune.table')} description={tr('Tables.selectionnez.une.table.pour.la.gerer')} />
      )}

      {draft && (
        <Modal
          open
          title={inserting ? `Ajouter une ligne — ${selected}` : `Modifier la ligne — ${selected}`}
          onClose={() => {
            if (!saving) setDraft(null)
          }}
          size="lg"
          footer={
            <>
              <IconButton
                icon="cancel"
                label="Annuler"
                onClick={() => setDraft(null)}
                disabled={saving}
              />
              <IconButton
                icon="save"
                label="Enregistrer"
                variant="primary"
                onClick={inserting ? insertRow : saveRow}
                disabled={saving}
                loading={saving}
              />
            </>
          }
        >
          <div className="grid max-h-96 grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2">
            {columns.map((c) => {
              const type = inputTypeFor(c)
              const value = draft[c.columnName]
              return (
                <div key={c.columnName}>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {c.columnName}
                    <span className="ml-1 font-normal text-gray-400">{c.dataType}</span>
                  </label>
                  {type === 'checkbox' ? (
                    <input
                      type="checkbox"
                      checked={Boolean(value)}
                      onChange={(e) =>
                        setDraft((d) => (d ? { ...d, [c.columnName]: e.target.checked } : d))
                      }
                      className="h-4 w-4 rounded border-gray-300 text-brand-600"
                    />
                  ) : (
                    <Input
                      type={type}
                      value={formatInputValue(c, value)}
                      onChange={(e) =>
                        setDraft((d) => (d ? { ...d, [c.columnName]: e.target.value } : d))
                      }
                    />
                  )}
                </div>
              )
            })}
          </div>
        </Modal>
      )}
    </div>
  )
}
