import { tr } from '../i18n/translate'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../api/auth'
import { ApiError } from '../api/client'
import { Alert, Button, Card, Field, Input, Spinner } from '../components/ui'

export function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!token) {
      setError('Lien de réinitialisation invalide')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }

    setSubmitting(true)
    try {
      await authApi.resetPassword(token, newPassword)
      setSuccess(true)
      setTimeout(() => navigate('/login', { replace: true }), 2000)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inattendue')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-brand-900 via-brand-800 to-brand-950 p-6">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">{tr('ResetPassword.nouveau.mot.de.passe')}</h1>
          <p className="mt-1 text-sm text-gray-500">{tr('ResetPassword.choisissez.un.nouveau.mot.de.passe')}</p>
        </div>

        {!token && (
          <div className="mb-4">
            <Alert>{tr('ResetPassword.le.lien.de.reinitialisation.est.invalide.ou.incomplet')}</Alert>
          </div>
        )}

        {success && (
          <div className="mb-4">
            <Alert variant="success">
              {tr('ResetPassword.mot.de.passe.mis.a.jour.redirection.vers.la.connexion')}
            </Alert>
          </div>
        )}

        {error && (
          <div className="mb-4">
            <Alert>{error}</Alert>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label={tr('ResetPassword.nouveau.mot.de.passe')}>
            <Input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              placeholder="••••••••"
              disabled={success || !token}
            />
          </Field>

          <Field label={tr('ResetPassword.confirmer.le.nouveau.mot.de.passe')}>
            <Input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="••••••••"
              disabled={success || !token}
            />
          </Field>

          <Button type="submit" className="w-full" disabled={submitting || success || !token}>
            {submitting ? <Spinner className="border-white border-t-transparent" /> : null}
            {tr('ResetPassword.reinitialiser')}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          <Link
            to="/login"
            className="font-medium text-brand-600 hover:text-brand-700"
          >
            {tr('ResetPassword.retour.a.la.connexion')}
          </Link>
        </p>
      </Card>
    </div>
  )
}
