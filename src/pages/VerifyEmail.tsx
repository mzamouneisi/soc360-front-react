import { tr } from '../i18n/translate'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../api/auth'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { setToken } from '../auth/token'
import { Alert, Button, Card, Field, Input, Spinner } from '../components/ui'

export function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()
  const { setUser } = useAuth()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendEmail, setResendEmail] = useState('')
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const [resending, setResending] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!token) {
      setError('Lien de validation invalide ou incomplet.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }

    setSubmitting(true)
    try {
      const response = await authApi.verifyEmail(token, currentPassword, newPassword)
      setToken(response.token)
      setUser(response.user)
      setSuccess(true)
      setTimeout(() => navigate('/', { replace: true }), 1500)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inattendue')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResend(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setResendMessage(null)
    setResending(true)
    try {
      const response = await authApi.resendVerification(resendEmail)
      setResendMessage(response.message)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inattendue')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-brand-900 via-brand-800 to-brand-950 p-6">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-xl font-extrabold text-white">
            {tr('VerifyEmail.e')}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{tr('VerifyEmail.validation.de.l.inscription')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {tr('VerifyEmail.confirmez.votre.mot.de.passe.et.choisissez.en.un.nouveau.pou')}
          </p>
        </div>

        {success && (
          <Alert variant="success">
            {tr('VerifyEmail.votre.inscription.est.validee.votre.compte.est.active.redire')}
          </Alert>
        )}

        {error && (
          <div className="mb-4">
            <Alert>{error}</Alert>
          </div>
        )}

        {!token && (
          <div className="mb-4">
            <Alert>{tr('VerifyEmail.le.lien.de.validation.est.invalide.ou.incomplet')}</Alert>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label={tr('VerifyEmail.mot.de.passe.actuel.utilise.a.l.inscription')}>
            <Input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              disabled={success || !token}
              placeholder="••••••••"
            />
          </Field>

          <Field label={tr('VerifyEmail.nouveau.mot.de.passe')}>
            <Input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              disabled={success || !token}
              placeholder="••••••••"
            />
          </Field>

          <Field label={tr('VerifyEmail.confirmer.le.nouveau.mot.de.passe')}>
            <Input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={success || !token}
              placeholder="••••••••"
            />
          </Field>

          <Button type="submit" className="w-full" disabled={submitting || success || !token}>
            {submitting ? <Spinner className="border-white border-t-transparent" /> : null}
            {tr('VerifyEmail.valider.mon.inscription')}
          </Button>
        </form>

        <div className="mt-6">
          <p className="text-sm font-medium text-gray-700">{tr('VerifyEmail.lien.expire.renvoyez.un.email')}</p>
          <form onSubmit={handleResend} className="mt-2 space-y-2">
            <Input
              type="email"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              required
              placeholder={tr('VerifyEmail.marie.durand.exemple.fr')}
            />
            {resendMessage && <Alert variant="success">{resendMessage}</Alert>}
            <Button type="submit" className="!w-auto !bg-gray-100 !text-gray-700 hover:!bg-gray-200" disabled={resending}>
              {resending ? <Spinner /> : null}
              {tr('VerifyEmail.renvoyer.l.email.de.validation')}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-gray-600">
          <Link
            to="/login"
            className="font-medium text-brand-600 hover:text-brand-700"
          >
            {tr('VerifyEmail.aller.a.la.connexion')}
          </Link>
        </p>
      </Card>
    </div>
  )
}