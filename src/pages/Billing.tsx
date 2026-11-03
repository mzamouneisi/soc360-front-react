import { tr } from '../i18n/translate'
import { useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { billingApi } from '../api/billing'
import { activitiesApi } from '../api/activities'
import { projectsApi } from '../api/projects'
import { ApiError } from '../api/client'
import { useAsync } from '../lib/useAsync'
import { formatDateTime, formatMoney, monthLabel, monthShort } from '../lib/format'
import { useSoc } from '../soc/SocContext'
import { Card, Field, Input, RefreshButton, Select, Textarea, Button, IconButton } from '../components/ui'
import { MonthPicker } from '../components/MonthPicker'
import { EmptyState, ErrorBlock, LoadingBlock, Modal, PageHeader, Table } from '../components/data'
import { dialog } from '../components/dialog'
import type { BillingDocumentDto, BillingDocumentStatus, BillingDocumentType, BillingLineRequest, BillingSendHistoryDto } from '../api/types'

interface LineForm { description: string; quantity: string; unitPrice: string }

export function Billing() {
  const { user } = useAuth()
  const { selectedSocId } = useSoc()
  const socId = selectedSocId ?? user?.socId ?? null
  const canEdit = user?.role === 'ADMIN' || user?.role === 'RESPONSIBLE_SOC' || user?.role === 'MANAGER'

  const now = new Date()
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [generateMonth, setGenerateMonth] = useState(currentPeriod)
  const [revenueYear, setRevenueYear] = useState(now.getFullYear())
  const [chartScale, setChartScale] = useState(100)
  const [typeFilter, setTypeFilter] = useState<'ALL' | BillingDocumentType>('ALL')
  const [missionFilter, setMissionFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const { data, loading, error, reload, setData } = useAsync(
    () => billingApi.list(socId, typeFilter === 'ALL' ? undefined : typeFilter),
    [socId, typeFilter],
  )
  const { data: projects } = useAsync(
    () => (socId ? projectsApi.findAll({ socId }) : Promise.resolve([])),
    [socId],
  )
  const { data: activities } = useAsync(
    () => (socId ? activitiesApi.findAll({ socId }) : Promise.resolve([])),
    [socId],
  )
  const { data: generateMonths, reload: reloadGenerateMonths } = useAsync(
    () => (socId ? billingApi.generateMonths(socId) : Promise.resolve([])),
    [socId],
  )
  const selectedGenerateMonth =
    (generateMonths ?? []).some((m) => m.period === generateMonth)
      ? generateMonth
      : (generateMonths ?? [])[0]?.period ?? generateMonth
  const selectedMonthInfo = (generateMonths ?? []).find((m) => m.period === selectedGenerateMonth)

  const filtered = (data ?? []).filter((d) => {
    if (missionFilter && String(d.projectId ?? '') !== missionFilter) return false
    if (dateFilter && !d.issueDate.startsWith(dateFilter)) return false
    return true
  })

  const dashboard = useMemo(() => {
    const docs = data ?? []
    const total = (arr: BillingDocumentDto[]) => arr.reduce((sum, d) => sum + (d.totalTtc ?? 0), 0)
    const quotes = docs.filter((d) => d.type === 'QUOTE')
    const invoices = docs.filter((d) => d.type === 'INVOICE')
    const paid = invoices.filter((d) => d.status === 'PAID')
    const pending = invoices.filter((d) => d.status === 'DRAFT' || d.status === 'SENT')
    return {
      quoteCount: quotes.length,
      quoteTotal: total(quotes),
      invoiceCount: invoices.length,
      invoiceTotal: total(invoices),
      paidCount: paid.length,
      paidTotal: total(paid),
      pendingCount: pending.length,
      pendingTotal: total(pending),
    }
  }, [data])

  const revenue = useMemo(() => {
    const invoices = (data ?? []).filter((d) => d.type === 'INVOICE' && d.issueDate)
    const years = Array.from(new Set(invoices.map((d) => Number(d.issueDate.slice(0, 4))))).sort((a, b) => b - a)
    const monthly = Array.from({ length: 12 }, (_, index) => {
      const month = index + 1
      const total = invoices
        .filter((d) => Number(d.issueDate.slice(0, 4)) === revenueYear && Number(d.issueDate.slice(5, 7)) === month)
        .reduce((sum, d) => sum + (d.totalTtc ?? 0), 0)
      return { month, total }
    })
    const yearly = years.map((year) => ({
      year,
      total: invoices
        .filter((d) => Number(d.issueDate.slice(0, 4)) === year)
        .reduce((sum, d) => sum + (d.totalTtc ?? 0), 0),
    }))
    const max = Math.max(1, ...monthly.map((m) => m.total))
    const availableYears = Array.from(new Set([revenueYear, ...years])).sort((a, b) => b - a)
    return { monthly, yearly, max, availableYears }
  }, [data, revenueYear])
  const cappedScale = Math.min(chartScale, 90)

  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [form, setForm] = useState({
    type: 'QUOTE' as BillingDocumentType,
    projectId: '',
    activityId: '',
    notes: '',
    discount: '',
    vatRate: '20',
    status: 'DRAFT' as BillingDocumentStatus,
  })
  const [formLines, setFormLines] = useState<LineForm[]>([{ description: '', quantity: '1', unitPrice: '0' }])

  const [viewing, setViewing] = useState<BillingDocumentDto | null>(null)
  const [viewSaving, setViewSaving] = useState(false)
  const [viewError, setViewError] = useState<string | null>(null)
  const [editStatus, setEditStatus] = useState<BillingDocumentStatus>('DRAFT')
  const [editActivityId, setEditActivityId] = useState('')
  const [sendHistory, setSendHistory] = useState<BillingSendHistoryDto[]>([])
  const [sendDoc, setSendDoc] = useState<BillingDocumentDto | null>(null)
  const [sendPreview, setSendPreview] = useState<{ recipient: string; subject: string; body: string } | null>(null)
  const [sendPdfUrl, setSendPdfUrl] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [editVat, setEditVat] = useState('20')
  const [editDiscount, setEditDiscount] = useState('0')
  const [editNotes, setEditNotes] = useState('')
  const [editLines, setEditLines] = useState<LineForm[]>([])

  function resetForm() {
    setForm({ type: 'QUOTE', projectId: '', activityId: '', notes: '', discount: '', vatRate: '20', status: 'DRAFT' })
    setFormLines([{ description: '', quantity: '1', unitPrice: '0' }])
    setFormError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!formLines.some((l) => l.description.trim())) {
      setFormError('Au moins une ligne requise')
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      const created = await billingApi.create({
        socId,
        projectId: form.projectId ? Number(form.projectId) : null,
        activityId: form.activityId ? Number(form.activityId) : null,
        type: form.type,
        status: form.status,
        vatRate: Number(form.vatRate) || 20,
        discount: Number(form.discount) || 0,
        notes: form.notes || undefined,
        lines: formLines
          .filter((l) => l.description.trim())
          .map((l) => ({
            description: l.description.trim(),
            quantity: Number(l.quantity) || 1,
            unitPrice: Number(l.unitPrice) || 0,
          })),
      })
      setData((prev) => (prev ? [created, ...prev] : [created]))
      setModalOpen(false)
      resetForm()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(doc: BillingDocumentDto) {
    const ok = await dialog.confirm('Supprimer ce document ?')
    if (!ok) return
    try {
      await billingApi.delete(doc.id)
      setData((prev) => (prev ? prev.filter((d) => d.id !== doc.id) : prev))
      if (viewing?.id === doc.id) setViewing(null)
    } catch (err) {
      void dialog.error(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    }
  }

  async function handleGenerateMonthly() {
    if (!socId || !selectedGenerateMonth) return
    const year = Number(selectedGenerateMonth.slice(0, 4))
    const month = Number(selectedGenerateMonth.slice(5, 7))
    const overwrite = selectedMonthInfo?.alreadyGenerated ?? false
    const message = overwrite
      ? `Des factures existent déjà pour ${month}/${year}. Voulez-vous les écraser ?`
      : `Générer les factures des missions en régie pour ${month}/${year} ?`
    const ok = await dialog.confirm(message)
    if (!ok) return
    try {
      const created = await billingApi.generateMonthly(year, month, socId, overwrite)
      if (overwrite) {
        reload()
      } else if (created.length > 0) {
        setData((prev) => [...created, ...(prev ?? [])])
      }
      reloadGenerateMonths()
      dialog.success(`${created.length} facture(s) générée(s)`)
    } catch (err) {
      void dialog.error(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    }
  }

  async function openPdf(doc: BillingDocumentDto) {
    const target = window.open('', '_blank')
    try {
      const url = await billingApi.pdfUrl(doc.id)
      if (target) {
        target.location.href = url
      } else {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      target?.close()
      void dialog.error(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    }
  }

  function closeSend() {
    setSendDoc(null)
    setSendPreview(null)
    if (sendPdfUrl) {
      URL.revokeObjectURL(sendPdfUrl)
    }
    setSendPdfUrl(null)
  }

  async function openSend(doc: BillingDocumentDto) {
    try {
      const [preview, url] = await Promise.all([
        billingApi.sendPreview(doc.id),
        billingApi.pdfUrl(doc.id),
      ])
      setSendDoc(doc)
      setSendPreview(preview)
      setSendPdfUrl(url)
    } catch (err) {
      void dialog.error(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    }
  }

  async function confirmSend() {
    if (!sendDoc || !sendPreview) return
    setSending(true)
    try {
      const updated = await billingApi.send(sendDoc.id)
      setData((prev) => (prev ? prev.map((d) => (d.id === updated.id ? updated : d)) : [updated]))
      if (viewing?.id === updated.id) {
        setViewing(updated)
        setSendHistory(await billingApi.sendHistory(updated.id))
      }
      dialog.success('Document envoyé au client')
      closeSend()
    } catch (err) {
      void dialog.error(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    } finally {
      setSending(false)
    }
  }

  function openView(doc: BillingDocumentDto) {
    setViewing(doc)
    setSendHistory([])
    void billingApi.sendHistory(doc.id).then(setSendHistory).catch(() => setSendHistory([]))
    setViewError(null)
    setEditStatus(doc.status)
    setEditActivityId(doc.activityId ? String(doc.activityId) : '')
    setEditVat(String(doc.vatRate))
    setEditDiscount(String(doc.discount))
    setEditNotes(doc.notes ?? '')
    setEditLines(doc.lines.map((l) => ({ description: l.description, quantity: String(l.quantity), unitPrice: String(l.unitPrice) })))
  }

  async function handleViewSave() {
    if (!viewing) return
    setViewSaving(true)
    setViewError(null)
    try {
      const lines: BillingLineRequest[] = editLines
        .filter((l) => l.description.trim())
        .map((l) => ({
          description: l.description.trim(),
          quantity: Number(l.quantity) || 1,
          unitPrice: Number(l.unitPrice) || 0,
        }))
      const updated = await billingApi.update(viewing.id, {
        status: editStatus,
        activityId: editActivityId ? Number(editActivityId) : null,
        vatRate: Number(editVat) || 20,
        discount: Number(editDiscount) || 0,
        notes: editNotes || undefined,
        lines,
      })
      setData((prev) => (prev ? prev.map((d) => (d.id === updated.id ? updated : d)) : [updated]))
      setViewing(updated)
    } catch (err) {
      setViewError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    } finally {
      setViewSaving(false)
    }
  }

  async function handleConvertToInvoice(doc: BillingDocumentDto) {
    if (!socId) return
    try {
      const created = await billingApi.create({
        socId,
        projectId: doc.projectId,
        consultantId: doc.consultantId,
        parentQuoteId: doc.id,
        type: 'INVOICE',
        vatRate: doc.vatRate,
        discount: doc.discount,
        notes: doc.notes || undefined,
        lines: doc.lines.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
      })
      setData((prev) => (prev ? [created, ...prev] : [created]))
      dialog.success?.('Facture créée')
    } catch (err) {
      void dialog.error(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    }
  }

  return (
    <div>
      <PageHeader
        title="Devis & Factures"
        titleId="Billing.title"
        actions={
          <div className="flex items-end gap-2">
            <RefreshButton onClick={reload} />
            {canEdit && (generateMonths ?? []).length > 0 && (
              <Field label="Mois à facturer" id="Billing.generateMonth.label">
                <Select id="Billing.generateMonth" className="w-auto" value={selectedGenerateMonth} onChange={(e) => setGenerateMonth(e.target.value)}>
                  {(generateMonths ?? []).map((m) => (
                    <option key={m.period} value={m.period}>
                      {monthLabel(Number(m.period.slice(5, 7)))} {m.period.slice(0, 4)}
                      {m.alreadyGenerated ? ' *' : ''}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {canEdit && (
              <IconButton icon="save" variant="primary" label="Générer les factures du mois sélectionné" id="Billing.generateMonthly" onClick={handleGenerateMonthly} />
            )}
            {canEdit && (
              <IconButton icon="add" variant="new" label="Nouveau" id="Billing.new" onClick={() => { resetForm(); setModalOpen(true) }} />
            )}
          </div>
        }
      />

      <div className="mb-4 flex w-fit items-end gap-2">
        <Field label="Type" id="Billing.typeFilter.label">
          <Select id="Billing.typeFilter" className="w-[50px]" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as 'ALL' | BillingDocumentType)}>
            <option value="ALL">Tous</option>
            <option value="QUOTE">Devis</option>
            <option value="INVOICE">Factures</option>
          </Select>
        </Field>
        <Field label="Mission" id="Billing.missionFilter.label">
          <Select id="Billing.missionFilter" className="w-[100px]" value={missionFilter} onChange={(e) => setMissionFilter(e.target.value)}>
            <option value="">Toutes missions</option>
            {(projects ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Date" id="Billing.dateFilter.label">
          <div className="w-fit [&_.react-datepicker-wrapper]:!w-auto">
            <MonthPicker id="Billing.dateFilter" className="w-auto" value={dateFilter} onChange={(value) => setDateFilter(value)} placeholder="Tous les mois" />
          </div>
        </Field>
      </div>

      {error && <ErrorBlock id="Billing.error" message={error} />}
      {loading && <LoadingBlock />}

      {!loading && filtered.length === 0 && (
        <EmptyState title="Aucun document" titleId="Billing.empty" />
      )}

      {!loading && filtered.length > 0 && (
        <Table
          paginate
          rowKey={(d) => d.id}
          rows={filtered}
          onRowClick={(d) => openView(d)}
          columns={[
            { key: 'number', label: 'Numéro', render: (d) => <span id={`Billing.row.${d.id}.number`}>{d.number}</span> },
            { key: 'type', label: 'Type', render: (d) => <span id={`Billing.row.${d.id}.type`}>{d.type === 'QUOTE' ? 'Devis' : 'Facture'}</span> },
            { key: 'project', label: 'Mission', render: (d) => <span id={`Billing.row.${d.id}.project`}>{d.projectName ?? '—'}</span> },
            { key: 'date', label: 'Date', render: (d) => <span id={`Billing.row.${d.id}.date`}>{d.issueDate}</span> },
            { key: 'ht', label: 'HT', render: (d) => <span id={`Billing.row.${d.id}.ht`}>{d.totalHt}</span> },
            { key: 'ttc', label: 'TTC', render: (d) => <span id={`Billing.row.${d.id}.ttc`}>{d.totalTtc}</span> },
            { key: 'sentAt', label: 'Envoyé le', render: (d) => <span id={`Billing.row.${d.id}.sentAt`}>{formatDateTime(d.sentToClientAt)}</span> },
            { key: 'sendCount', label: 'Envois', render: (d) => <span id={`Billing.row.${d.id}.sendCount`}>{d.sendCount}</span> },
            {
              key: 'actions',
              label: '',
              render: (d) => canEdit ? (
                <div className="flex items-center gap-1">
                  <IconButton icon="print" variant="neutral" label="Générer le PDF" id={`Billing.row.${d.id}.pdf`} onClick={(e) => { e.stopPropagation(); openPdf(d) }} />
                  <IconButton icon="send" variant="primary" label="Envoyer par email" id={`Billing.row.${d.id}.send`} onClick={(e) => { e.stopPropagation(); openSend(d) }} />
                  <IconButton icon="delete" variant="danger" label="Supprimer" id={`Billing.row.${d.id}.delete`} onClick={(e) => { e.stopPropagation(); handleDelete(d) }} />
                </div>
              ) : null,
            },
          ]}
        />
      )}

      {!loading && (data ?? []).length > 0 && (
        <div className="mt-8">
          <h3 id="Billing.dashboard.title" className="mb-3 text-lg font-semibold text-gray-900">
            Tableau de bord
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card id="Billing.dashboard.quotes" className="p-5">
              <p id="Billing.dashboard.quotes.label" className="text-sm font-medium text-gray-500">Devis</p>
              <p id="Billing.dashboard.quotes.count" className="mt-2 text-2xl font-bold text-gray-900">{dashboard.quoteCount}</p>
              <p id="Billing.dashboard.quotes.total" className="mt-1 text-xs text-gray-500">{formatMoney(dashboard.quoteTotal)}</p>
            </Card>
            <Card id="Billing.dashboard.invoices" className="p-5">
              <p id="Billing.dashboard.invoices.label" className="text-sm font-medium text-gray-500">Factures</p>
              <p id="Billing.dashboard.invoices.count" className="mt-2 text-2xl font-bold text-gray-900">{dashboard.invoiceCount}</p>
              <p id="Billing.dashboard.invoices.total" className="mt-1 text-xs text-gray-500">{formatMoney(dashboard.invoiceTotal)}</p>
            </Card>
            <Card id="Billing.dashboard.paid" className="p-5">
              <p id="Billing.dashboard.paid.label" className="text-sm font-medium text-gray-500">Factures payées</p>
              <p id="Billing.dashboard.paid.count" className="mt-2 text-2xl font-bold text-gray-900">{dashboard.paidCount}</p>
              <p id="Billing.dashboard.paid.total" className="mt-1 text-xs text-gray-500">{formatMoney(dashboard.paidTotal)}</p>
            </Card>
            <Card id="Billing.dashboard.pending" className="p-5">
              <p id="Billing.dashboard.pending.label" className="text-sm font-medium text-gray-500">Factures en attente</p>
              <p id="Billing.dashboard.pending.count" className="mt-2 text-2xl font-bold text-gray-900">{dashboard.pendingCount}</p>
              <p id="Billing.dashboard.pending.total" className="mt-1 text-xs text-gray-500">{formatMoney(dashboard.pendingTotal)}</p>
            </Card>
          </div>

          <Card id="Billing.revenue.chart" className="mt-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 id="Billing.revenue.chart.title" className="text-sm font-semibold text-gray-700">
                Chiffre d'affaires facturé
              </h4>
              <Select id="Billing.revenue.year" className="w-auto" value={revenueYear} onChange={(e) => setRevenueYear(Number(e.target.value))}>
                {revenue.availableYears.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </Select>
            </div>
            <div className="mt-4 flex h-48 items-stretch gap-2">
              {revenue.monthly.map((entry) => {
                const heightPct = revenue.max > 0 ? (entry.total / revenue.max) * cappedScale : 0
                return (
                  <div key={entry.month} className="flex flex-1 flex-col items-center gap-1">
                    <div className="relative flex w-full flex-1 items-end">
                      <div
                        id={`Billing.revenue.month.${entry.month}`}
                        title={formatMoney(entry.total)}
                        className="w-full rounded-t bg-brand-500"
                        style={{ height: `${heightPct}%`, minHeight: entry.total > 0 ? '2px' : '0' }}
                      />
                      <span
                        id={`Billing.revenue.month.${entry.month}.amount`}
                        className="absolute inset-x-0 text-center text-[10px] font-medium text-gray-600"
                        style={{ bottom: `calc(${heightPct}% + 2px)` }}
                      >
                        {formatMoney(entry.total)}
                      </span>
                    </div>
                    <span id={`Billing.revenue.month.${entry.month}.label`} className="text-[10px] text-gray-500">
                      {monthShort(entry.month)}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <label id="Billing.revenue.scale.label" htmlFor="Billing.revenue.scale" className="text-sm font-medium text-gray-700">
                Échelle
              </label>
              <input
                id="Billing.revenue.scale"
                type="range"
                min={25}
                max={200}
                step={5}
                value={chartScale}
                onChange={(e) => setChartScale(Number(e.target.value))}
                className="h-2 flex-1 cursor-pointer accent-brand-500"
              />
              <span id="Billing.revenue.scale.value" className="w-12 text-right text-xs text-gray-500">{chartScale}%</span>
            </div>
            {revenue.yearly.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
                {revenue.yearly.map((entry) => (
                  <span id={`Billing.revenue.year.${entry.year}`} key={entry.year}>
                    {entry.year} : <strong className="text-gray-900">{formatMoney(entry.total)}</strong>
                  </span>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={[form.type === 'QUOTE' ? 'Nouveau devis' : 'Nouvelle facture', (projects ?? []).find((p) => String(p.id) === form.projectId)?.name].filter(Boolean).join(' - ')}
        size="2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          {formError && <p id="Billing.formError" className="text-red-600 text-sm">{formError}</p>}
          <div className="grid grid-cols-5 gap-2">
            <Field label="Type">
              <Select id="Billing.form.type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as BillingDocumentType })}>
                <option value="QUOTE">Devis</option>
                <option value="INVOICE">Facture</option>
              </Select>
            </Field>
            <Field label="Mission">
              <Select id="Billing.form.project" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
                <option value="">—</option>
                {(projects ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Statut">
              <Select id="Billing.form.status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as BillingDocumentStatus })}>
                <option value="DRAFT">Brouillon</option>
                <option value="SENT">Envoyé</option>
                <option value="ACCEPTED">Accepté</option>
                <option value="REJECTED">Rejeté</option>
                <option value="PAID">Payé</option>
                <option value="CANCELLED">Annulé</option>
              </Select>
            </Field>
            <Field label="TVA %">
              <Input id="Billing.form.vat" type="number" value={form.vatRate} onChange={(e) => setForm({ ...form, vatRate: e.target.value })} />
            </Field>
            <Field label="Remise">
              <Input id="Billing.form.discount" type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
            </Field>
          </div>
          <Field label="Activité" id="Billing.form.activity.label">
            <Select id="Billing.form.activity" value={form.activityId} onChange={(e) => setForm({ ...form, activityId: e.target.value })}>
              <option value="">—</option>
              {(activities ?? []).map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </Field>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Lignes</label>
            <div className="grid grid-cols-12 gap-2 text-sm font-medium text-gray-700">
              <label className="col-span-1 block text-sm font-medium text-gray-700">#</label>
              <label className="col-span-5 block text-sm font-medium text-gray-700">Description</label>
              <label className="col-span-2 block text-sm font-medium text-gray-700">Qté</label>
              <label className="col-span-2 block text-sm font-medium text-gray-700">Prix HT</label>
              <label className="col-span-1 block text-sm font-medium text-gray-700">Total ligne</label>
              <label className="col-span-1 block text-sm font-medium text-gray-700"></label>
            </div>
            {formLines.map((l, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2">
                <div className="col-span-1 flex items-center text-sm">{idx + 1}</div>
                <div className="col-span-5">
                  <Textarea id={`Billing.form.line.${idx}.desc`} rows={2} value={l.description} onChange={(e) => {
                    const next = [...formLines]; next[idx] = { ...l, description: e.target.value }; setFormLines(next)
                  }} />
                </div>
                <div className="col-span-2">
                  <Input id={`Billing.form.line.${idx}.qty`} type="number" value={l.quantity} onChange={(e) => {
                    const next = [...formLines]; next[idx] = { ...l, quantity: e.target.value }; setFormLines(next)
                  }} />
                </div>
                <div className="col-span-2">
                  <Input id={`Billing.form.line.${idx}.price`} type="number" value={l.unitPrice} onChange={(e) => {
                    const next = [...formLines]; next[idx] = { ...l, unitPrice: e.target.value }; setFormLines(next)
                  }} />
                </div>
                <div className="col-span-1 flex items-center text-sm">
                  {((Number(l.quantity) || 0) * (Number(l.unitPrice) || 0)).toFixed(2)}
                </div>
                <div className="col-span-1 flex items-center">
                  <IconButton icon="delete" variant="danger" label="Supprimer la ligne" id={`Billing.form.line.${idx}.remove`} onClick={async () => { if (await dialog.confirm('Supprimer cette ligne ?')) setFormLines(formLines.filter((_, i) => i !== idx)) }} />
                </div>
              </div>
            ))}
          </div>
          <IconButton icon="add" variant="new" label="Ajouter une ligne" id="Billing.form.addLine" onClick={() => setFormLines([...formLines, { description: '', quantity: '1', unitPrice: '0' }])} />
          <div className="mt-4 flex flex-col items-end gap-1 text-sm font-semibold">
            {(() => {
              const sub = formLines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0)
              const discount = Number(form.discount) || 0
              const ht = Math.max(0, sub - discount)
              const ttc = ht * (1 + (Number(form.vatRate) || 0) / 100)
              return (
                <>
                  <span>Total HT: {ht.toFixed(2)}</span>
                  <span>Total TTC: {ttc.toFixed(2)}</span>
                </>
              )
            })()}
          </div>
          <Field label="Notes">
            <Textarea id="Billing.form.notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2">
            <IconButton icon="cancel" variant="neutral" label="Annuler" id="Billing.form.cancel" onClick={() => setModalOpen(false)} />
            <IconButton icon="save" variant="primary" label="Créer" id="Billing.form.submit" type="submit" loading={submitting} disabled={submitting} />
          </div>
        </form>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing ? [`${viewing.type === "QUOTE" ? "Devis" : "Facture"} - ${viewing.number}`, viewing.projectName, viewing.clientName, viewing.location].filter(Boolean).join(' - ') : "Document"} size="2xl">
        {viewing && (
          <div className="space-y-3">
            {viewError && <p id="Billing.viewError" className="text-red-600 text-sm">{viewError}</p>}
            <div className="grid grid-cols-3 gap-2">
              <Field label="Statut">
                <Select id="Billing.view.status" value={editStatus} onChange={(e) => setEditStatus(e.target.value as BillingDocumentStatus)}>
                  <option value="DRAFT">Brouillon</option>
                  <option value="SENT">Envoyé</option>
                  <option value="ACCEPTED">Accepté</option>
                  <option value="REJECTED">Rejeté</option>
                  <option value="PAID">Payé</option>
                  <option value="CANCELLED">Annulé</option>
                </Select>
              </Field>
              <Field label="TVA %">
                <Input id="Billing.view.vat" type="number" value={editVat} onChange={(e) => setEditVat(e.target.value)} />
              </Field>
              <Field label="Remise">
                <Input id="Billing.view.discount" type="number" value={editDiscount} onChange={(e) => setEditDiscount(e.target.value)} />
              </Field>
            </div>
            <Field label="Activité" id="Billing.view.activity.label">
              <Select id="Billing.view.activity" value={editActivityId} onChange={(e) => setEditActivityId(e.target.value)}>
                <option value="">—</option>
                {(activities ?? []).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Select>
            </Field>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Lignes</label>
              {editLines.length > 0 && (
                <div className="grid grid-cols-12 gap-2 text-sm font-medium text-gray-700">
                  <label className="col-span-1 block text-sm font-medium text-gray-700">#</label>
                  <label className="col-span-5 block text-sm font-medium text-gray-700">Description</label>
                  <label className="col-span-2 block text-sm font-medium text-gray-700">Qté</label>
                  <label className="col-span-2 block text-sm font-medium text-gray-700">Prix HT</label>
                  <label className="col-span-1 block text-sm font-medium text-gray-700">Total ligne</label>
                  <label className="col-span-1 block text-sm font-medium text-gray-700"></label>
                </div>
              )}
              {editLines.map((l, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2">
                  <div className="col-span-1 flex items-center text-sm">{idx + 1}</div>
                  <div className="col-span-5">
                    <Textarea id={`Billing.view.line.${idx}.desc`} rows={2} value={l.description} onChange={(e) => {
                      const next = [...editLines]; next[idx] = { ...l, description: e.target.value }; setEditLines(next)
                    }} />
                  </div>
                  <div className="col-span-2">
                    <Input id={`Billing.view.line.${idx}.qty`} type="number" value={l.quantity} onChange={(e) => {
                      const next = [...editLines]; next[idx] = { ...l, quantity: e.target.value }; setEditLines(next)
                    }} />
                  </div>
                  <div className="col-span-2">
                    <Input id={`Billing.view.line.${idx}.price`} type="number" value={l.unitPrice} onChange={(e) => {
                      const next = [...editLines]; next[idx] = { ...l, unitPrice: e.target.value }; setEditLines(next)
                    }} />
                  </div>
                  <div className="col-span-1 flex items-center text-sm">
                    {((Number(l.quantity) || 0) * (Number(l.unitPrice) || 0)).toFixed(2)}
                  </div>
                  <div className="col-span-1 flex items-center">
                    <IconButton icon="delete" variant="danger" label="Supprimer la ligne" id={`Billing.view.line.${idx}.remove`} onClick={async () => { if (await dialog.confirm('Supprimer cette ligne ?')) setEditLines(editLines.filter((_, i) => i !== idx)) }} />
                  </div>
                </div>
              ))}
              <IconButton icon="add" variant="new" label="Ajouter une ligne" id="Billing.view.addLine" onClick={() => setEditLines([...editLines, { description: '', quantity: '1', unitPrice: '0' }])} />
              {editLines.length > 0 && (
                <div className="mt-4 flex flex-col items-end gap-1 text-sm font-semibold">
                  {(() => {
                    const sub = editLines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0)
                    const discount = Number(editDiscount) || 0
                    const ht = Math.max(0, sub - discount)
                    const ttc = ht * (1 + (Number(editVat) || 0) / 100)
                    return (
                      <>
                        <span>Total HT: {ht.toFixed(2)}</span>
                        <span>Total TTC: {ttc.toFixed(2)}</span>
                      </>
                    )
                  })()}
                </div>
              )}
            </div>
            <Field label="Notes">
              <Textarea id="Billing.view.notes" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
            </Field>
            <div id="Billing.view.sendHistory" className="rounded-lg border border-gray-200 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span id="Billing.view.sendHistory.title" className="font-medium text-gray-700">Historique des envois</span>
                <span id="Billing.view.sendHistory.count" className="text-xs text-gray-500">{viewing.sendCount} envoi(s)</span>
              </div>
              {viewing.sentToClientAt && (
                <p id="Billing.view.sendHistory.last" className="mt-1 text-xs text-gray-500">
                  Dernier envoi : {formatDateTime(viewing.sentToClientAt)}
                </p>
              )}
              <ul className="mt-2 space-y-1">
                {sendHistory.map((entry) => (
                  <li id={`Billing.view.sendHistory.${entry.id}`} key={entry.id} className="text-xs text-gray-600">
                    {formatDateTime(entry.sentAt)} — {entry.recipient}
                    {entry.subject ? ` — ${entry.subject}` : ''}
                  </li>
                ))}
                {sendHistory.length === 0 && (
                  <li id="Billing.view.sendHistory.empty" className="text-xs text-gray-400">Aucun envoi</li>
                )}
              </ul>
            </div>
            <div className="flex justify-between gap-2">
              {viewing.type === 'QUOTE' && canEdit && (
                <Button type="button" id="Billing.view.convert" onClick={() => handleConvertToInvoice(viewing)}>Créer facture</Button>
              )}
              <div className="flex gap-2 ml-auto">
                <IconButton icon="print" variant="neutral" label="Générer le PDF" id="Billing.view.pdf" onClick={() => openPdf(viewing)} />
                <IconButton icon="send" variant="primary" label="Envoyer par email" id="Billing.view.send" onClick={() => openSend(viewing)} />
                {canEdit && viewing.type === 'QUOTE' && (
                  <IconButton icon="delete" variant="danger" label="Supprimer" id="Billing.view.delete" onClick={() => handleDelete(viewing)} />
                )}
                <IconButton icon="cancel" variant="neutral" label="Fermer" id="Billing.view.cancel" onClick={() => setViewing(null)} />
                {canEdit && (
                  <IconButton icon="save" variant="primary" label="Enregistrer" id="Billing.view.save" onClick={handleViewSave} loading={viewSaving} disabled={viewSaving} />
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!sendDoc} onClose={closeSend} title="Confirmer l'envoi par email" size="2xl">
        {sendDoc && sendPreview && (
          <div className="space-y-3">
            <Field label="Email du client" id="Billing.send.recipient.label">
              <Input id="Billing.send.recipient" value={sendPreview.recipient} readOnly />
            </Field>
            <Field label="Sujet" id="Billing.send.subject.label">
              <Input id="Billing.send.subject" value={sendPreview.subject} readOnly />
            </Field>
            <Field label="Corps du mail" id="Billing.send.body.label">
              <Textarea
                id="Billing.send.body"
                rows={4}
                value={sendPreview.body.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')}
                readOnly
              />
            </Field>
            <div>
              <p id="Billing.send.preview.label" className="mb-1 text-sm font-medium text-gray-700">Aperçu du PDF</p>
              {sendPdfUrl && (
                <iframe id="Billing.send.preview" src={sendPdfUrl} title="Aperçu du PDF" className="h-80 w-full rounded border border-gray-200" />
              )}
            </div>
            <div className="flex justify-end gap-2">
              <IconButton icon="cancel" variant="neutral" label="Annuler" id="Billing.send.cancel" onClick={closeSend} />
              <IconButton icon="send" variant="primary" label="Envoyer" id="Billing.send.confirm" onClick={confirmSend} loading={sending} disabled={sending} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}