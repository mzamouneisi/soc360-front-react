import { tr } from '../i18n/translate'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../api/auth'
import { ApiError } from '../api/client'
import { Alert, Button, Card, Field, Input, Spinner } from '../components/ui'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setSubmitting(true)
    try {
      const response = await authApi.forgotPassword(email)
      setMessage(response.message)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-brand-900 via-brand-800 to-brand-950 p-6">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">{tr('ForgotPassword.mot.de.passe.oublie')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {tr('ForgotPassword.entrez.votre.adresse.e.mail.pour.reinitialiser.votre.mot.de.')}
          </p>
        </div>

        {error && (
          <div className="mb-4">
            <Alert>{error}</Alert>
          </div>
        )}

        {message && (
          <div className="mb-4">
            <Alert variant="success">{message}</Alert>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label={tr('ForgotPassword.adresse.e.mail')}>
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder={tr('ForgotPassword.marie.durand.exemple.fr')}
            />
          </Field>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? <Spinner className="border-white border-t-transparent" /> : null}
            {tr('ForgotPassword.envoyer.le.lien')}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          <Link
            to="/login"
            className="font-medium text-brand-600 hover:text-brand-700"
          >
            {tr('ForgotPassword.retour.a.la.connexion')}
          </Link>
        </p>
      </Card>
    </div>
  )
}
