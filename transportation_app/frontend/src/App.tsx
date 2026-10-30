import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { AppShell } from './components/AppShell'
import { ToastProvider } from './components/Toast'
import { AuthPage } from './pages/AuthPage'
import { ResourcePage } from './pages/ResourcePage'
import { TrackingPage } from './pages/TrackingPage'
import { PassengerBookingPage } from './pages/PassengerBookingPage'
import { PassengerDashboard } from './pages/PassengerDashboard'
import { MyBookingsPage } from './pages/MyBookingsPage'
import { DriverDashboard } from './pages/DriverDashboard'
import { NotificationCenterPage } from './pages/NotificationCenterPage'
import { ProfilePage } from './pages/ProfilePage'
import { ForgotPasswordPage, ResetPasswordPage } from './pages/PasswordRecoveryPage'
import { StyleGuidePage } from './pages/StyleGuidePage'
import { DriverDocumentsPage } from './pages/DriverDocumentsPage'
import { PrivateRidesPage } from './pages/PrivateRidesPage'
import { ComplaintsPage } from './pages/ComplaintsPage'
import { AdminOperationsPage } from './pages/AdminOperationsPage'
import { MotionBackgroundDemoPage } from './pages/MotionBackgroundDemoPage'
import './App.css'
import './booking.css'
import './theme.css'
import './analytics.css'
import './product-ui.css'
import './ride-app.css'
import './ride-tokens.css'

import { useAuth } from './auth/useAuth'

const AnalyticsDashboard = lazy(() =>
  import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })),
)

export default function App() {
  const [colorTheme, setColorTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = window.localStorage.getItem('wasalni.color-theme')
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.dataset.theme = colorTheme
  }, [colorTheme])

  function toggleColorTheme() {
    setColorTheme((currentTheme) => {
      const nextTheme = currentTheme === 'dark' ? 'light' : 'dark'
      window.localStorage.setItem('wasalni.color-theme', nextTheme)
      return nextTheme
    })
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes
            colorTheme={colorTheme}
            onToggleColorTheme={toggleColorTheme}
          />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

function AppRoutes({
  colorTheme,
  onToggleColorTheme,
}: {
  colorTheme: 'light' | 'dark'
  onToggleColorTheme: () => void
}) {
  const { t } = useTranslation()
  const { token, user, userLoading, userError, signOut } = useAuth()
  const [signOutError, setSignOutError] = useState<string | null>(null)
  if (token && userLoading) {
    return <main className="session-loading"><span className="spinner-border" role="status" /><p>{t('Loading your secure workspace…')}</p></main>
  }
  if (token && (!user || userError)) {
    return <main className="session-loading">
      <i className="bi bi-person-lock" />
      <h1>{t('Account unavailable')}</h1>
      <p>{userError ?? t('We could not load the signed-in account.')}</p>
      {signOutError && <p role="alert">{signOutError}</p>}
      <button
        className="btn btn-primary"
        type="button"
        onClick={() => {
          void signOut().catch((reason: unknown) => {
            setSignOutError(reason instanceof Error ? reason.message : t('Could not revoke the refresh token.'))
          })
        }}
      >
        {t('Sign out')}
      </button>
    </main>
  }

  const admin = user?.role === 'admin' || user?.role === 'authority'
  const home = user?.role === 'driver' ? '/my-trips' : admin ? '/' : '/search'
  const restricted = (allowed: boolean, element: ReactNode) => allowed ? element : <Navigate to={home} replace />

  return (
    <Routes>
      <Route
        path="/login"
        element={token ? <Navigate to={home} replace /> : <AuthPage mode="login" />}
      />
      <Route
        path="/register"
        element={token ? <Navigate to={home} replace /> : <AuthPage mode="register" />}
      />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        element={token
          ? <AppShell colorTheme={colorTheme} onToggleColorTheme={onToggleColorTheme} />
          : <Navigate to="/login" replace />}
      >
        <Route index element={admin
          ? <Suspense fallback={<main className="session-loading" role="status"><span className="spinner-border" /><p>{t('Loading analytics workspace…')}</p></main>}><AnalyticsDashboard /></Suspense>
          : user?.role === 'driver' ? <DriverDashboard /> : <PassengerDashboard />} />
        <Route path="search" element={restricted(user?.role === 'passenger', <PassengerBookingPage />)} />
        <Route path="my-trips" element={restricted(user?.role === 'driver', <DriverDashboard />)} />
        <Route path="bookings" element={admin ? <MyBookingsPage administrator /> : user?.role === 'passenger' ? <MyBookingsPage /> : <Navigate to={home} replace />} />
        <Route path="notifications" element={<NotificationCenterPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="private-rides" element={<PrivateRidesPage />} />
        <Route path="complaints" element={<ComplaintsPage />} />
        <Route path="driver-documents" element={restricted(Boolean(admin || user?.role === 'driver'), <DriverDocumentsPage />)} />
        <Route path="admin-operations" element={restricted(Boolean(admin), <AdminOperationsPage />)} />
        <Route path="style-guide" element={restricted(Boolean(admin), <StyleGuidePage />)} />
        <Route path="motion-demo" element={<MotionBackgroundDemoPage />} />
        <Route path="tracking" element={restricted(Boolean(admin), <TrackingPage />)} />
        <Route path=":resource" element={restricted(Boolean(admin), <ResourcePage />)} />
        <Route path=":resource/:id" element={restricted(Boolean(admin), <ResourcePage />)} />
      </Route>
      <Route path="*" element={<Navigate to={token ? home : '/login'} replace />} />
    </Routes>
  )
}
