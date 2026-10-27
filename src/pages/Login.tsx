import { tr } from '../i18n/translate'
import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { Alert, Button, Card, Field, Input, Spinner } from '../components/ui'
import { useI18n } from '../i18n'
import { LanguageSelector } from '../i18n/LanguageSelector'

export function Login() {
  const { login } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(username, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-full items-center justify-center bg-gradient-to-br from-brand-900 via-brand-800 to-brand-950 p-6">
      <div className="absolute right-4 top-4">
        <LanguageSelector />
      </div>
      <Card className="w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <div id="Login.e" className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-xl font-extrabold text-white">
            {tr('Login.e')}
          </div>
          <h1 className="text-2xl font-bold text-gray-900" id="Login.soc360">{tr('Login.soc360')}</h1>
          <p id="login.subtitle" className="mt-1 text-sm text-gray-500">{t('login.subtitle')}</p>
        </div>

        {error && (
          <div className="mb-4">
            <Alert id="Login.error">{error}</Alert>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label={t('login.username')} id="login.username">
            <Input
              id="login.username.input"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder={t('login.usernamePlaceholder')}
            />
          </Field>

          <Field label={t('login.password')} id="login.password">
            <Input
              id="login.password.input"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
            <label id="login.showPassword" className="mt-1 flex items-center gap-2 text-sm text-gray-600">
              <input
                id="login.showPassword.checkbox"
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-brand-600"
              />
              {t('login.showPassword')}
            </label>
          </Field>

          <div className="text-right">
            <Link
              id="login.forgot"
              to="/forgot-password"
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              {t('login.forgot')}
            </Link>
          </div>

          <Button id="login.submit" type="submit" className="w-full" disabled={submitting}>
            {submitting ? <Spinner className="border-white border-t-transparent" /> : null}
            {t('login.submit')}
          </Button>
        </form>

        <p id="login.noAccount" className="mt-6 text-center text-sm text-gray-600">
          {t('login.noAccount')}{' '}
          <Link
            id="login.register"
            to="/inscription"
            className="font-medium text-brand-600 hover:text-brand-700"
          >
            {t('login.register')}
          </Link>
        </p>
      </Card>
    </div>
  )
}
