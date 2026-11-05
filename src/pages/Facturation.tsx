import { tr } from '../i18n/translate'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { socsApi } from '../api/socs'
import { projectsApi } from '../api/projects'
import { crasApi } from '../api/cras'
import { subscriptionBillingApi } from '../api/subscriptionBilling'
import { ApiError } from '../api/client'
import { useAsync } from '../lib/useAsync'
import { useDynamicTranslate } from '../lib/useDynamicTranslate'
import { Button, Card, InlineButton, RefreshButton, Select, Spinner } from '../components/ui'
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
import type { PaymentMethod, SocDto } from '../api/types'

export function Facturation() {
  const { user } = useAuth()
  const dt = useDynamicTranslate()
  const isAdmin = user?.role === 'ADMIN'
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [exporting, setExporting] = useState<null | 'csv' | 'pdf'>(null)
  const [months, setMonths] = useState(1)
  const [paying, setPaying] = useState<PaymentMethod | null>(null)
  const [paymentsPage, setPaymentsPage] = useState(0)
  const overlapPrompted = useRef<number | null>(null)

  const { data: socs } = useAsync(() => (isAdmin ? socsApi.findAll() : Promise.resolve([])), [isAdmin])
  const [selectedSoc, setSelectedSoc] = useState<number | null>(user?.socId ?? null)

  const socId = isAdmin ? selectedSoc : user?.socId ?? null

  const { data: detail, loading: detailLoading, error: detailError, reload } = useAsync(
    () => (socId ? socsApi.getById(socId) : Promise.resolve(null)),
    [socId],
  )

  const { data: paymentConfig } = useAsync(() => subscriptionBillingApi.config(), [])
  const { data: overlaps, reload: reloadOverlaps } = useAsync(
    () => (socId ? subscriptionBillingApi.overlaps(socId) : Promise.resolve(null)),
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

  useEffect(() => {
    if (!socId || !overlaps?.hasOverlaps || overlapPrompted.current === socId) {
      return
    }
    overlapPrompted.current = socId
    void (async () => {
      const confirmed = await dialog.confirm(tr('Facturation.chevauchement.confirm'), {
        variant: 'warning',
        danger: true,
      })
      if (!confirmed) return
      try {
        await subscriptionBillingApi.resolveOverlaps(socId)
        reload()
        reloadOverlaps()
      } catch (err) {
        void dialog.error(err instanceof ApiError ? err.message : tr('Facturation.chevauchement.impossible'))
      }
    })()
  }, [socId, overlaps, reload, reloadOverlaps])

  if (!user) return null

  const activeProjects = (projects ?? []).filter((p) => p.active)
  const monthlyRevenue = activeProjects.reduce((sum, p) => sum + (p.dailyRate ?? 0) * 21, 0)
  const validatedCras = (monthCras ?? []).filter((c) => c.status === 'VALIDATED')
  const validatedHours = validatedCras.reduce((sum, c) => sum + c.totalHours, 0)
  const subscription = detail?.subscriptions?.[0]
  const paymentRows = detail?.payments ?? []
  const totalPaid = paymentRows.reduce((sum, p) => sum + p.amount, 0)
  const paymentsPageSize = user?.pageSize ?? 5
  const paymentsTotalPages = Math.max(1, Math.ceil(paymentRows.length / paymentsPageSize))
  const paymentsSafePage = Math.min(paymentsPage, paymentsTotalPages - 1)
  const visiblePayments = paymentRows.slice(
    paymentsSafePage * paymentsPageSize,
    paymentsSafePage * paymentsPageSize + paymentsPageSize,
  )

  async function handlePay(method: PaymentMethod) {
    if (!socId) return
    const monthKey = new Date().toISOString().slice(0, 7)
    const latestThisMonth = paymentRows.find((p) => (p.paymentDate ?? '').slice(0, 7) === monthKey)
    let confirmReplace = false
    if (latestThisMonth) {
      const existingMonths = latestThisMonth.periodMonths ?? 1
      if (months <= existingMonths) {
        void dialog.info(tr('Facturation.meme.duree.mois'))
        return
      }
      const confirmed = await dialog.confirm(tr('Facturation.remplacer.abonnement.confirm'), {
        variant: 'question',
      })
      if (!confirmed) return
      confirmReplace = true
    }
    setPaying(method)
    try {
      const result = await subscriptionBillingApi.pay(months, method, socId, confirmReplace)
      reload()
      void dialog.success(`${tr('Facturation.paiement.reussi')} ${result.invoiceNumber}`)
    } catch (err) {
      void dialog.error(err instanceof ApiError ? err.message : tr('Facturation.paiement.impossible'))
    } finally {
      setPaying(null)
    }
  }

  async function openInvoice(paymentId: number) {
    try {
      const url = await subscriptionBillingApi.invoiceUrl(paymentId)
      window.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      void dialog.error(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    }
  }

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
        titleId="Facturation.facturation"
        subtitle={tr('Facturation.abonnement.paiements.et.chiffre.d.affaires')}
        subtitleId="Facturation.abonnement.paiements.et.chiffre.d.affaires"
        actions={
          <div className="flex items-center gap-2">
            <RefreshButton onClick={reload} />
            <Select
              id="Facturation.month"
              className="w-auto"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option id={`Facturation.month.${m}`} key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </Select>
            <Select
              id="Facturation.year"
              className="w-auto"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                <option id={`Facturation.year.${y}`} key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      {isAdmin && (
        <Card id="Facturation.socSelectCard" className="mb-6 p-4">
          <label id="Facturation.societe" className="flex items-center gap-2 text-sm text-gray-600">
            {tr('Facturation.societe')}
            <Select
              id="Facturation.societe.select"
              className="w-64"
              value={selectedSoc ?? ''}
              onChange={(e) => setSelectedSoc(e.target.value ? Number(e.target.value) : null)}
            >
              <option id="Facturation.selectionner" value="">{tr('Facturation.selectionner')}</option>
              {(socs ?? []).map((soc: SocDto) => (
                <option id={`Facturation.societe.${soc.id}`} key={soc.id} value={soc.id}>
                  {soc.name}
                </option>
              ))}
            </Select>
          </label>
        </Card>
      )}

      {detailError && <ErrorBlock id="Facturation.detailError" message={detailError} />}
      {detailLoading && <LoadingBlock />}

      {detail && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card id="Facturation.card.subscription" className="p-5">
              <p id="Facturation.abonnement" className="text-sm font-medium text-gray-500">{tr('Facturation.abonnement')}</p>
              <div className="mt-2 flex items-center gap-2">
                <p id="Facturation.subscription.plan" className="text-2xl font-bold text-gray-900">{dt(subscription?.plan ?? '—')}</p>
                {subscription && (
                  <Badge id="Facturation.subscription.status" kind={statusBadge(subscription.status)}>
                    {dt(SUBSCRIPTION_STATUS_LABELS[subscription.status] ?? subscription.status)}
                  </Badge>
                )}
              </div>
              {subscription && (
                <p id="Facturation.subscription.details" className="mt-1 text-sm text-gray-500">
                  {formatMoney(subscription.monthlyPrice)} {tr('Facturation.mois.debut')}{' '}
                  {formatDate(subscription.startDate)}
                  {subscription.trialEndDate && subscription.status === 'TRIAL'
                    && ` · ${tr('Facturation.essai.jusqu.au', { date: formatDate(subscription.trialEndDate) })}`}
                  {subscription.endDate && subscription.status === 'ACTIVE'
                    && ` · ${tr('Facturation.prochaine.echeance')} ${formatDate(subscription.endDate)}`}
                </p>
              )}
            </Card>
            <Card id="Facturation.card.revenue" className="p-5">
              <p id="Facturation.ca.mensuel.missions.actives" className="text-sm font-medium text-gray-500">{tr('Facturation.ca.mensuel.missions.actives')}</p>
              <p id="Facturation.revenue.value" className="mt-2 text-2xl font-bold text-gray-900">{formatMoney(monthlyRevenue)}</p>
              <p id="Facturation.missions.activeCount" className="mt-1 text-xs text-gray-500">{activeProjects.length} {tr('Facturation.mission.s.active.s')}</p>
            </Card>
            <Card id="Facturation.card.cra" className="p-5">
              <p id="Facturation.cra.valides" className="text-sm font-medium text-gray-500">
                {tr('Facturation.cra.valides')} {monthShort(month)} {year}
              </p>
              <p id="Facturation.cra.count" className="mt-2 text-2xl font-bold text-gray-900">{validatedCras.length}</p>
              <p id="Facturation.cra.hours" className="mt-1 text-xs text-gray-500">{validatedHours} {tr('Facturation.h.validees')}</p>
            </Card>
            <Card id="Facturation.card.paid" className="p-5">
              <p id="Facturation.total.regle" className="text-sm font-medium text-gray-500">{tr('Facturation.total.regle')}</p>
              <p id="Facturation.paid.value" className="mt-2 text-2xl font-bold text-gray-900">{formatMoney(totalPaid)}</p>
              <p id="Facturation.payments.count" className="mt-1 text-xs text-gray-500">{(detail.payments ?? []).length} {tr('Facturation.paiement.s')}</p>
            </Card>
          </div>

          <Card id="Facturation.payCard" className="mt-6 p-5">
            <h3 id="Facturation.payer" className="text-lg font-semibold text-gray-900">{tr('Facturation.payer')}</h3>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label id="Facturation.duree.label" className="text-sm font-medium text-gray-700">
                <span className="mb-1 block">{tr('Facturation.duree')}</span>
                <Select id="Facturation.duree" className="w-40" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
                  <option id="Facturation.duree.1" value={1}>{tr('Facturation.mois1')}</option>
                  <option id="Facturation.duree.3" value={3}>{tr('Facturation.mois3')}</option>
                  <option id="Facturation.duree.6" value={6}>{tr('Facturation.mois6')}</option>
                  <option id="Facturation.duree.12" value={12}>{tr('Facturation.mois12')}</option>
                </Select>
              </label>
              <InlineButton
                id="Facturation.payer.cb"
                variant="primary"
                disabled={!paymentConfig?.cardEnabled || paying !== null}
                onClick={() => void handlePay('CARD')}
              >
                {paying === 'CARD' ? <Spinner /> : tr('Facturation.par.cb')}
              </InlineButton>
              <InlineButton
                id="Facturation.payer.paypal"
                variant="soft"
                disabled={!paymentConfig?.paypalEnabled || paying !== null}
                onClick={() => void handlePay('PAYPAL')}
              >
                {paying === 'PAYPAL' ? <Spinner /> : tr('Facturation.par.paypal')}
              </InlineButton>
            </div>
            {paymentConfig && !paymentConfig.cardEnabled && !paymentConfig.paypalEnabled && (
              <p id="Facturation.moyens.paiement.desactives" className="mt-2 text-sm text-red-600">
                {tr('Facturation.moyens.paiement.desactives')}
              </p>
            )}
          </Card>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card id="Facturation.card.missions" className="p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900" id="Facturation.missions.facturables">{tr('Facturation.missions.facturables')}</h3>
                <div className="flex gap-2">
                  <InlineButton id="Facturation.export.csv" onClick={() => handleExport('csv')} disabled={exporting !== null}>
                    {exporting === 'csv' ? <Spinner /> : 'CRA CSV'}
                  </InlineButton>
                  <InlineButton id="Facturation.export.pdf" onClick={() => handleExport('pdf')} disabled={exporting !== null}>
                    {exporting === 'pdf' ? <Spinner /> : 'CRA PDF'}
                  </InlineButton>
                </div>
              </div>
              <div className="mt-4 divide-y divide-gray-100">
                {activeProjects.map((p) => (
                  <div id={`Facturation.mission.${p.id}`} key={p.id} className="flex items-center justify-between py-3">
                    <div>
                      <p id={`Facturation.mission.${p.id}.name`} className="font-medium text-gray-900">{p.name}</p>
                      <p id={`Facturation.mission.${p.id}.client`} className="text-xs text-gray-500">
                        {p.client?.name ?? 'Client inconnu'} · {formatDate(p.startDate)} → {formatDate(p.endDate)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p id={`Facturation.mission.${p.id}.amount`} className="font-semibold text-gray-900">
                        {formatMoney((p.dailyRate ?? 0) * 21, p.currency ?? 'EUR')}
                        <span id={`Facturation.mission.${p.id}.month`} className="text-xs font-normal text-gray-500"> {tr('Facturation.mois')}</span>
                      </p>
                      <p id={`Facturation.mission.${p.id}.tjm`} className="text-xs text-gray-500">{tr('Facturation.tjm')} {formatMoney(p.dailyRate, p.currency ?? 'EUR')}</p>
                    </div>
                  </div>
                ))}
                {activeProjects.length === 0 && (
                  <p id="Facturation.aucune.mission.active" className="py-6 text-center text-sm text-gray-400">{tr('Facturation.aucune.mission.active')}</p>
                )}
              </div>
            </Card>

            <Card id="Facturation.card.payments" className="p-5">
              <h3 className="text-lg font-semibold text-gray-900" id="Facturation.paiements">{tr('Facturation.paiements')}</h3>
              <div className="mt-4 divide-y divide-gray-100">
                {visiblePayments.map((p) => (
                  <div id={`Facturation.payment.${p.id}`} key={p.id} className="flex items-center justify-between py-3">
                    <div>
                      <p id={`Facturation.payment.${p.id}.amount`} className="font-medium text-gray-900">{formatMoney(p.amount)}</p>
                      <p id={`Facturation.payment.${p.id}.details`} className="text-xs text-gray-500">
                        {formatDate(p.paymentDate)} · {p.method}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span id={`Facturation.payment.${p.id}.reference`} className="text-xs text-gray-400">
                        {p.invoiceNumber ?? p.reference ?? '—'}
                      </span>
                      {p.invoiceNumber && (
                        <InlineButton id={`Facturation.payment.${p.id}.invoice`} onClick={() => void openInvoice(p.id)}>
                          {tr('Facturation.facture.telecharger')}
                        </InlineButton>
                      )}
                    </div>
                  </div>
                ))}
                {paymentRows.length === 0 && (
                  <p id="Facturation.aucun.paiement.enregistre" className="py-6 text-center text-sm text-gray-400">{tr('Facturation.aucun.paiement.enregistre')}</p>
                )}
              </div>
              {paymentsTotalPages > 1 && (
                <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                  <span id="Facturation.payments.total">
                    {paymentRows.length} {tr('Facturation.paiements.total')}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      id="Facturation.payments.previous"
                      variant="neutral"
                      disabled={paymentsSafePage <= 0}
                      onClick={() => setPaymentsPage(paymentsSafePage - 1)}
                    >
                      {tr('common.previous')}
                    </Button>
                    <span id="Facturation.payments.page">
                      {tr('common.page')} {paymentsSafePage + 1} / {paymentsTotalPages}
                    </span>
                    <Button
                      id="Facturation.payments.next"
                      variant="neutral"
                      disabled={paymentsSafePage >= paymentsTotalPages - 1}
                      onClick={() => setPaymentsPage(paymentsSafePage + 1)}
                    >
                      {tr('common.next')}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      {!detailLoading && !detail && !detailError && (
        <Card id="Facturation.noSelection" className="flex flex-col items-center justify-center py-14">
          <p id="Facturation.selectionnez.une.societe" className="text-sm font-medium text-gray-900">{tr('Facturation.selectionnez.une.societe')}</p>
          <p id="Facturation.aucune.donnee.de.facturation" className="mt-1 text-sm text-gray-500">{tr('Facturation.aucune.donnee.de.facturation')}</p>
        </Card>
      )}
    </div>
  )
}
