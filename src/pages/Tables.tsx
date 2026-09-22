import { tr } from '../i18n/translate'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { tablesApi, type ColumnDetails, type TableRelation } from '../api/tables'
import { useAsync } from '../lib/useAsync'
import { Button, InlineButton, Input, Select, Textarea } from '../components/ui'
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
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [columns, setColumns] = useState<ColumnDetails[]>([])
  const [tab, setTab] = useState<Tab>('data')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)

  const [sql, setSql] = useState('')
  const [sqlResult, setSqlResult] = useState<Record<string, unknown>[] | null>(null)
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
      setError(err instanceof Error ? err.message : 'Erreur inattendue')
    }
  }, [])

  const loadTable = useCallback(async (name: string) => {
    setLoading(true)
    setError(null)
    setRows([])
    setColumns([])
    setSqlResult(null)
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
      setError(err instanceof Error ? err.message : 'Erreur inattendue')
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

  const selectTable = (name: string) => {
    setSelected(name)
    if (name) loadTable(name)
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
    try {
      const result = await tablesApi.executeSql(sql)
      setSqlResult(result)
      if (selected) loadTable(selected)
    } catch (err) {
      setSqlError(err instanceof Error ? err.message : 'Erreur inattendue')
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
      setError(err instanceof Error ? err.message : 'Erreur inattendue')
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
      setError(err instanceof Error ? err.message : 'Erreur inattendue')
    } finally {
      setSaving(false)
    }
  }

  const deleteRow = async (row: Record<string, unknown>) => {
    if (!selected || !idKey || !idColumn) return
    const idValue = cellValue(row, idKey)
    if (!(await dialog.confirm(`Supprimer la ligne ${idKey} = ${displayValue(idValue)} ?`, { variant: 'warning', danger: true, okLabel: 'Supprimer' }))) return
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
      setError(err instanceof Error ? err.message : 'Erreur inattendue')
    } finally {
      setSaving(false)
    }
  }

  const sqlColumns = sqlResult && sqlResult.length > 0 ? Object.keys(sqlResult[0]) : []

  return (
    <div>
      <PageHeader
        title={tr('Tables.base.de.donnees')}
        subtitle={tr('Tables.gestion.des.tables.de.la.base.administration')}
        actions={
          <InlineButton variant="primary" onClick={() => loadTables()} disabled={loading}>
            Actualiser
          </InlineButton>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          className="w-auto min-w-56"
          value={selected}
          onChange={(e) => selectTable(e.target.value)}
        >
          <option value="">{tr('Tables.selectionner.une.table')}</option>
          {tables.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        {selected && (
          <>
            <InlineButton variant="soft" onClick={() => loadTable(selected)} disabled={loading}>
              {tr('Tables.recharger')}
            </InlineButton>
            <InlineButton variant="primary" onClick={openInsert} disabled={loading || columns.length === 0}>
              {tr('Tables.ajouter.une.ligne')}
            </InlineButton>
          </>
        )}
      </div>

      {error && <ErrorBlock message={error} />}

      {selected && (
        <div className="mb-4 flex gap-1">
          {(
            [
              ['data', 'Données'],
              ['sql', 'SQL'],
              ['relations', 'Relations'],
            ] as [Tab, string][]
          ).map(([value, label]) => (
            <button
              key={value}
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
      )}

      {selected && tab === 'data' && (
        <>
          {loading && <LoadingBlock />}
          {!loading && rows.length === 0 && (
            <EmptyState
              title={tr('Tables.table.vide')}
              description={tr('Tables.aucune.ligne.dans.cette.table')}
              action={
                <InlineButton variant="primary" onClick={openInsert}>Ajouter une ligne</InlineButton>
              }
            />
          )}
          {!loading && rows.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead style={{ backgroundColor: 'var(--table-header)' }}>
                    <tr>
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
                      <tr key={i} className="even:bg-gray-50 hover:bg-gray-100">
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
                          <InlineButton
                            variant="primary"
                            className="mr-1.5"
                            onClick={() => {
                              setInserting(false)
                              setDraft({ ...row })
                            }}
                          >
                            {tr('Tables.modifier')}
                          </InlineButton>
                          <InlineButton variant="danger" onClick={() => deleteRow(row)}>{tr('Tables.supprimer')}</InlineButton>
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

      {selected && tab === 'sql' && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <p className="text-sm font-semibold text-gray-900">{tr('Tables.console.sql')}</p>
              <InlineButton variant="primary" onClick={runSql} disabled={sqlLoading || !sql.trim()}>
                {tr('Tables.executer')}
              </InlineButton>
            </div>
            <Textarea
              className="min-h-40 rounded-none border-0 bg-gray-50 font-mono text-xs focus:ring-0"
              placeholder={'SELECT * FROM ' + (selected || 'TABLE') + ' ;'}
              value={sql}
              onChange={(e) => setSql(e.target.value)}
            />
          </div>
          {sqlError && <ErrorBlock message={sqlError} />}
          {sqlLoading && <LoadingBlock />}
          {!sqlLoading && sqlResult && sqlResult.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead style={{ backgroundColor: 'var(--table-header)' }}>
                  <tr>
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
                  {sqlResult.map((row, i) => (
                    <tr key={i} className="even:bg-gray-50">
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
          )}
          {!sqlLoading && sqlResult && sqlResult.length === 0 && (
            <EmptyState title={tr('Tables.aucun.resultat')} description={tr('Tables.requete.executee.avec.succes')} />
          )}
        </div>
      )}

      {selected && tab === 'relations' && (
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
              <InlineButton
                onClick={() => setDraft(null)}
                disabled={saving}
              >
                Annuler
              </InlineButton>
              <Button
                className="w-auto"
                onClick={inserting ? insertRow : saveRow}
                disabled={saving}
              >
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
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
