import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { BrandLogo } from '../components/BrandLogo'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { SoftShapesBackground } from '../components/ride/SoftShapesBackground'
import {
  ApiError,
  registerAccount,
  requestEmailVerification,
  signIn,
  verifyEmail,
} from '../services/api'

interface Props {
  mode: 'login' | 'register'
}

export function AuthPage({ mode }: Props) {
  const isRegister = mode === 'register'
  const { t } = useTranslation()
  const { signIn: storeToken } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [role, setRole] = useState<'passenger' | 'driver'>('passenger')
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') ?? '')
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      if (isRegister) {
        await registerAccount({
          username: String(formData.get('username') ?? ''),
          first_name: String(formData.get('first_name') ?? ''),
          last_name: String(formData.get('last_name') ?? ''),
          email,
          phone_number: String(formData.get('phone_number') ?? ''),
          password: String(formData.get('password') ?? ''),
          role,
        })
        setVerificationEmail(email)
        setSuccess('Account created. Enter the verification code sent to your email.')
      } else {
        const token = await signIn(
          String(formData.get('username') ?? ''),
          String(formData.get('password') ?? ''),
        )
        storeToken(token)
        navigate('/', { replace: true })
      }
    } catch (reason) {
      if (
        isRegister
        && reason instanceof ApiError
        && reason.code === 'verification_email_delivery_failed'
      ) {
        setVerificationEmail(email)
      }
      setError(reason instanceof ApiError ? reason.details.join(' · ') || reason.message : 'The service could not be reached. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function submitVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!verificationEmail) return
    const code = String(new FormData(event.currentTarget).get('code') ?? '')
    setLoading(true)
    setError(null)
    try {
      await verifyEmail(verificationEmail, code)
      setSuccess('Email verified. You can now sign in.')
      setVerificationEmail(null)
      window.setTimeout(() => navigate('/login', { replace: true }), 900)
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.details.join(' · ') || reason.message : 'The service could not be reached. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function resendVerificationCode() {
    if (!verificationEmail) return
    setLoading(true)
    setError(null)
    try {
      await requestEmailVerification(verificationEmail)
      setSuccess('If the account needs verification, a new code will be sent.')
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.details.join(' · ') || reason.message : 'The service could not be reached. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <SoftShapesBackground color="var(--color-accent)" speed={1} intensity={0.15} />
      <section className="auth-story">
        <Link className="brand auth-brand" to="/login">
          <BrandLogo subtitle={t('Transportation')} />
        </Link>
        <div className="auth-story-content">
          <span className="auth-kicker"><i /> {t('TRANSPORT OPERATIONS, IN FOCUS')}</span>
          <h1>{t('Move your operations')} <em>{t('forward.')}</em></h1>
          <p>{t('A clearer view of trips, fleet, and the people who keep every journey moving.')}</p>
          <div className="auth-illustration" aria-hidden="true">
            <div className="auth-scene-glow" />
            <div className="auth-scene-badge">
              <span>{t('On time')}</span>
              <strong>24/7</strong>
            </div>
            <div className="auth-scene-chart" aria-hidden="true">
              <span className="auth-scene-bar" style={{ height: '42%' }} />
              <span className="auth-scene-bar" style={{ height: '58%' }} />
              <span className="auth-scene-bar" style={{ height: '72%' }} />
              <span className="auth-scene-bar" style={{ height: '88%' }} />
              <span className="auth-scene-bar" style={{ height: '100%' }} />
            </div>
            <div className="auth-scene-card">
              <span className="route-card-icon"><i className="bi bi-bus-front-fill" /></span>
              <span>
                <strong>{t('Fleet visibility')}</strong>
                <small>{t('Live operational view')}</small>
              </span>
              <span className="online-dot" />
            </div>
          </div>
        </div>
        <div className="auth-story-footer"><span>{t('BUILT FOR THE JOURNEY AHEAD')}</span><span>© 2026 وصلني</span></div>
      </section>

      <section className="auth-form-side">
        <LanguageSwitcher />
        <div className="auth-form-wrap">
          <div className="auth-form-heading">
            <span className="eyebrow">{isRegister ? t('GET STARTED') : t('WELCOME BACK')}</span>
            <h2>{isRegister ? t('Create your account') : t('Sign in to Wasalni')}</h2>
            <p>{isRegister ? t('Choose your business role and set up your workspace access.') : t('Enter your credentials to access your operations workspace.')}</p>
          </div>
          {error && <div className="auth-alert" role="alert"><i className="bi bi-exclamation-circle-fill" /><span>{error}</span></div>}
          {success && <div className="auth-success" role="status"><i className="bi bi-check-circle-fill" /><span>{success}</span></div>}

          {!verificationEmail && <form className="auth-form" onSubmit={submit}>
            {isRegister && (
              <>
                <div className="auth-field"><label htmlFor="role">{t('Account type')}</label><select id="role" value={role} onChange={(event) => setRole(event.target.value as 'passenger' | 'driver')}><option value="passenger">{t('Passenger')}</option><option value="driver">{t('Driver')}</option></select><small>{t('Administrator and authority accounts are managed by an administrator.')}</small></div>
                <div className="auth-two-fields">
                  <div className="auth-field"><label htmlFor="first_name">{t('First name')}</label><input id="first_name" name="first_name" autoComplete="given-name" required placeholder={t('First name')} /></div>
                  <div className="auth-field"><label htmlFor="last_name">{t('Last name')}</label><input id="last_name" name="last_name" autoComplete="family-name" required placeholder={t('Last name')} /></div>
                </div>
                <div className="auth-field"><label htmlFor="email">{t('Email address')}</label><input id="email" type="email" name="email" autoComplete="email" required placeholder="you@company.com" /></div>
                <div className="auth-field"><label htmlFor="phone_number">{t('Phone number')} <span>{t('Optional')}</span></label><input id="phone_number" type="tel" name="phone_number" autoComplete="tel" placeholder="+1 (555) 000-0000" /></div>
              </>
            )}
            <div className="auth-field"><label htmlFor="username">{t(isRegister ? 'Username' : 'Username or email')}</label><input id="username" name="username" autoComplete="username" required placeholder={t(isRegister ? 'Enter your username' : 'Enter your username or email')} /></div>
            <div className="auth-field"><label htmlFor="password">{t('Password')}</label><input id="password" type="password" name="password" autoComplete={isRegister ? 'new-password' : 'current-password'} required minLength={8} placeholder={t(isRegister ? 'Create a strong password' : 'Enter your password')} /></div>
            {!isRegister && <Link className="auth-forgot-link" to="/forgot-password">{t('Forgot Password?')}</Link>}
            <button className="auth-submit" disabled={loading} type="submit">{loading ? <><span className="spinner-border spinner-border-sm" /> {t(isRegister ? 'Creating account…' : 'Signing in…')}</> : <>{t(isRegister ? 'Create account' : 'Sign in')} <i className="bi bi-arrow-right" /></>}</button>
          </form>}
          {verificationEmail && (
            <form className="auth-form" onSubmit={submitVerification}>
              <div className="auth-field">
                <label htmlFor="verification-code">{t('6-digit email code')}</label>
                <input id="verification-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required />
              </div>
              <button className="auth-submit" disabled={loading} type="submit">
                {loading ? t('Verifying…') : t('Verify email')} <i className="bi bi-arrow-right" />
              </button>
              <button className="btn btn-link" disabled={loading} type="button" onClick={() => { void resendVerificationCode() }}>
                {t('Send a new code')}
              </button>
            </form>
          )}
          <p className="auth-switch">{t(isRegister ? 'Already have an account?' : 'New to Wasalni?')} <Link to={isRegister ? '/login' : '/register'}>{t(isRegister ? 'Sign in' : 'Create an account')}</Link></p>
          <p className="auth-note"><i className="bi bi-shield-check" /> {t('Your account access is protected by the Wasalni API.')}</p>
        </div>
      </section>
    </main>
  )
}
