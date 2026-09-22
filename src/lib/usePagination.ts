import { useMemo, useState } from 'react'

export function usePagination<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(0)
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(page, totalPages - 1)
  const offset = safePage * pageSize
  const pageItems = useMemo(
    () => items.slice(offset, offset + pageSize),
    [items, offset, pageSize],
  )
  return { page: safePage, setPage, totalPages, pageItems, total: items.length, offset }
}
