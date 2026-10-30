import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { FormEvent, ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { BrandLogo } from '../components/BrandLogo'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { ApiError, requestPasswordReset, resetPassword } from '../services/api'
import { SoftShapesBackground } from '../components/ride/SoftShapesBackground'

function AuthStory() {
  const { t } = useTranslation()
  return (
    <section className="auth-story">
      <Link className="brand auth-brand" to="/login">
        <BrandLogo subtitle={t('Transportation')} />
      </Link>
      <div className="auth-story-content recovery-story-content">
        <span className="auth-kicker"><i /> {t('SECURE ACCOUNT ACCESS')}</span>
        <h1>{t('Every journey starts with')} <em>{t('trust.')}</em></h1>
        <p>{t('We help protect your transportation workspace with secure account recovery.')}</p>
      </div>
      <div className="auth-story-footer"><span>{t('BUILT FOR THE JOURNEY AHEAD')}</span><span>© 2026 وصلني</span></div>
    </section>
  )
}

function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth-page">
      <SoftShapesBackground color="var(--color-accent)" speed={1} intensity={0.15} />
      <AuthStory />
      <section className="auth-form-side">
        <LanguageSwitcher />
        <div className="auth-form-wrap">{children}</div>
      </section>
    </main>
  )
}

export function ForgotPasswordPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await requestPasswordReset(email.trim())
      navigate('/reset-password', { state: { email: email.trim() } })
    } catch (reason) {
      setError(reason instanceof ApiError
        ? reason.details.join(' · ') || reason.message
        : t('The service could not be reached. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <div className="auth-form-heading">
        <span className="eyebrow">{t('ACCOUNT RECOVERY')}</span>
        <h2>{t('Forgot your password?')}</h2>
        <p>{t('Enter your registered email address. If an account exists, we will email a password reset code.')}</p>
      </div>
      {error && <div className="auth-alert" role="alert"><i className="bi bi-exclamation-circle-fill" /><span>{error}</span></div>}
      <form className="auth-form" onSubmit={submit}>
        <div className="auth-field">
          <label htmlFor="recovery-email">{t('Email address')}</label>
          <input
            id="recovery-email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <button className="auth-submit" disabled={loading} type="submit">
          {loading ? <><span className="spinner-border spinner-border-sm" aria-hidden="true" /> {t('Sending…')}</> : <>{t('Send reset code')} <i className="bi bi-arrow-right" /></>}
        </button>
      </form>
      <p className="auth-switch"><Link to="/login">{t('Return to login')}</Link></p>
      <p className="auth-note"><i className="bi bi-shield-check" /> {t('Your account access is protected by the Wasalni API.')}</p>
    </AuthLayout>
  )
}

function passwordStrength(password: string): { label: string; value: number } {
  if (!password) return { label: 'Not entered', value: 0 }
  let value = 0
  if (password.length >= 8) value += 1
  if (password.length >= 12) value += 1
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) value += 1
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) value += 1
  return {
    label: value <= 1 ? 'Weak' : value <= 2 ? 'Fair' : value === 3 ? 'Good' : 'Strong',
    value,
  }
}

export function ResetPasswordPage() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState(
    (location.state as { email?: string } | null)?.email ?? '',
  )
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [complete, setComplete] = useState(false)
  const strength = passwordStrength(password)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError(t('Use a password with at least 8 characters.'))
      return
    }
    if (/^\d+$/.test(password)) {
      setError(t('Your password cannot contain only numbers.'))
      return
    }
    if (password !== confirmation) {
      setError(t('The passwords do not match.'))
      return
    }

    setLoading(true)
    try {
      await resetPassword(email.trim(), code, password)
      setComplete(true)
      setPassword('')
      setConfirmation('')
    } catch (reason) {
      const apiError = reason instanceof ApiError ? reason : null
      const details = apiError?.details.join(' · ') || apiError?.message
      setError(apiError?.status === 400 && details?.includes('reset code')
        ? t('Your reset code is invalid or has expired. Please request a new one.')
        : details || t('The service could not be reached. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      {complete ? (
        <>
          <div className="auth-form-heading">
            <span className="eyebrow">{t('PASSWORD UPDATED')}</span>
            <h2>{t('Password Reset Successful')}</h2>
            <p>{t('Your password has been updated. You can now sign in using your new password.')}</p>
          </div>
          <button className="auth-submit" type="button" onClick={() => navigate('/login', { replace: true })}>
            {t('Return to Login')} <i className="bi bi-arrow-right" />
          </button>
        </>
      ) : (
        <>
          <div className="auth-form-heading">
            <span className="eyebrow">{t('ACCOUNT RECOVERY')}</span>
            <h2>{t('Choose a new password')}</h2>
            <p>{t('Enter the one-time code sent to your email and choose a new password.')}</p>
          </div>
          {error && <div className="auth-alert" role="alert"><i className="bi bi-exclamation-circle-fill" /><span>{error}</span></div>}
          <form className="auth-form" onSubmit={submit} noValidate>
            <div className="auth-field">
              <label htmlFor="recovery-email">{t('Email address')}</label>
              <input
                id="recovery-email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="auth-field">
              <label htmlFor="recovery-code">{t('6-digit reset code')}</label>
              <input
                id="recovery-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </div>
            <div className="auth-field">
              <label htmlFor="new-password">{t('New password')}</label>
              <div className="auth-password-control">
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button type="button" aria-label={t(showPassword ? 'Hide new password' : 'Show new password')} onClick={() => setShowPassword((shown) => !shown)}>
                  <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} aria-hidden="true" />
                </button>
              </div>
              <div className="password-strength" role="status" aria-live="polite">
                <span>{t('Password strength')}: {t(strength.label)}</span>
                <progress max="4" value={strength.value} aria-label={`${t('Password strength')}: ${t(strength.label)}`} />
              </div>
            </div>
            <div className="auth-field">
              <label htmlFor="confirm-password">{t('Confirm new password')}</label>
              <div className="auth-password-control">
                <input
                  id="confirm-password"
                  type={showConfirmation ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
                <button type="button" aria-label={t(showConfirmation ? 'Hide confirmation password' : 'Show confirmation password')} onClick={() => setShowConfirmation((shown) => !shown)}>
                  <i className={`bi ${showConfirmation ? 'bi-eye-slash' : 'bi-eye'}`} aria-hidden="true" />
                </button>
              </div>
            </div>
            <button className="auth-submit" disabled={loading} type="submit">
              {loading ? <><span className="spinner-border spinner-border-sm" aria-hidden="true" /> {t('Updating password…')}</> : <>{t('Reset Password')} <i className="bi bi-arrow-right" /></>}
            </button>
          </form>
          <p className="auth-switch"><Link to="/login">{t('Return to login')}</Link></p>
        </>
      )}
    </AuthLayout>
  )
}
