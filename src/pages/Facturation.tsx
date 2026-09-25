import { tr } from '../i18n/translate'
import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { socsApi } from '../api/socs'
import { projectsApi } from '../api/projects'
import { crasApi } from '../api/cras'
import { ApiError } from '../api/client'
import { useAsync } from '../lib/useAsync'
import { useDynamicTranslate } from '../lib/useDynamicTranslate'
import { Card, InlineButton, RefreshButton, Select, Spinner } from '../components/ui'
import { Badge, ErrorBlock, LoadingBlock, PageHeader } from '../components/data'
import { dialog } from '../components/dialog'
import {
  SUBSCRIPTION_STATUS_LABELS,
  formatDate,
  formatMoney,
  monthLabel,
  monthShort,
  statusBadge,
} from '../lib/format'
import type { SocDto } from '../api/types'

export function Facturation() {
  const { user } = useAuth()
  const dt = useDynamicTranslate()
  const isAdmin = user?.role === 'ADMIN'
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [exporting, setExporting] = useState<null | 'csv' | 'pdf'>(null)

  const { data: socs } = useAsync(() => (isAdmin ? socsApi.findAll() : Promise.resolve([])), [isAdmin])
  const [selectedSoc, setSelectedSoc] = useState<number | null>(user?.socId ?? null)

  const socId = isAdmin ? selectedSoc : user?.socId ?? null

  const { data: detail, loading: detailLoading, error: detailError, reload } = useAsync(
    () => (socId ? socsApi.getById(socId) : Promise.resolve(null)),
    [socId],
  )

  const { data: projects } = useAsync(
    () => (socId ? projectsApi.findAll({ socId }) : Promise.resolve([])),
    [socId],
  )

  const { data: monthCras } = useAsync(
    () => (socId ? crasApi.findByMonth(year, month, socId) : Promise.resolve([])),
    [socId, year, month],
  )

  if (!user) return null

  const activeProjects = (projects ?? []).filter((p) => p.active)
  const monthlyRevenue = activeProjects.reduce((sum, p) => sum + (p.dailyRate ?? 0) * 21, 0)
  const validatedCras = (monthCras ?? []).filter((c) => c.status === 'VALIDATED')
  const validatedHours = validatedCras.reduce((sum, c) => sum + c.totalHours, 0)
  const subscription = detail?.subscriptions?.[0]
  const totalPaid = (detail?.payments ?? []).reduce((sum, p) => sum + p.amount, 0)

  async function handleExport(kind: 'csv' | 'pdf') {
    if (!socId) return
    setExporting(kind)
    try {
      if (kind === 'csv') {
        await crasApi.exportCsv({ socId, month, year })
      } else {
        await crasApi.exportPdf({ socId, month, year })
      }
    } catch (err) {
      void dialog.error(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    } finally {
      setExporting(null)
    }
  }

  return (
    <div>
      <PageHeader
        title={tr('Facturation.facturation')}
        subtitle={tr('Facturation.abonnement.paiements.et.chiffre.d.affaires')}
        actions={
          <div className="flex items-center gap-2">
            <RefreshButton onClick={reload} />
            <Select
              className="w-auto"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
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
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      {isAdmin && (
        <Card className="mb-6 p-4">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            {tr('Facturation.societe')}
            <Select
              className="w-64"
              value={selectedSoc ?? ''}
              onChange={(e) => setSelectedSoc(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">{tr('Facturation.selectionner')}</option>
              {(socs ?? []).map((soc: SocDto) => (
                <option key={soc.id} value={soc.id}>
                  {soc.name}
                </option>
              ))}
            </Select>
          </label>
        </Card>
      )}

      {detailError && <ErrorBlock message={detailError} />}
      {detailLoading && <LoadingBlock />}

      {detail && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-5">
              <p className="text-sm font-medium text-gray-500">{tr('Facturation.abonnement')}</p>
              <div className="mt-2 flex items-center gap-2">
                <p className="text-2xl font-bold text-gray-900">{dt(subscription?.plan ?? '—')}</p>
                {subscription && (
                  <Badge kind={statusBadge(subscription.status)}>
                    {dt(SUBSCRIPTION_STATUS_LABELS[subscription.status] ?? subscription.status)}
                  </Badge>
                )}
              </div>
              {subscription && (
                <p className="mt-1 text-sm text-gray-500">
                  {formatMoney(subscription.monthlyPrice)} {tr('Facturation.mois.debut')}{' '}
                  {formatDate(subscription.startDate)}
                  {subscription.trialEndDate && ` · ${tr('Facturation.essai.jusqu.au', { date: formatDate(subscription.trialEndDate) })}`}
                </p>
              )}
            </Card>
            <Card className="p-5">
              <p className="text-sm font-medium text-gray-500">{tr('Facturation.ca.mensuel.missions.actives')}</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{formatMoney(monthlyRevenue)}</p>
              <p className="mt-1 text-xs text-gray-500">{activeProjects.length} {tr('Facturation.mission.s.active.s')}</p>
            </Card>
            <Card className="p-5">
              <p className="text-sm font-medium text-gray-500">
                {tr('Facturation.cra.valides')} {monthShort(month)} {year}
              </p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{validatedCras.length}</p>
              <p className="mt-1 text-xs text-gray-500">{validatedHours} {tr('Facturation.h.validees')}</p>
            </Card>
            <Card className="p-5">
              <p className="text-sm font-medium text-gray-500">{tr('Facturation.total.regle')}</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{formatMoney(totalPaid)}</p>
              <p className="mt-1 text-xs text-gray-500">{(detail.payments ?? []).length} {tr('Facturation.paiement.s')}</p>
            </Card>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900" id="Facturation.missions.facturables">{tr('Facturation.missions.facturables')}</h3>
                <div className="flex gap-2">
                  <InlineButton onClick={() => handleExport('csv')} disabled={exporting !== null}>
                    {exporting === 'csv' ? <Spinner /> : 'CRA CSV'}
                  </InlineButton>
                  <InlineButton onClick={() => handleExport('pdf')} disabled={exporting !== null}>
                    {exporting === 'pdf' ? <Spinner /> : 'CRA PDF'}
                  </InlineButton>
                </div>
              </div>
              <div className="mt-4 divide-y divide-gray-100">
                {activeProjects.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-gray-900">{p.name}</p>
                      <p className="text-xs text-gray-500">
                        {p.client?.name ?? 'Client inconnu'} · {formatDate(p.startDate)} → {formatDate(p.endDate)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        {formatMoney((p.dailyRate ?? 0) * 21, p.currency ?? 'EUR')}
                        <span className="text-xs font-normal text-gray-500"> {tr('Facturation.mois')}</span>
                      </p>
                      <p className="text-xs text-gray-500">{tr('Facturation.tjm')} {formatMoney(p.dailyRate, p.currency ?? 'EUR')}</p>
                    </div>
                  </div>
                ))}
                {activeProjects.length === 0 && (
                  <p className="py-6 text-center text-sm text-gray-400">{tr('Facturation.aucune.mission.active')}</p>
                )}
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-lg font-semibold text-gray-900" id="Facturation.paiements">{tr('Facturation.paiements')}</h3>
              <div className="mt-4 divide-y divide-gray-100">
                {(detail.payments ?? []).map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-gray-900">{formatMoney(p.amount)}</p>
                      <p className="text-xs text-gray-500">
                        {formatDate(p.paymentDate)} · {p.method}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">{p.reference ?? '—'}</span>
                  </div>
                ))}
                {(detail.payments ?? []).length === 0 && (
                  <p className="py-6 text-center text-sm text-gray-400">{tr('Facturation.aucun.paiement.enregistre')}</p>
                )}
              </div>
            </Card>
          </div>
        </>
      )}

      {!detailLoading && !detail && !detailError && (
        <Card className="flex flex-col items-center justify-center py-14">
          <p className="text-sm font-medium text-gray-900">{tr('Facturation.selectionnez.une.societe')}</p>
          <p className="mt-1 text-sm text-gray-500">{tr('Facturation.aucune.donnee.de.facturation')}</p>
        </Card>
      )}
    </div>
  )
}
