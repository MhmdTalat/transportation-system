import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { BrandLogo } from '../components/BrandLogo'
import { ApiError, requestPasswordReset, resetPassword } from '../services/api'

function AuthStory() {
  return (
    <section className="auth-story">
      <Link className="brand auth-brand" to="/login">
        <BrandLogo subtitle="TRANSPORTATION" />
      </Link>
      <div className="auth-story-content recovery-story-content">
        <span className="auth-kicker"><i /> SECURE ACCOUNT ACCESS</span>
        <h1>Every journey starts with <em>trust.</em></h1>
        <p>We help protect your transportation workspace with secure account recovery.</p>
      </div>
      <div className="auth-story-footer"><span>BUILT FOR THE JOURNEY AHEAD</span><span>© 2026 وصلني</span></div>
    </section>
  )
}

function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth-page">
      <AuthStory />
      <section className="auth-form-side">
        <div className="auth-form-wrap">{children}</div>
      </section>
    </main>
  )
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await requestPasswordReset(email.trim())
      setSent(true)
    } catch (reason) {
      setError(reason instanceof ApiError
        ? reason.details.join(' · ') || reason.message
        : 'The service could not be reached. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <div className="auth-form-heading">
        <span className="eyebrow">ACCOUNT RECOVERY</span>
        <h2>Forgot your password?</h2>
        <p>Enter your registered email address. If an account exists, we'll send you instructions to reset your password.</p>
      </div>
      {error && <div className="auth-alert" role="alert"><i className="bi bi-exclamation-circle-fill" /><span>{error}</span></div>}
      {sent ? (
        <div className="auth-success recovery-feedback" role="status">
          <i className="bi bi-check-circle-fill" />
          <span>If an account with that email exists, password reset instructions will be sent.</span>
        </div>
      ) : (
        <form className="auth-form" onSubmit={submit}>
          <div className="auth-field">
            <label htmlFor="recovery-email">Email address</label>
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
            {loading ? <><span className="spinner-border spinner-border-sm" aria-hidden="true" /> Sending…</> : <>Send reset instructions <i className="bi bi-arrow-right" /></>}
          </button>
        </form>
      )}
      <p className="auth-switch"><Link to="/login">Return to login</Link></p>
      <p className="auth-note"><i className="bi bi-shield-check" /> Your account access is protected by the Wasalni API.</p>
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
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const uid = searchParams.get('uid') ?? ''
  const token = searchParams.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [complete, setComplete] = useState(false)
  const strength = passwordStrength(password)
  const invalidLink = !uid || !token

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Use a password with at least 8 characters.')
      return
    }
    if (/^\d+$/.test(password)) {
      setError('Your password cannot contain only numbers.')
      return
    }
    if (password !== confirmation) {
      setError('The passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await resetPassword(uid, token, password)
      setComplete(true)
      setPassword('')
      setConfirmation('')
    } catch (reason) {
      const apiError = reason instanceof ApiError ? reason : null
      const details = apiError?.details.join(' · ') || apiError?.message
      setError(apiError?.status === 400 && details?.includes('reset link')
        ? 'Your reset link is invalid or has expired. Please request a new one.'
        : details || 'The service could not be reached. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      {complete ? (
        <>
          <div className="auth-form-heading">
            <span className="eyebrow">PASSWORD UPDATED</span>
            <h2>Password Reset Successful</h2>
            <p>Your password has been updated. You can now sign in using your new password.</p>
          </div>
          <button className="auth-submit" type="button" onClick={() => navigate('/login', { replace: true })}>
            Return to Login <i className="bi bi-arrow-right" />
          </button>
        </>
      ) : invalidLink ? (
        <>
          <div className="auth-form-heading">
            <span className="eyebrow">ACCOUNT RECOVERY</span>
            <h2>Reset your password</h2>
          </div>
          <div className="auth-alert" role="alert"><i className="bi bi-exclamation-circle-fill" /><span>Your reset link is invalid or has expired. Please request a new one.</span></div>
          <p className="auth-switch"><Link to="/forgot-password">Request a new reset link</Link></p>
        </>
      ) : (
        <>
          <div className="auth-form-heading">
            <span className="eyebrow">ACCOUNT RECOVERY</span>
            <h2>Choose a new password</h2>
            <p>Enter a new password for your Wasalni account.</p>
          </div>
          {error && <div className="auth-alert" role="alert"><i className="bi bi-exclamation-circle-fill" /><span>{error}</span></div>}
          <form className="auth-form" onSubmit={submit} noValidate>
            <div className="auth-field">
              <label htmlFor="new-password">New password</label>
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
                <button type="button" aria-label={showPassword ? 'Hide new password' : 'Show new password'} onClick={() => setShowPassword((shown) => !shown)}>
                  <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} aria-hidden="true" />
                </button>
              </div>
              <div className="password-strength" role="status" aria-live="polite">
                <span>Password strength: {strength.label}</span>
                <progress max="4" value={strength.value} aria-label={`Password strength: ${strength.label}`} />
              </div>
            </div>
            <div className="auth-field">
              <label htmlFor="confirm-password">Confirm new password</label>
              <div className="auth-password-control">
                <input
                  id="confirm-password"
                  type={showConfirmation ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
                <button type="button" aria-label={showConfirmation ? 'Hide confirmation password' : 'Show confirmation password'} onClick={() => setShowConfirmation((shown) => !shown)}>
                  <i className={`bi ${showConfirmation ? 'bi-eye-slash' : 'bi-eye'}`} aria-hidden="true" />
                </button>
              </div>
            </div>
            <button className="auth-submit" disabled={loading} type="submit">
              {loading ? <><span className="spinner-border spinner-border-sm" aria-hidden="true" /> Updating password…</> : <>Reset Password <i className="bi bi-arrow-right" /></>}
            </button>
          </form>
          <p className="auth-switch"><Link to="/login">Return to login</Link></p>
        </>
      )}
    </AuthLayout>
  )
}
