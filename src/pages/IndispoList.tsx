import { tr } from '../i18n/translate'
import { useEffect, useState } from 'react'
import { ApiError } from '../api/client'
import { crasApi } from '../api/cras'
import type { CraDto } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Badge, ErrorBlock, LoadingBlock, PageHeader } from '../components/data'
import { dialog } from '../components/dialog'
import { Button, Card, IconButton, InlineButton, Input, RefreshButton, Select } from '../components/ui'
import {
  CRA_STATUS_LABELS,
  formatDate,
  monthLabel,
  statusBadge,
} from '../lib/format'
import { useAsync } from '../lib/useAsync'
import { useDynamicTranslate } from '../lib/useDynamicTranslate'
import { CraDetail } from './CraDetail'
import { IndispoCalendar } from './IndispoCalendar'

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + delta
  return { year: Math.floor(total / 12), month: (total % 12) + 1 }
}

export function IndispoList() {
  const { user } = useAuth()
  const dt = useDynamicTranslate()
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

  // soc-72 : la navigation de l'indispo démarre à la date d'embauche du consultant.
  useEffect(() => {
    if (!isConsultant || !user?.hireDate) return
    const hy = Number(user.hireDate.slice(0, 4))
    const hm = Number(user.hireDate.slice(5, 7))
    if (year < hy || (year === hy && month < hm)) {
      setYear(hy)
      setMonth(hm)
    }
  }, [isConsultant, user?.hireDate, year, month])

  if (!user) return null

  const hirePeriod = isConsultant && user.hireDate
    ? { year: Number(user.hireDate.slice(0, 4)), month: Number(user.hireDate.slice(5, 7)) }
    : null
  const beforeHirePeriod = (y: number, m: number) =>
    !!hirePeriod && (y < hirePeriod.year || (y === hirePeriod.year && m < hirePeriod.month))

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
    // soc-72 : impossible de naviguer avant la date d'embauche (liste des mois / années).
    let y = newYear
    let m = newMonth
    if (beforeHirePeriod(y, m) && hirePeriod) {
      y = hirePeriod.year
      m = hirePeriod.month
    }
    const sameYear = y === year
    setYear(y)
    setMonth(m)
    setOpenId(null)
    setSelectedId(null)
    if (isConsultant && sameYear) {
      const ind = (data ?? []).find((c) => c.month === m)
      if (ind) setOpenId(ind.id)
    }
  }

  const allowedYears = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]
    .filter((y) => !hirePeriod || y >= hirePeriod.year)
  const allowedMonths = Array.from({ length: 12 }, (_, i) => i + 1)
    .filter((m) => !hirePeriod || year > hirePeriod.year || m >= hirePeriod.month)

  function goPrev() {
    const p = shiftMonth(year, month, -1)
    if (beforeHirePeriod(p.year, p.month)) return
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
      !(await dialog.confirm(
        tr('IndispoList.supprimer.l.indispo', {
          name: c.consultantName ?? '—',
          period: `${monthLabel(c.month)} ${c.year}`,
        }),
        { variant: 'warning', danger: true, okLabel: tr('common.delete') },
      ))
    )
      return
    try {
      await crasApi.delete(c.id)
      if (openId === c.id) setOpenId(null)
      if (selectedId === c.id) setSelectedId(null)
      reload()
    } catch (err) {
      void dialog.error(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    }
  }

  async function createIndispo() {
    if (!user?.consultantId) return
    if (isConsultant && !user.hireDate) {
      void dialog.error(tr('hireDate.required'))
      return
    }
    try {
      const ind = await crasApi.getOrCreate(user.consultantId, year, month, 'CONGE')
      setOpenId(ind.id)
    } catch (err) {
      void dialog.error(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    }
  }

  return (
    <div>
      <PageHeader
        title={tr('IndispoList.indispos')}
        titleId="IndispoList.indispos"
        count={list.length}
        subtitle={tr('IndispoList.conges.du.consultant.par.mois')}
        subtitleId="IndispoList.conges.du.consultant.par.mois"
        actions={
          <RefreshButton onClick={reload} />
        }
      />

      {error && <ErrorBlock id="IndispoList.error" message={error} />}
      {loading && <LoadingBlock />}

      {!loading && (
        <div className="mb-4">
          <Input
            id="IndispoList.search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr('IndispoList.filtrer.par.annee.mois.consultant.ou.statut')}
          />
        </div>
      )}

      {!loading && list.length === 0 && (
        <Card id="IndispoList.empty" className="flex flex-col items-center justify-center py-14">
          <p id="IndispoList.empty.title" className="text-sm font-medium text-gray-900">
            {search.trim() ? 'Aucune Indispo ne correspond au filtre' : 'Aucune Indispo pour cette année'}
          </p>
          <p id="IndispoList.empty.description" className="mt-1 text-sm text-gray-500">
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
          <Card id="IndispoList.list" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead style={{ backgroundColor: 'var(--table-header)' }}>
                  <tr>
                    <th id="IndispoList.table.index" className="w-12 px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-gray-400">
                      #
                    </th>
                    <th id="IndispoList.annee.mois" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      {tr('IndispoList.annee.mois')}
                    </th>
                    <th id="IndispoList.consultant" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      {tr('IndispoList.consultant')}
                    </th>
                    <th id="IndispoList.statut" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      {tr('IndispoList.statut')}
                    </th>
                    <th id="IndispoList.jours" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      {tr('IndispoList.jours')}
                    </th>
                    <th id="IndispoList.soumise.le" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      {tr('IndispoList.soumise.le')}
                    </th>
                    <th id="IndispoList.validee.le" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      {tr('IndispoList.validee.le')}
                    </th>
                    <th id="IndispoList.commentaire" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      {tr('IndispoList.commentaire')}
                    </th>
                    <th id="IndispoList.actions" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      {tr('IndispoList.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {pageItems.map((ind, i) => (
                    <tr
                      id={`IndispoList.indispo.${ind.id}`}
                      key={ind.id}
                      onClick={() => setSelectedId(ind.id)}
                      className={`align-top cursor-pointer ${
                        ind.id === selectedId
                          ? '[&>td]:border-y-2 [&>td]:border-blue-400 [&>td:first-child]:border-l-2 [&>td:last-child]:border-r-2 [&>td]:bg-blue-50'
                          : 'bg-yellow-50 even:bg-yellow-100'
                      }`}
                    >
                      <td id={`IndispoList.indispo.${ind.id}.index`} className="w-12 whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-gray-400">
                        {safePage * pageSize + i + 1}
                      </td>
                      <td id={`IndispoList.indispo.${ind.id}.period`} className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                        {ind.year}-{String(ind.month).padStart(2, '0')}
                      </td>
                      <td id={`IndispoList.indispo.${ind.id}.consultant`} className="px-4 py-3 text-sm text-gray-900">
                        {ind.consultantName ?? '—'}
                      </td>
                      <td id={`IndispoList.indispo.${ind.id}.statusCell`} className="px-4 py-3">
                        <Badge id={`IndispoList.indispo.${ind.id}.status`} kind={statusBadge(ind.status)}>
                          {dt(CRA_STATUS_LABELS[ind.status] ?? ind.status)}
                        </Badge>
                      </td>
                      <td id={`IndispoList.indispo.${ind.id}.days`} className="px-4 py-3 text-sm text-gray-900">{ind.totalWorkedDays} {tr('IndispoList.j')}</td>
                      <td id={`IndispoList.indispo.${ind.id}.submitted`} className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(ind.submittedAt)}
                      </td>
                      <td id={`IndispoList.indispo.${ind.id}.validated`} className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(ind.validatedAt)}
                      </td>
                      <td id={`IndispoList.indispo.${ind.id}.comment`} className="max-w-64 px-4 py-3 text-sm text-gray-600">
                        {ind.comment ?? '—'}
                      </td>
                      <td id={`IndispoList.indispo.${ind.id}.actions`} className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <IconButton
                            id={`IndispoList.indispo.${ind.id}.edit`}
                            icon={editable(ind) ? 'edit' : 'view'}
                            label={editable(ind) ? 'Éditer' : 'Ouvrir'}
                            onClick={() => {
                              setSelectedId(ind.id)
                              setOpenId(ind.id)
                            }}
                          />
                          {editable(ind) && (
                            <IconButton
                              icon="delete"
                              label={tr('IndispoList.supprimer')}
                              variant="danger"
                              onClick={() => handleDelete(ind)} id={`IndispoList.indispo.${ind.id}.delete`} />
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
              <InlineButton id="IndispoList.precedent" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
                {tr('IndispoList.precedent')}
              </InlineButton>
              <span id="IndispoList.page" className="text-sm text-gray-500">
                {tr('IndispoList.page')} {safePage + 1} / {totalPages}
              </span>
              <InlineButton
                id="IndispoList.suivant"
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

      <Card id="IndispoList.periodCard" className="mt-4 flex flex-wrap items-center gap-3 p-4">
        <label id="IndispoList.periode" className="flex items-center gap-2 text-sm text-gray-600">
          {tr('IndispoList.periode')}
          <Select
            id="IndispoList.periode.month"
            className="w-auto"
            value={month}
            onChange={(e) => void openPeriod(year, Number(e.target.value))}
          >
            {allowedMonths.map((m) => (
              <option id={`IndispoList.periode.month.${m}`} key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </Select>
          <Select
            id="IndispoList.periode.year"
            className="w-auto"
            value={year}
            onChange={(e) => void openPeriod(Number(e.target.value), month)}
          >
            {allowedYears.map((y) => (
              <option id={`IndispoList.periode.year.${y}`} key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </label>
        <div className="flex items-center gap-1">
          <InlineButton id="IndispoList.prev" onClick={goPrev} title={tr('IndispoList.mois.precedent')}
            disabled={beforeHirePeriod(shiftMonth(year, month, -1).year, shiftMonth(year, month, -1).month)}>
            ◀
          </InlineButton>
          <InlineButton id="IndispoList.auj" onClick={goToday} title={tr('IndispoList.revenir.au.mois.actuel')}>
            {tr('IndispoList.auj')}
          </InlineButton>
          <InlineButton id="IndispoList.next" onClick={goNext} title={tr('IndispoList.mois.suivant')}>
            ▶
          </InlineButton>
        </div>
      </Card>

      {isConsultant && user.consultantId && (
        <div className="mt-4 flex flex-col items-center justify-center gap-2">
          <div className="flex items-center justify-center gap-3">
            <Button
              id="IndispoList.nouvelle.indispo"
              className="w-auto"
              variant="primary"
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
            <p id="IndispoList.une.indispo.existe.deja.pour.ce.mois.cliquez.sur.editer.dans" className="text-sm text-gray-500">
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
