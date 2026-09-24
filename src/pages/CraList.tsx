import { tr } from '../i18n/translate'
import { useEffect, useState } from 'react'
import { ApiError } from '../api/client'
import { consultantsApi } from '../api/consultants'
import { crasApi } from '../api/cras'
import type { ConsultantSummary, CraDto } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Badge, ErrorBlock, LoadingBlock, PageHeader } from '../components/data'
import { dialog } from '../components/dialog'
import { CraHistoryModal } from '../components/CraHistoryModal'
import { Button, Card, InlineButton, Input, MonthInput, RefreshButton, Select } from '../components/ui'
import {
  CRA_STATUS_LABELS,
  formatDate,
  monthLabel,
  statusBadge,
} from '../lib/format'
import { useAsync } from '../lib/useAsync'
import { CraDetail } from './CraDetail'


function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + delta
  return { year: Math.floor(total / 12), month: (total % 12) + 1 }
}

export function CraList() {
  const { user } = useAuth()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [page, setPage] = useState(0)
  const [openCraId, setOpenCraId] = useState<number | null>(null)
  const [historyCra, setHistoryCra] = useState<CraDto | null>(null)
  const [search, setSearch] = useState('')
  const [consultantFilter, setConsultantFilter] = useState<number | null>(null)
  const [monthFilter, setMonthFilter] = useState('')

  const isConsultant = user?.role === 'CONSULTANT'
  const isManager = user?.role === 'MANAGER'
  const isAdmin = user?.role === 'ADMIN'
  // Peut avoir ses propres CRA : tout utilisateur rattaché à un manager (consultant, manager…).
  const canOwnCra = isConsultant || user?.manager != null
  const ownerId = user?.consultantId ?? user?.id
  const canValidate = (c: CraDto) =>
    user?.role === 'ADMIN' ||
    user?.role === 'RESPONSIBLE_SOC' ||
    (user?.role === 'MANAGER' && c.managerId === user.id)

  const ownCras = useAsync(
    () =>
      canOwnCra && ownerId
        ? crasApi.findByConsultant(ownerId, year)
        : Promise.resolve([] as CraDto[]),
    [canOwnCra, ownerId, year],
  )

  const managerCras = useAsync(
    async () => {
      if (!isManager || !ownerId) {
        return [] as CraDto[]
      }
      const [team, own] = await Promise.all([
        crasApi.findByManager(year),
        canOwnCra ? crasApi.findByConsultant(ownerId, year) : Promise.resolve([] as CraDto[]),
      ])
      const byId = new Map<number, CraDto>()
      for (const c of own) byId.set(c.id, c)
      for (const c of team) if (!byId.has(c.id)) byId.set(c.id, c)
      return [...byId.values()]
    },
    [isManager, ownerId, canOwnCra, year],
  )

  const socCras = useAsync(
    () =>
      !isConsultant && !isManager && !isAdmin && user?.socId
        ? crasApi.findBySocYear(user.socId, year)
        : Promise.resolve([] as CraDto[]),
    [isConsultant, isManager, isAdmin, user?.socId, year],
  )

  const allCras = useAsync(
    () => (isAdmin ? crasApi.findAllYear(year) : Promise.resolve([] as CraDto[])),
    [isAdmin, year],
  )

  const consultants = useAsync(
    () =>
      !isConsultant
        ? consultantsApi.filterList()
        : Promise.resolve([] as ConsultantSummary[]),
    [isConsultant],
  )

  const { data, loading, error, reload } = isConsultant
    ? ownCras
    : isManager
      ? managerCras
      : isAdmin
        ? allCras
        : socCras

  useEffect(() => {
    setPage(0)
  }, [year, month, search, consultantFilter, monthFilter])

  if (!user) return null

  const list = (data ?? []).filter((c) => {
    if (monthFilter) {
      const [filterYear, filterMonth] = monthFilter.split('-').map(Number)
      if (c.year !== filterYear || c.month !== filterMonth) return false
    }
    if (consultantFilter != null && c.consultantId !== consultantFilter) return false
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    const yearMonth = `${c.year}-${String(c.month).padStart(2, '0')}`
    const consultant = (c.consultantName ?? '').toLowerCase()
    const status = (CRA_STATUS_LABELS[c.status] ?? c.status).toLowerCase()
    return yearMonth.includes(q) || consultant.includes(q) || status.includes(q)
  })
  const totalPages = Math.max(1, Math.ceil(list.length / (user?.pageSize ?? 5)))
  const safePage = Math.min(page, totalPages - 1)
  const pageItems = list.slice(safePage * (user?.pageSize ?? 5), safePage * (user?.pageSize ?? 5) + (user?.pageSize ?? 5))

  const editable = (c: CraDto) => c.status !== 'SUBMITTED' && c.status !== 'VALIDATED'

  function openPeriod(newYear: number, newMonth: number) {
    const sameYear = newYear === year
    setYear(newYear)
    setMonth(newMonth)
    setOpenCraId(null)
    if (isConsultant && sameYear) {
      const cra = (data ?? []).find((c) => c.month === newMonth)
      if (cra) setOpenCraId(cra.id)
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

  async function changeStatus(id: number, action: 'validate' | 'reject') {
    if (action === 'reject') {
      const comment = await dialog.prompt('Motif du rejet :')
      if (comment === null) return
      try {
        await crasApi.reject(id, comment)
      } catch (err) {
        void dialog.error(err instanceof ApiError ? err.message : 'Erreur inattendue')
        return
      }
    } else {
      try {
        await crasApi.validate(id)
      } catch (err) {
        void dialog.error(err instanceof ApiError ? err.message : 'Erreur inattendue')
        return
      }
    }
    reload()
  }

  async function handleDelete(c: CraDto) {
    if (
      !(await dialog.confirm(
        `Supprimer le CRA de ${c.consultantName ?? '—'} (${monthLabel(c.month)} ${c.year}) ?`,
        { variant: 'warning', danger: true, okLabel: 'Supprimer' },
      ))
    )
      return
    try {
      await crasApi.delete(c.id)
      if (openCraId === c.id) setOpenCraId(null)
      reload()
    } catch (err) {
      void dialog.error(err instanceof ApiError ? err.message : 'Erreur inattendue')
    }
  }

  async function findFreePeriod(): Promise<{ year: number; month: number }> {
    if (!ownerId) return { year, month }
    let y = year
    let m = month
    for (let i = 0; i < 24; i++) {
      const cras = await crasApi.findByConsultant(ownerId, y)
      const cra = cras.find((c) => c.year === y && c.month === m && c.type === 'CRA')
      if (!cra || cra.status === 'DRAFT' || cra.status === 'REJECTED') {
        return { year: y, month: m }
      }
      m++
      if (m > 12) {
        m = 1
        y++
      }
    }
    return { year, month }
  }

  async function createCra(type: string) {
    if (!ownerId) return
    try {
      const period = await findFreePeriod()
      const cra = await crasApi.getOrCreate(ownerId, period.year, period.month, type)
      setOpenCraId(cra.id)
      if (period.year !== year || period.month !== month) {
        setYear(period.year)
        setMonth(period.month)
      }
    } catch (err) {
      void dialog.error(err instanceof ApiError ? err.message : 'Erreur inattendue')
    }
  }

  return (
    <div>
      <PageHeader
        title={tr('CraList.cra')}
        count={list.length}
        subtitle={
          isConsultant
            ? 'Mes comptes rendus d’activité'
            : isManager
              ? 'CRA des consultants de mon équipe'
              : "Comptes rendus d'activité par consultant et par mois"
        }
        actions={
          <RefreshButton onClick={reload} />
        }
      />

      {error && <ErrorBlock message={error} />}
      {loading && <LoadingBlock />}

      {!loading && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {!isConsultant && (
            <div className="max-w-xs flex-1">
              <Select
                value={consultantFilter ?? ''}
                onChange={(e) => setConsultantFilter(e.target.value ? Number(e.target.value) : null)}
                title={tr('CraList.consultants')}
              >
                <option value="">{tr('CraList.tous.les.consultants')}</option>
                {consultants.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="max-w-[12rem] flex-1">
            <MonthInput
              value={monthFilter}
              onChange={(e) => {
                const ym = e.target.value.slice(0, 7)
                setMonthFilter(ym)
                const nextYear = ym ? Number(ym.slice(0, 4)) : NaN
                if (nextYear) setYear(nextYear)
              }}
              title={tr('CraList.filtrer.par.mois')}
            />
          </div>
          <div className="min-w-[16rem] flex-1">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tr('CraList.filtrer.par.annee.mois.consultant.ou.statut')}
            />
          </div>
        </div>
      )}

      {!loading && list.length === 0 && (
        <Card className="flex flex-col items-center justify-center py-14">
          <p className="text-sm font-medium text-gray-900">
            {search.trim() ? 'Aucun CRA ne correspond au filtre' : 'Aucun CRA pour cette année'}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {search.trim()
              ? 'Modifiez votre recherche.'
              : isConsultant
                ? 'Cliquez sur « Nouveau Cra » pour créer votre CRA.'
                : 'Aucun CRA saisi.'}
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
                    <th className="w-12 px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-gray-400">
                      #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      {tr('CraList.annee.mois')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      {tr('CraList.consultant')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      {tr('CraList.statut')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      {tr('CraList.jours')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      {tr('CraList.soumis.le')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      {tr('CraList.valide.le')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      {tr('CraList.commentaire')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      {tr('CraList.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {pageItems.map((cra, i) => (
                    <tr
                      key={cra.id}
                      className={`align-top ${
                        cra.id === openCraId
                          ? '[&>td]:border-y-2 [&>td]:border-blue-400 [&>td:first-child]:border-l-2 [&>td:last-child]:border-r-2 [&>td]:bg-blue-50'
                          : cra.type === 'CONGE'
                            ? 'bg-yellow-100'
                            : 'even:bg-gray-50'
                      }`}
                    >
                      <td className="w-12 whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-gray-400">
                        {safePage * (user?.pageSize ?? 5) + i + 1}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                        {cra.year}-{String(cra.month).padStart(2, '0')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {cra.consultantName ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge kind={statusBadge(cra.status)}>
                          {CRA_STATUS_LABELS[cra.status] ?? cra.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{cra.totalWorkedDays} {tr('CraList.j')}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(cra.submittedAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(cra.validatedAt)}
                      </td>
                      <td className="max-w-64 px-4 py-3 text-sm text-gray-600">
                        {cra.comment ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <InlineButton variant="primary" onClick={() => setOpenCraId(cra.id)}>
                            {editable(cra) ? 'Éditer' : 'Ouvrir'}
                          </InlineButton>
                          <InlineButton variant="primary" onClick={() => setHistoryCra(cra)}>{tr('CraList.historique')}</InlineButton>
                          {editable(cra) && (
                            <InlineButton
                              variant="danger"
                              onClick={() => handleDelete(cra)}
                            >
                              {tr('CraList.supprimer')}
                            </InlineButton>
                          )}
                          {canValidate(cra) && cra.status === 'SUBMITTED' && (
                            <>
                              <InlineButton
                                className="border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
                                onClick={() => changeStatus(cra.id, 'validate')}
                              >
                                {tr('CraList.valider')}
                              </InlineButton>
                              <InlineButton
                                className="border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                                onClick={() => changeStatus(cra.id, 'reject')}
                              >
                                {tr('CraList.rejeter')}
                              </InlineButton>
                            </>
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
                {tr('CraList.precedent')}
              </InlineButton>
              <span className="text-sm text-gray-500">
                {tr('CraList.page')} {safePage + 1} / {totalPages}
              </span>
              <InlineButton
                disabled={safePage >= totalPages - 1}
                onClick={() => setPage(safePage + 1)}
              >
                {tr('CraList.suivant')}
              </InlineButton>
            </div>
          )}
        </>
      )}

      <Card className="mt-4 flex flex-wrap items-center gap-3 p-4">
        <label className="flex items-center gap-2 whitespace-nowrap text-sm text-gray-600">
          <span className="min-w-[4.5rem]">{tr('CraList.mois')}</span>
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
          <InlineButton onClick={goPrev} title={tr('CraList.mois.precedent')}>
            ◀
          </InlineButton>
          <InlineButton onClick={goToday} title={tr('CraList.revenir.au.mois.courant')}>
            {tr('CraList.mois.courant')}
          </InlineButton>
          <InlineButton onClick={goNext} title={tr('CraList.mois.suivant')}>
            ▶
          </InlineButton>
        </div>
      </Card>

      {canOwnCra && ownerId && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <Button className="w-auto" onClick={() => createCra('CRA')}>
            {tr('CraList.nouveau.cra')}
          </Button>
        </div>
      )}

      {openCraId != null && (
        <div className="mt-6">
          <CraDetail
            id={openCraId}
            onClose={() => {
              setOpenCraId(null)
              reload()
            }}
            onChange={reload}
          />
        </div>
      )}

      {historyCra && (
        <CraHistoryModal
          craId={historyCra.id}
          isIndispo={historyCra.type === 'CONGE'}
          onClose={() => setHistoryCra(null)}
        />
      )}
    </div>
  )
}
