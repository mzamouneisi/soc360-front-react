import { tr } from '../i18n/translate'
import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { subscriptionBillingApi } from '../api/subscriptionBilling'
import { useAsync } from '../lib/useAsync'
import { Button, Card, Field, Input, RefreshButton, Select } from '../components/ui'
import { ErrorBlock, LoadingBlock, PageHeader } from '../components/data'
import { dialog } from '../components/dialog'

export function PaymentSettings() {
  const { data: config, loading, error, reload } = useAsync(() => subscriptionBillingApi.config(), [])
  const { data: history, reload: reloadHistory } = useAsync(() => subscriptionBillingApi.configHistory(), [])

  const [form, setForm] = useState({
    cardEnabled: true,
    paypalEnabled: true,
    cardProvider: 'STRIPE',
    cardPublicKey: '',
    cardSecretKey: '',
    cardWebhookSecret: '',
    paypalClientId: '',
    paypalSecret: '',
    paypalMode: 'SANDBOX',
    trialEnabled: true,
    billingEnabled: true,
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
      cardProvider: config.cardProvider,
      cardPublicKey: config.cardPublicKey ?? '',
      cardSecretKey: '',
      cardWebhookSecret: '',
      paypalClientId: config.paypalClientId ?? '',
      paypalSecret: '',
      paypalMode: config.paypalMode,
      trialEnabled: config.trialEnabled,
      billingEnabled: config.billingEnabled,
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
        cardProvider: form.cardProvider,
        cardPublicKey: form.cardPublicKey.trim() || null,
        cardSecretKey: form.cardSecretKey.trim() || null,
        cardWebhookSecret: form.cardWebhookSecret.trim() || null,
        paypalClientId: form.paypalClientId.trim() || null,
        paypalSecret: form.paypalSecret.trim() || null,
        paypalMode: form.paypalMode,
        trialEnabled: form.trialEnabled,
        billingEnabled: form.billingEnabled,
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
            <label id="PaymentSettings.trialEnabled" className="flex items-center gap-2">
              <input
                id="PaymentSettings.trialEnabled.input"
                type="checkbox"
                checked={form.trialEnabled}
                onChange={(event) => setForm({ ...form, trialEnabled: event.target.checked })}
              />
              {tr('PaymentSettings.trialEnabled')}
            </label>
            <p id="PaymentSettings.trialHint" className="ml-6 text-xs text-gray-500">
              {tr('PaymentSettings.trialHint')}
            </p>
            <label id="PaymentSettings.billingEnabled" className="flex items-center gap-2">
              <input
                id="PaymentSettings.billingEnabled.input"
                type="checkbox"
                checked={form.billingEnabled}
                onChange={(event) => setForm({ ...form, billingEnabled: event.target.checked })}
              />
              {tr('PaymentSettings.billingEnabled')}
            </label>
            <p id="PaymentSettings.billingHint" className="ml-6 text-xs text-gray-500">
              {tr('PaymentSettings.billingHint')}
            </p>
          </div>
          <h3 id="PaymentSettings.realConfig" className="text-sm font-semibold text-gray-700">
            {tr('PaymentSettings.realConfig')}
          </h3>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="PaymentSettings.bankDetails" className="text-sm font-semibold text-gray-700">
              {tr('PaymentSettings.bankDetails')}
            </h3>
            {config?.bankSheetUrl && (
              <a
                id="PaymentSettings.bankSheetOpen"
                href={config.bankSheetUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                {tr('PaymentSettings.bankSheetOpen')}
              </a>
            )}
          </div>
          <p id="PaymentSettings.bankSheetSource" className="text-xs text-gray-500">
            {tr('PaymentSettings.bankSheetSource')}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={tr('PaymentSettings.bankAccountHolder')} id="PaymentSettings.bankAccountHolder">
              <Input
                id="PaymentSettings.bankAccountHolder.input"
                value={config?.bankAccountHolder ?? ''}
                disabled
              />
            </Field>
            <Field label={tr('PaymentSettings.bankBic')} id="PaymentSettings.bankBic">
              <Input
                id="PaymentSettings.bankBic.input"
                value={config?.bankBic ?? ''}
                disabled
              />
            </Field>
            <Field label={tr('PaymentSettings.bankRib')} id="PaymentSettings.bankRib">
              <Input
                id="PaymentSettings.bankRib.input"
                value={config?.bankRib ?? ''}
                disabled
              />
            </Field>
            <Field label={tr('PaymentSettings.bankIban')} id="PaymentSettings.bankIban">
              <Input
                id="PaymentSettings.bankIban.input"
                value={config?.bankIban ?? ''}
                disabled
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={tr('PaymentSettings.provider')} id="PaymentSettings.provider">
              <Select
                id="PaymentSettings.provider.input"
                value={form.cardProvider}
                onChange={(event) => setForm({ ...form, cardProvider: event.target.value })}
              >
                <option value="STRIPE">Stripe</option>
                <option value="PAYBOX">Paybox</option>
                <option value="OTHER">Autre</option>
              </Select>
            </Field>
            <Field label={tr('PaymentSettings.cardPublicKey')} id="PaymentSettings.cardPublicKey">
              <Input
                id="PaymentSettings.cardPublicKey.input"
                value={form.cardPublicKey}
                onChange={(event) => setForm({ ...form, cardPublicKey: event.target.value })}
              />
            </Field>
            <Field label={tr('PaymentSettings.cardSecretKey')} id="PaymentSettings.cardSecretKey">
              <Input
                id="PaymentSettings.cardSecretKey.input"
                type="password"
                placeholder={config?.cardSecretConfigured ? tr('PaymentSettings.configured') : tr('PaymentSettings.notConfigured')}
                value={form.cardSecretKey}
                onChange={(event) => setForm({ ...form, cardSecretKey: event.target.value })}
              />
            </Field>
            <Field label={tr('PaymentSettings.cardWebhookSecret')} id="PaymentSettings.cardWebhookSecret">
              <Input
                id="PaymentSettings.cardWebhookSecret.input"
                type="password"
                placeholder={config?.cardWebhookConfigured ? tr('PaymentSettings.configured') : tr('PaymentSettings.notConfigured')}
                value={form.cardWebhookSecret}
                onChange={(event) => setForm({ ...form, cardWebhookSecret: event.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={tr('PaymentSettings.paypalClientId')} id="PaymentSettings.paypalClientId">
              <Input
                id="PaymentSettings.paypalClientId.input"
                value={form.paypalClientId}
                onChange={(event) => setForm({ ...form, paypalClientId: event.target.value })}
              />
            </Field>
            <Field label={tr('PaymentSettings.paypalSecret')} id="PaymentSettings.paypalSecret">
              <Input
                id="PaymentSettings.paypalSecret.input"
                type="password"
                placeholder={config?.paypalSecretConfigured ? tr('PaymentSettings.configured') : tr('PaymentSettings.notConfigured')}
                value={form.paypalSecret}
                onChange={(event) => setForm({ ...form, paypalSecret: event.target.value })}
              />
            </Field>
            <Field label={tr('PaymentSettings.paypalMode')} id="PaymentSettings.paypalMode">
              <Select
                id="PaymentSettings.paypalMode.input"
                value={form.paypalMode}
                onChange={(event) => setForm({ ...form, paypalMode: event.target.value })}
              >
                <option value="SANDBOX">Sandbox</option>
                <option value="LIVE">Live</option>
              </Select>
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
