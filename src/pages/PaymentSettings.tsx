import { tr } from '../i18n/translate'
import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { subscriptionBillingApi } from '../api/subscriptionBilling'
import { useAsync } from '../lib/useAsync'
import { Button, Card, Field, Input, RefreshButton } from '../components/ui'
import { ErrorBlock, LoadingBlock, PageHeader } from '../components/data'
import { dialog } from '../components/dialog'

export function PaymentSettings() {
  const { data: config, loading, error, reload } = useAsync(() => subscriptionBillingApi.config(), [])
  const { data: history, reload: reloadHistory } = useAsync(() => subscriptionBillingApi.configHistory(), [])

  const [form, setForm] = useState({
    cardEnabled: true,
    paypalEnabled: true,
    paypalClientId: '',
    currency: 'EUR',
    monthlyPrice: '49.00',
  })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!config) return
    setForm({
      cardEnabled: config.cardEnabled,
      paypalEnabled: config.paypalEnabled,
      paypalClientId: config.paypalClientId ?? '',
      currency: config.currency,
      monthlyPrice: String(config.monthlyPrice),
    })
  }, [config])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      await subscriptionBillingApi.updateConfig({
        cardEnabled: form.cardEnabled,
        paypalEnabled: form.paypalEnabled,
        paypalClientId: form.paypalClientId.trim() || null,
        currency: form.currency.trim().toUpperCase() || 'EUR',
        monthlyPrice: Number(form.monthlyPrice) || 0,
      })
      reload()
      reloadHistory()
      void dialog.success(tr('PaymentSettings.saved'))
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={tr('PaymentSettings.title')}
        titleId="PaymentSettings.title"
        subtitle={tr('PaymentSettings.subtitle')}
        subtitleId="PaymentSettings.subtitle"
        actions={<RefreshButton onClick={reload} />}
      />

      {error && <ErrorBlock id="PaymentSettings.error" message={error} />}
      {loading && <LoadingBlock />}

      <Card id="PaymentSettings.form.card" className="mb-6 p-5">
        <form id="PaymentSettings.form" onSubmit={handleSubmit} className="space-y-4">
          {formError && <p id="PaymentSettings.form.error" className="text-sm text-red-600">{formError}</p>}
          <div className="space-y-2 text-sm text-gray-700">
            <label id="PaymentSettings.card" className="flex items-center gap-2">
              <input
                id="PaymentSettings.card.input"
                type="checkbox"
                checked={form.cardEnabled}
                onChange={(event) => setForm({ ...form, cardEnabled: event.target.checked })}
              />
              {tr('PaymentSettings.card')}
            </label>
            <label id="PaymentSettings.paypal" className="flex items-center gap-2">
              <input
                id="PaymentSettings.paypal.input"
                type="checkbox"
                checked={form.paypalEnabled}
                onChange={(event) => setForm({ ...form, paypalEnabled: event.target.checked })}
              />
              {tr('PaymentSettings.paypal')}
            </label>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={tr('PaymentSettings.paypalClientId')} id="PaymentSettings.paypalClientId">
              <Input
                id="PaymentSettings.paypalClientId.input"
                value={form.paypalClientId}
                onChange={(event) => setForm({ ...form, paypalClientId: event.target.value })}
              />
            </Field>
            <Field label={tr('PaymentSettings.currency')} id="PaymentSettings.currency">
              <Input
                id="PaymentSettings.currency.input"
                value={form.currency}
                onChange={(event) => setForm({ ...form, currency: event.target.value })}
              />
            </Field>
            <Field label={tr('PaymentSettings.monthlyPrice')} id="PaymentSettings.monthlyPrice">
              <Input
                id="PaymentSettings.monthlyPrice.input"
                type="number"
                step="0.01"
                value={form.monthlyPrice}
                onChange={(event) => setForm({ ...form, monthlyPrice: event.target.value })}
              />
            </Field>
          </div>
          <Button id="PaymentSettings.save" type="submit" disabled={saving}>
            {saving ? '...' : tr('common.save')}
          </Button>
        </form>
      </Card>

      <Card id="PaymentSettings.history.card" className="p-5">
        <h3 id="PaymentSettings.history" className="mb-3 text-sm font-semibold text-gray-700">
          {tr('PaymentSettings.history')}
        </h3>
        {(history ?? []).length === 0 ? (
          <p id="PaymentSettings.noHistory" className="text-sm text-gray-500">{tr('PaymentSettings.noHistory')}</p>
        ) : (
          <div className="space-y-2 text-sm text-gray-700">
            {(history ?? []).map((entry) => (
              <div id={`PaymentSettings.history.${entry.id}`} key={entry.id} className="rounded border border-gray-100 px-3 py-2">
                <p id={`PaymentSettings.history.${entry.id}.meta`} className="text-xs text-gray-500">
                  {new Date(entry.changedAt).toLocaleString('fr-FR')} — {entry.changedBy ?? '—'}
                </p>
                <p id={`PaymentSettings.history.${entry.id}.after`} className="mt-1 break-all text-xs text-gray-700">
                  {entry.afterState}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
