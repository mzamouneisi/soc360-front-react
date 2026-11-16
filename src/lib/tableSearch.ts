import { useMemo, useState } from 'react'

function collectText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) return value.map(collectText).join(' ')
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).map(collectText).join(' ')
  }
  return ''
}

export function searchableText(value: unknown): string {
  return collectText(value).replace(/\s+/g, ' ').trim()
}

export function rowSearchText(row: unknown): string {
  return searchableText(row)
}

export function filterRows<T>(rows: T[], query: string, text: (row: T) => string): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return rows
  return rows.filter((row) => text(row).toLowerCase().includes(q))
}

export function useTableSearch<T>(
  rows: T[],
  text: (row: T) => string = (row) => rowSearchText(row),
) {
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => filterRows(rows, search, text), [rows, search, text])
  return { search, setSearch, filtered, searching: search.trim() !== '' }
}
