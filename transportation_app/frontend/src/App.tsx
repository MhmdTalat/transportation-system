import { lazy, Suspense, type ReactNode } from 'react'
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
import './App.css'
import './booking.css'
import './theme.css'
import './analytics.css'

import { useAuth } from './auth/useAuth'

const AnalyticsDashboard = lazy(() =>
  import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })),
)

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

function AppRoutes() {
  const { token, user, userLoading, userError, signOut } = useAuth()
  if (token && userLoading) {
    return <main className="session-loading"><span className="spinner-border" role="status" /><p>Loading your secure workspace…</p></main>
  }
  if (token && (!user || userError)) {
    return <main className="session-loading"><i className="bi bi-person-lock" /><h1>Account unavailable</h1><p>{userError ?? 'We could not load the signed-in account.'}</p><button className="btn btn-primary" type="button" onClick={signOut}>Sign out</button></main>
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
      <Route element={token ? <AppShell /> : <Navigate to="/login" replace />}>
        <Route index element={admin
          ? <Suspense fallback={<main className="session-loading" role="status"><span className="spinner-border" /><p>Loading analytics workspace…</p></main>}><AnalyticsDashboard /></Suspense>
          : user?.role === 'driver' ? <DriverDashboard /> : <PassengerDashboard />} />
        <Route path="search" element={restricted(user?.role === 'passenger', <PassengerBookingPage />)} />
        <Route path="my-trips" element={restricted(user?.role === 'driver', <DriverDashboard />)} />
        <Route path="bookings" element={admin ? <MyBookingsPage administrator /> : user?.role === 'passenger' ? <MyBookingsPage /> : <Navigate to={home} replace />} />
        <Route path="notifications" element={<NotificationCenterPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="style-guide" element={restricted(Boolean(admin), <StyleGuidePage />)} />
        <Route path="tracking" element={restricted(Boolean(admin), <TrackingPage />)} />
        <Route path=":resource" element={restricted(Boolean(admin), <ResourcePage />)} />
        <Route path=":resource/:id" element={restricted(Boolean(admin), <ResourcePage />)} />
      </Route>
      <Route path="*" element={<Navigate to={token ? home : '/login'} replace />} />
    </Routes>
  )
}
