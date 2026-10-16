import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { BrandLogo } from '../components/BrandLogo'
import { ApiError, registerAccount, signIn } from '../services/api'

interface Props {
  mode: 'login' | 'register'
}

export function AuthPage({ mode }: Props) {
  const isRegister = mode === 'register'
  const { signIn: storeToken } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [role, setRole] = useState<'passenger' | 'driver'>('passenger')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      if (isRegister) {
        await registerAccount({
          username: String(formData.get('username') ?? ''),
          first_name: String(formData.get('first_name') ?? ''),
          last_name: String(formData.get('last_name') ?? ''),
          email: String(formData.get('email') ?? ''),
          phone_number: String(formData.get('phone_number') ?? ''),
          password: String(formData.get('password') ?? ''),
          role,
        })
        setSuccess('Account created. Sign in to continue to your workspace.')
        window.setTimeout(() => navigate('/login', { replace: true }), 900)
      } else {
        const token = await signIn(
          String(formData.get('username') ?? ''),
          String(formData.get('password') ?? ''),
        )
        storeToken(token.access)
        navigate('/', { replace: true })
      }
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.details.join(' · ') || reason.message : 'The service could not be reached. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-story">
        <Link className="brand auth-brand" to="/login">
          <BrandLogo subtitle="TRANSPORTATION" />
        </Link>
        <div className="auth-story-content">
          <span className="auth-kicker"><i /> TRANSPORT OPERATIONS, IN FOCUS</span>
          <h1>Move your operations <em>forward.</em></h1>
          <p>A clearer view of trips, fleet, and the people who keep every journey moving.</p>
          <div className="auth-illustration" aria-hidden="true">
            <div className="auth-scene-glow" />
            <div className="auth-scene-badge">
              <span>On time</span>
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
                <strong>Fleet visibility</strong>
                <small>Live operational view</small>
              </span>
              <span className="online-dot" />
            </div>
          </div>
        </div>
        <div className="auth-story-footer"><span>BUILT FOR THE JOURNEY AHEAD</span><span>© 2026 وصلني</span></div>
      </section>

      <section className="auth-form-side">
        <div className="auth-form-wrap">
          <div className="auth-form-heading">
            <span className="eyebrow">{isRegister ? 'GET STARTED' : 'WELCOME BACK'}</span>
            <h2>{isRegister ? 'Create your account' : 'Sign in to Wasalni'}</h2>
            <p>{isRegister ? 'Choose your business role and set up your workspace access.' : 'Enter your credentials to access your operations workspace.'}</p>
          </div>
          {error && <div className="auth-alert" role="alert"><i className="bi bi-exclamation-circle-fill" /><span>{error}</span></div>}
          {success && <div className="auth-success" role="status"><i className="bi bi-check-circle-fill" /><span>{success}</span></div>}

          <form className="auth-form" onSubmit={submit}>
            {isRegister && (
              <>
                <div className="auth-field"><label htmlFor="role">Account type</label><select id="role" value={role} onChange={(event) => setRole(event.target.value as 'passenger' | 'driver')}><option value="passenger">Passenger</option><option value="driver">Driver</option></select><small>Administrator and authority accounts are managed by an administrator.</small></div>
                <div className="auth-two-fields">
                  <div className="auth-field"><label htmlFor="first_name">First name</label><input id="first_name" name="first_name" autoComplete="given-name" required placeholder="First name" /></div>
                  <div className="auth-field"><label htmlFor="last_name">Last name</label><input id="last_name" name="last_name" autoComplete="family-name" required placeholder="Last name" /></div>
                </div>
                <div className="auth-field"><label htmlFor="email">Email address</label><input id="email" type="email" name="email" autoComplete="email" required placeholder="you@company.com" /></div>
                <div className="auth-field"><label htmlFor="phone_number">Phone number <span>Optional</span></label><input id="phone_number" type="tel" name="phone_number" autoComplete="tel" placeholder="+1 (555) 000-0000" /></div>
              </>
            )}
            <div className="auth-field"><label htmlFor="username">{isRegister ? 'Username' : 'Username'}</label><input id="username" name="username" autoComplete={isRegister ? 'username' : 'username'} required placeholder="Enter your username" /></div>
            <div className="auth-field"><label htmlFor="password">Password</label><input id="password" type="password" name="password" autoComplete={isRegister ? 'new-password' : 'current-password'} required minLength={8} placeholder={isRegister ? 'Create a strong password' : 'Enter your password'} /></div>
            {!isRegister && <Link className="auth-forgot-link" to="/forgot-password">Forgot Password?</Link>}
            <button className="auth-submit" disabled={loading} type="submit">{loading ? <><span className="spinner-border spinner-border-sm" /> {isRegister ? 'Creating account…' : 'Signing in…'}</> : <>{isRegister ? 'Create account' : 'Sign in'} <i className="bi bi-arrow-right" /></>}</button>
          </form>
          <p className="auth-switch">{isRegister ? 'Already have an account?' : 'New to Wasalni?'} <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Create an account'}</Link></p>
          <p className="auth-note"><i className="bi bi-shield-check" /> Your account access is protected by the Wasalni API.</p>
        </div>
      </section>
    </main>
  )
}
