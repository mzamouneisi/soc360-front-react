import { tr } from '../i18n/translate'
import { useEffect, useState } from 'react'
import { ApiError } from '../api/client'
import { crasApi } from '../api/cras'
import type { CraDto } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Badge, ErrorBlock, LoadingBlock, PageHeader } from '../components/data'
import { Button, Card, InlineButton, Input, Select } from '../components/ui'
import {
  CRA_STATUS_LABELS,
  formatDate,
  monthLabel,
  statusBadge,
} from '../lib/format'
import { useAsync } from '../lib/useAsync'
import { CraDetail } from './CraDetail'
import { IndispoCalendar } from './IndispoCalendar'

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + delta
  return { year: Math.floor(total / 12), month: (total % 12) + 1 }
}

export function IndispoList() {
  const { user } = useAuth()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [page, setPage] = useState(0)
  const [openId, setOpenId] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  const isConsultant = user?.role === 'CONSULTANT'

  const own = useAsync(
    () =>
      user?.consultantId
        ? crasApi.findByConsultant(user.consultantId, year, 'CONGE')
        : Promise.resolve([] as CraDto[]),
    [user?.consultantId, year],
  )

  const soc = useAsync(
    () =>
      user?.socId
        ? crasApi.findBySocYear(user.socId, year, 'CONGE')
        : Promise.resolve([] as CraDto[]),
    [user?.socId, year],
  )

  const { data, loading, error, reload } = isConsultant ? own : soc

  useEffect(() => {
    setPage(0)
  }, [year, month, search])

  if (!user) return null

  const list = (data ?? []).filter((c) => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    const yearMonth = `${c.year}-${String(c.month).padStart(2, '0')}`
    const consultant = (c.consultantName ?? '').toLowerCase()
    const status = (CRA_STATUS_LABELS[c.status] ?? c.status).toLowerCase()
    return yearMonth.includes(q) || consultant.includes(q) || status.includes(q)
  })
  const pageSize = user?.pageSize ?? 5
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize))
  const safePage = Math.min(page, totalPages - 1)
  const pageItems = list.slice(safePage * pageSize, safePage * pageSize + pageSize)

  const editable = (c: CraDto) =>
    c.status !== 'SUBMITTED' &&
    c.status !== 'PENDING_SEND' &&
    c.status !== 'VALIDATED' &&
    c.status !== 'VALREJ'

  const hasIndispoThisMonth = (data ?? []).some((c) => c.month === month)

  function openPeriod(newYear: number, newMonth: number) {
    const sameYear = newYear === year
    setYear(newYear)
    setMonth(newMonth)
    setOpenId(null)
    setSelectedId(null)
    if (isConsultant && sameYear) {
      const ind = (data ?? []).find((c) => c.month === newMonth)
      if (ind) setOpenId(ind.id)
    }
  }

  function goPrev() {
    const p = shiftMonth(year, month, -1)
    void openPeriod(p.year, p.month)
  }

  function goToday() {
    void openPeriod(now.getFullYear(), now.getMonth() + 1)
  }

  function goNext() {
    const p = shiftMonth(year, month, 1)
    void openPeriod(p.year, p.month)
  }

  async function handleDelete(c: CraDto) {
    if (
      !window.confirm(
        `Supprimer l'Indispo de ${c.consultantName ?? '—'} (${monthLabel(c.month)} ${c.year}) ?`,
      )
    )
      return
    try {
      await crasApi.delete(c.id)
      if (openId === c.id) setOpenId(null)
      if (selectedId === c.id) setSelectedId(null)
      reload()
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : 'Erreur inattendue')
    }
  }

  async function createIndispo() {
    if (!user?.consultantId) return
    try {
      const ind = await crasApi.getOrCreate(user.consultantId, year, month, 'CONGE')
      setOpenId(ind.id)
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : 'Erreur inattendue')
    }
  }

  return (
    <div>
      <PageHeader
        title={tr('IndispoList.indispos')}
        subtitle={tr('IndispoList.conges.du.consultant.par.mois')}
        actions={
          <InlineButton onClick={reload} title="Recharger la liste des Indispos">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 8 8 1 1 0 0 0-2 0 6 6 0 1 1-6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35Z" />
            </svg>
            Actualiser
          </InlineButton>
        }
      />

      {error && <ErrorBlock message={error} />}
      {loading && <LoadingBlock />}

      {!loading && (
        <div className="mb-4">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr('IndispoList.filtrer.par.annee.mois.consultant.ou.statut')}
          />
        </div>
      )}

      {!loading && list.length === 0 && (
        <Card className="flex flex-col items-center justify-center py-14">
          <p className="text-sm font-medium text-gray-900">
            {search.trim() ? 'Aucune Indispo ne correspond au filtre' : 'Aucune Indispo pour cette année'}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {search.trim()
              ? 'Modifiez votre recherche.'
              : isConsultant
                ? 'Cliquez sur « Nouvelle Indispo » pour créer votre Indispo.'
                : 'Aucune Indispo saisie.'}
          </p>
        </Card>
      )}

      {!loading && list.length > 0 && (
        <>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead style={{ backgroundColor: 'var(--table-header)' }}>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      {tr('IndispoList.annee.mois')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      {tr('IndispoList.consultant')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      {tr('IndispoList.statut')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      {tr('IndispoList.jours')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      {tr('IndispoList.soumise.le')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      {tr('IndispoList.validee.le')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      {tr('IndispoList.commentaire')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      {tr('IndispoList.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {pageItems.map((ind) => (
                    <tr
                      key={ind.id}
                      onClick={() => setSelectedId(ind.id)}
                      className={`align-top cursor-pointer ${
                        ind.id === selectedId
                          ? '[&>td]:border-y-2 [&>td]:border-blue-400 [&>td:first-child]:border-l-2 [&>td:last-child]:border-r-2 [&>td]:bg-blue-50'
                          : 'bg-yellow-50 even:bg-yellow-100'
                      }`}
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                        {ind.year}-{String(ind.month).padStart(2, '0')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {ind.consultantName ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge kind={statusBadge(ind.status)}>
                          {CRA_STATUS_LABELS[ind.status] ?? ind.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{ind.totalWorkedDays} {tr('IndispoList.j')}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(ind.submittedAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(ind.validatedAt)}
                      </td>
                      <td className="max-w-64 px-4 py-3 text-sm text-gray-600">
                        {ind.comment ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <InlineButton
                            onClick={() => {
                              setSelectedId(ind.id)
                              setOpenId(ind.id)
                            }}
                          >
                            {editable(ind) ? 'Éditer' : 'Ouvrir'}
                          </InlineButton>
                          {editable(ind) && (
                            <InlineButton
                              className="border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                              onClick={() => handleDelete(ind)}
                            >
                              {tr('IndispoList.supprimer')}
                            </InlineButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <InlineButton disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
                {tr('IndispoList.precedent')}
              </InlineButton>
              <span className="text-sm text-gray-500">
                {tr('IndispoList.page')} {safePage + 1} / {totalPages}
              </span>
              <InlineButton
                disabled={safePage >= totalPages - 1}
                onClick={() => setPage(safePage + 1)}
              >
                {tr('IndispoList.suivant')}
              </InlineButton>
            </div>
          )}

          {selectedId != null &&
            (() => {
              const sel = (data ?? []).find((c) => c.id === selectedId)
              if (!sel) return null
              return (
                <div className="mt-4">
                  <IndispoCalendar selected={sel} indispos={data ?? []} year={year} />
                </div>
              )
            })()}
        </>
      )}

      <Card className="mt-4 flex flex-wrap items-center gap-3 p-4">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          {tr('IndispoList.periode')}
          <Select
            className="w-auto"
            value={month}
            onChange={(e) => void openPeriod(year, Number(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </Select>
          <Select
            className="w-auto"
            value={year}
            onChange={(e) => void openPeriod(Number(e.target.value), month)}
          >
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </label>
        <div className="flex items-center gap-1">
          <InlineButton onClick={goPrev} title={tr('IndispoList.mois.precedent')}>
            ◀
          </InlineButton>
          <InlineButton onClick={goToday} title={tr('IndispoList.revenir.au.mois.actuel')}>
            {tr('IndispoList.auj')}
          </InlineButton>
          <InlineButton onClick={goNext} title={tr('IndispoList.mois.suivant')}>
            ▶
          </InlineButton>
        </div>
      </Card>

      {isConsultant && user.consultantId && (
        <div className="mt-4 flex flex-col items-center justify-center gap-2">
          <div className="flex items-center justify-center gap-3">
            <Button
              className="w-auto"
              variant="yellow"
              onClick={createIndispo}
              disabled={hasIndispoThisMonth}
              title={
                hasIndispoThisMonth
                  ? 'Une Indispo existe déjà pour ce mois'
                  : 'Créer une nouvelle Indispo pour ce mois'
              }
            >
              {tr('IndispoList.nouvelle.indispo')}
            </Button>
          </div>
          {hasIndispoThisMonth && (
            <p className="text-sm text-gray-500">
              {tr('IndispoList.une.indispo.existe.deja.pour.ce.mois.cliquez.sur.editer.dans')}
            </p>
          )}
        </div>
      )}

      {openId != null && (
        <div className="mt-6">
          <CraDetail
            id={openId}
            onClose={() => {
              setOpenId(null)
              reload()
            }}
            onChange={reload}
          />
        </div>
      )}
    </div>
  )
}
