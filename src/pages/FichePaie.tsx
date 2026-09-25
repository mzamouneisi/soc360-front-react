import { tr } from '../i18n/translate'
import { useRef, useState, useMemo, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { fichePaieApi } from '../api/fichePaie'
import { consultantsApi } from '../api/consultants'
import { ApiError } from '../api/client'
import { useAsync } from '../lib/useAsync'
import { Card, Field, IconButton, InlineButton, Input, RefreshButton, Select, Spinner } from '../components/ui'
import { EmptyState, ErrorBlock, LoadingBlock, Modal, PageHeader, Table } from '../components/data'
import { dialog } from '../components/dialog'
import { formatDate, formatMoney } from '../lib/format'
import type { FichePaieDto } from '../api/types'

interface FormState {
  consultantId: string
  period: string
  grossSalary: string
  netSalary: string
  employerCost: string
  taxes: string
  issuedAt: string
  comment: string
}

const emptyForm: FormState = {
  consultantId: '',
  period: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
  grossSalary: '',
  netSalary: '',
  employerCost: '',
  taxes: '',
  issuedAt: '',
  comment: '',
}

export function FichePaie() {
  const { user } = useAuth()
  const isConsultant = user?.role === 'CONSULTANT'
  const isManager = user?.role === 'MANAGER'
  const canEdit = user?.role === 'ADMIN' || user?.role === 'RESPONSIBLE_SOC' || isManager

  const { data, loading, error, reload, setData } = useAsync(
    () =>
      isConsultant && user?.consultantId
        ? fichePaieApi.findByConsultant(user.consultantId)
        : user?.socId
          ? fichePaieApi.findBySoc(user.socId)
          : Promise.resolve([] as FichePaieDto[]),
    [user?.socId, user?.consultantId, isConsultant],
  )

  const { data: summaries } = useAsync(
    () =>
      isManager
        ? consultantsApi.managed()
        : user?.socId
          ? consultantsApi.summaries(user.socId)
          : Promise.resolve([]),
    [user?.socId, isManager],
  )

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<number | null>(null)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const years = useMemo(() => {
    const ys = new Set<number>()
    for (const fp of data ?? []) {
      const y = Number((fp.period ?? '').slice(0, 4))
      if (Number.isFinite(y) && y > 0) ys.add(y)
    }
    return [...ys].sort((a, b) => b - a)
  }, [data])

  const activeYear = selectedYear ?? years[0] ?? null
  const yearData = useMemo(
    () => (data ?? []).filter((fp) => Number((fp.period ?? '').slice(0, 4)) === activeYear),
    [data, activeYear],
  )

  if (!user) return null

  function openCreate() {
    setForm(emptyForm)
    setFormError(null)
    setModalOpen(true)
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!form.consultantId) {
      setFormError('Sélectionnez un consultant')
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      await fichePaieApi.create({
        consultantId: Number(form.consultantId),
        period: form.period,
        grossSalary: Number(form.grossSalary) || 0,
        netSalary: Number(form.netSalary) || 0,
        employerCost: form.employerCost ? Number(form.employerCost) : null,
        taxes: form.taxes ? Number(form.taxes) : null,
        issuedAt: form.issuedAt || null,
        comment: form.comment || null,
      })
      setModalOpen(false)
      reload()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpload(fp: FichePaieDto) {
    const input = fileRef.current
    if (!input || !input.files?.[0]) {
      void dialog.warning(tr('FichePaie.selectionnez.un.fichier.pdf.a.associer'))
      return
    }
    setUploadingId(fp.id)
    try {
      await fichePaieApi.uploadFile(fp.id, input.files[0])
      reload()
    } catch (err) {
      void dialog.error(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    } finally {
      setUploadingId(null)
      input.value = ''
    }
  }

  async function handleDelete(fp: FichePaieDto) {
    if (!(await dialog.confirm(tr('FichePaie.supprimer.la.fiche', { period: fp.period }), { variant: 'warning', danger: true, okLabel: tr('common.delete') }))) return
    try {
      await fichePaieApi.delete(fp.id)
      setData((prev) => (prev ?? []).filter((x) => x.id !== fp.id))
    } catch (err) {
      void dialog.error(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    }
  }

  const totalNet = (yearData ?? []).reduce((sum, fp) => sum + fp.netSalary, 0)

  return (
    <div>
      <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" />

      <PageHeader
        title={tr('FichePaie.fiches.de.paie')}
        count={(data ?? []).length}
        subtitle={tr('FichePaie.bulletins.de.salaire.par.consultant.et.par.periode')}
        actions={
          <>
            <RefreshButton onClick={reload} />
            {canEdit ? (
              <IconButton icon="add" label={tr('FichePaie.nouvelle.fiche.de.paie')} variant="new" onClick={openCreate} />
            ) : null}
          </>
        }
      />

      <Card className="mb-6 p-5">
        <p className="text-sm font-medium text-gray-500">{tr('FichePaie.total.net')} {activeYear ?? new Date().getFullYear()}</p>
        <p className="mt-2 text-2xl font-bold text-gray-900">{formatMoney(totalNet)}</p>
      </Card>

      {years.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {years.map((y) => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                y === activeYear
                  ? 'bg-brand-600 text-white'
                  : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      )}

      {error && <ErrorBlock message={error} />}
      {loading && <LoadingBlock />}

      {!loading && yearData && yearData.length > 0 && (
        <Table
          paginate
          rowKey={(fp) => fp.id}
          rows={yearData}
          columns={[
            {
              key: 'consultant',
              label: 'Consultant',
              render: (fp) => (
                <span className="font-medium text-gray-900">
                  {fp.consultant
                    ? `${fp.consultant.firstName} ${fp.consultant.lastName}`
                    : '—'}
                </span>
              ),
            },
            {
              key: 'period',
              label: 'Période',
              render: (fp) => <span className="text-gray-700">{fp.period}</span>,
            },
            {
              key: 'gross',
              label: 'Brut',
              render: (fp) => <span>{formatMoney(fp.grossSalary)}</span>,
            },
            {
              key: 'net',
              label: 'Net',
              render: (fp) => <span className="font-semibold text-gray-900">{formatMoney(fp.netSalary)}</span>,
            },
            {
              key: 'cost',
              label: 'Coût employeur',
              render: (fp) => <span>{fp.employerCost != null ? formatMoney(fp.employerCost) : '—'}</span>,
            },
            {
              key: 'issued',
              label: 'Émise le',
              render: (fp) => <span className="text-gray-500">{formatDate(fp.issuedAt)}</span>,
            },
            {
              key: 'actions',
              label: '',
              render: (fp) => (
                <div className="flex justify-end gap-1">
                  <InlineButton onClick={() => fichePaieApi.download(fp.id, fp.period).catch((err) => void dialog.error(err.message))}>
                    PDF
                  </InlineButton>
                  <InlineButton onClick={() => fichePaieApi.pdf(fp.id, fp.period).catch((err) => void dialog.error(err.message))}>
                    Générer
                  </InlineButton>
                  {canEdit && (
                    <>
                      <InlineButton
                        disabled={uploadingId === fp.id}
                        onClick={() => handleUpload(fp)}
                      >
                        {uploadingId === fp.id ? <Spinner /> : 'Associer'}
                      </InlineButton>
                      <IconButton icon="delete" label="Supprimer" variant="danger" onClick={() => handleDelete(fp)} />
                    </>
                  )}
                </div>
              ),
            },
          ]}
        />
      )}

      {!loading && (!yearData || yearData.length === 0) && (
        <EmptyState
          title={tr('FichePaie.aucune.fiche.de.paie')}
          description={canEdit ? 'Ajoutez la première fiche de paie.' : 'Aucune fiche disponible.'}
        />
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={tr('FichePaie.nouvelle.fiche.de.paie')}
        footer={
          <>
            <IconButton icon="cancel" label="Annuler" onClick={() => setModalOpen(false)} />
            <IconButton icon="add" label="Créer" variant="primary" className="w-auto" onClick={handleCreate as never} disabled={submitting} loading={submitting} />
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {formError}
            </div>
          )}
          <Field label={tr('FichePaie.consultant')}>
            <Select
              value={form.consultantId}
              onChange={(e) => setForm({ ...form, consultantId: e.target.value })}
            >
              <option value="">{tr('FichePaie.selectionner')}</option>
              {(summaries ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={tr('FichePaie.periode.aaaa.mm')}>
              <Input
                value={form.period}
                onChange={(e) => setForm({ ...form, period: e.target.value })}
                placeholder="2025-06"
              />
            </Field>
            <Field label={tr('FichePaie.date.d.emission')}>
              <Input type="date" value={form.issuedAt} onChange={(e) => setForm({ ...form, issuedAt: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={tr('FichePaie.salaire.brut')}>
              <Input
                type="number"
                step="0.01"
                value={form.grossSalary}
                onChange={(e) => setForm({ ...form, grossSalary: e.target.value })}
              />
            </Field>
            <Field label={tr('FichePaie.salaire.net')}>
              <Input
                type="number"
                step="0.01"
                value={form.netSalary}
                onChange={(e) => setForm({ ...form, netSalary: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={tr('FichePaie.cout.employeur')}>
              <Input
                type="number"
                step="0.01"
                value={form.employerCost}
                onChange={(e) => setForm({ ...form, employerCost: e.target.value })}
              />
            </Field>
            <Field label={tr('FichePaie.charges.impots')}>
              <Input
                type="number"
                step="0.01"
                value={form.taxes}
                onChange={(e) => setForm({ ...form, taxes: e.target.value })}
              />
            </Field>
          </div>
          <Field label={tr('FichePaie.commentaire')}>
            <Input
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
            />
          </Field>
        </form>
      </Modal>
    </div>
  )
}
