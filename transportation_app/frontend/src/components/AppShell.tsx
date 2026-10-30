import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { api } from '../services/api'
import { BrandLogo } from './BrandLogo'
import { LanguageSwitcher } from './LanguageSwitcher'
import { useToast } from './ToastContext'
import { useScrollLock } from '../hooks/useScrollLock'
import { PageLayout } from './PageLayout'

const adminSections = [
  {
    title: 'Overview',
    links: [
      { label: 'Dashboard', to: '/', icon: 'bi-grid-1x2-fill' },
      { label: 'Design system', to: '/style-guide', icon: 'bi-palette2' },
    ],
  },
  {
    title: 'Operations',
    links: [
      { label: 'Trips', to: '/trips', icon: 'bi-signpost-split' },
      { label: 'Fleet tracking', to: '/tracking', icon: 'bi-radar' },
      { label: 'Bookings', to: '/bookings', icon: 'bi-ticket-perforated' },
      { label: 'Private rides', to: '/private-rides', icon: 'bi-car-front' },
      { label: 'Complaints', to: '/complaints', icon: 'bi-chat-square-text' },
      { label: 'Passengers & users', to: '/users', icon: 'bi-people' },
      { label: 'Routes', to: '/routes', icon: 'bi-bezier2' },
      { label: 'Route stops', to: '/route-stations', icon: 'bi-signpost-2' },
      { label: 'Stations', to: '/stations', icon: 'bi-geo-alt' },
    ],
  },
  {
    title: 'Fleet',
    links: [
      { label: 'Vehicles', to: '/vehicles', icon: 'bi-truck-front' },
      { label: 'Drivers', to: '/drivers', icon: 'bi-person-badge' },
      { label: 'Driver documents', to: '/driver-documents', icon: 'bi-file-earmark-lock' },
      { label: 'Operations & audit', to: '/admin-operations', icon: 'bi-clipboard-data' },
    ],
  },
  {
    title: 'Finance & updates',
    links: [
      { label: 'Fare rules', to: '/fare-rules', icon: 'bi-currency-dollar' },
      { label: 'Payments', to: '/payments', icon: 'bi-wallet2' },
      { label: 'Notifications', to: '/notifications', icon: 'bi-bell' },
    ],
  },
]

const driverSections = [
  { title: 'Operations', links: [
    { label: 'My trips', to: '/my-trips', icon: 'bi-signpost-split' },
    { label: 'Private rides', to: '/private-rides', icon: 'bi-car-front' },
    { label: 'Complaints', to: '/complaints', icon: 'bi-chat-square-text' },
    { label: 'Driver documents', to: '/driver-documents', icon: 'bi-file-earmark-lock' },
  ] },
  { title: 'Account', links: [
    { label: 'Notifications', to: '/notifications', icon: 'bi-bell' },
    { label: 'Profile', to: '/profile', icon: 'bi-person-circle' },
  ] },
]

const passengerSections = [
  { title: 'Travel', links: [
    { label: 'Home', to: '/', icon: 'bi-house' },
    { label: 'Search trips', to: '/search', icon: 'bi-search' },
    { label: 'My bookings', to: '/bookings', icon: 'bi-ticket-perforated' },
    { label: 'Private rides', to: '/private-rides', icon: 'bi-car-front' },
    { label: 'Support', to: '/complaints', icon: 'bi-chat-square-text' },
  ] },
  { title: 'Account', links: [
    { label: 'Notifications', to: '/notifications', icon: 'bi-bell' },
    { label: 'Profile', to: '/profile', icon: 'bi-person-circle' },
  ] },
]

const titleForPath: Record<string, string> = {
  trips: 'Trips',
  tracking: 'Fleet tracking',
  routes: 'Routes',
  'route-stations': 'Route stops',
  stations: 'Stations',
  vehicles: 'Vehicles',
  drivers: 'Drivers',
  'fare-rules': 'Fare rules',
  payments: 'Payments',
  notifications: 'Notifications',
  bookings: 'Bookings',
  'private-rides': 'Private rides',
  'driver-documents': 'Driver documents',
  complaints: 'Complaints',
  'admin-operations': 'Operations & audit',
  users: 'Users',
  search: 'Search trips',
  'my-trips': 'My trips',
  profile: 'Profile',
  'style-guide': 'Design system',
}

interface AppShellProps {
  colorTheme: 'light' | 'dark'
  onToggleColorTheme: () => void
}

export function AppShell({ colorTheme, onToggleColorTheme }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [analyticsSidebarCollapsed, setAnalyticsSidebarCollapsed] = useState(
    () => window.localStorage.getItem('transitflow.analytics.sidebar-collapsed') === 'true',
  )
  const [notificationCount, setNotificationCount] = useState(0)
  const { t } = useTranslation()
  const { signOut, user } = useAuth()
  const { showToast } = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  useScrollLock(drawerOpen)

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [location.pathname])
  const section = location.pathname.split('/')[1]
  const heading = section ? titleForPath[section] ?? 'Operations' : 'Dashboard'
  const isAdmin = user?.role === 'admin' || user?.role === 'authority'
  const isAnalyticsDashboard = isAdmin && location.pathname === '/'
  const navigation = isAdmin ? adminSections : user?.role === 'driver' ? driverSections : passengerSections
  const mobileNavigation = isAdmin
    ? [
        { label: 'Dashboard', to: '/', icon: 'bi-grid-1x2-fill' },
        { label: 'Trips', to: '/trips', icon: 'bi-signpost-split' },
        { label: 'Bookings', to: '/bookings', icon: 'bi-ticket-perforated' },
        { label: 'Private rides', to: '/private-rides', icon: 'bi-car-front' },
        { label: 'Complaints', to: '/complaints', icon: 'bi-chat-square-text' },
        { label: 'Users', to: '/users', icon: 'bi-people' },
        { label: 'Tracking', to: '/tracking', icon: 'bi-radar' },
      ]
    : user?.role === 'driver'
      ? [
          { label: 'My trips', to: '/my-trips', icon: 'bi-signpost-split' },
          { label: 'Private rides', to: '/private-rides', icon: 'bi-car-front' },
          { label: 'Support', to: '/complaints', icon: 'bi-chat-square-text' },
          { label: 'Notifications', to: '/notifications', icon: 'bi-bell' },
          { label: 'Profile', to: '/profile', icon: 'bi-person-circle' },
        ]
      : [
          { label: 'Home', to: '/', icon: 'bi-house' },
          { label: 'Search', to: '/search', icon: 'bi-search' },
          { label: 'Private rides', to: '/private-rides', icon: 'bi-car-front' },
          { label: 'Support', to: '/complaints', icon: 'bi-chat-square-text' },
          { label: 'Bookings', to: '/bookings', icon: 'bi-ticket-perforated' },
          { label: 'Updates', to: '/notifications', icon: 'bi-bell' },
          { label: 'Profile', to: '/profile', icon: 'bi-person-circle' },
        ]

  useEffect(() => {
    let active = true
    const refreshUnread = () => {
      void api.get<{ is_read: boolean }[]>('/api/notifications/')
        .then((items) => { if (active) setNotificationCount(items.filter((item) => !item.is_read).length) })
        .catch((reason: unknown) => {
          if (active) showToast(reason instanceof Error ? reason.message : 'Could not refresh notification count.', 'error')
        })
    }
    refreshUnread()
    const timer = window.setInterval(refreshUnread, 60_000)
    return () => { active = false; window.clearInterval(timer) }
  }, [showToast])

  async function logOut() {
    try {
      await signOut()
    } catch (reason) {
      showToast(
        reason instanceof Error ? reason.message : 'Could not revoke the refresh token.',
        'error',
      )
    }
    navigate('/login', { replace: true })
  }

  return (
    <div className={`app-shell${isAnalyticsDashboard ? ' analytics-shell' : ''}${isAnalyticsDashboard && analyticsSidebarCollapsed ? ' analytics-sidebar-collapsed' : ''}`}>
      {drawerOpen && <button className="drawer-scrim" aria-label={t('Close navigation')} onClick={() => setDrawerOpen(false)} />}
      <aside className={`sidebar ${drawerOpen ? 'sidebar-open' : ''}`} aria-label={t('Main navigation')}>
        <NavLink className="brand" to="/" onClick={() => setDrawerOpen(false)}>
          <BrandLogo subtitle={isAdmin ? t('OPERATIONS') : user?.role === 'driver' ? t('DRIVER WORKSPACE') : t('PASSENGER TRAVEL')} />
        </NavLink>
        <div className="sidebar-divider" />
        <nav className="sidebar-nav" id="primary-navigation">
          {navigation.map((sectionItem) => (
            <div className="nav-section" key={sectionItem.title}>
              <p className="nav-caption">{t(sectionItem.title)}</p>
              {sectionItem.links.map((link) => (
                <NavLink
                  className={({ isActive }) => `nav-link-item${isActive ? ' active' : ''}`}
                  end={link.to === '/'}
                  key={link.to}
                  to={link.to}
                  onClick={() => setDrawerOpen(false)}
                >
                  <i className={`bi ${link.icon}`} aria-hidden="true" />
                  <span>{t(link.label)}</span>
                  {link.to === '/notifications' && notificationCount > 0 && <span className="nav-notification-count">{notificationCount > 99 ? '99+' : notificationCount}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <span className="help-icon"><i className="bi bi-life-preserver" aria-hidden="true" /></span>
            <div><strong>{t('Need a hand?')}</strong><small>{t('Browse API documentation')}</small></div>
            <a href="/swagger/" target="_blank" rel="noreferrer" aria-label={t('Open API documentation')}><i className="bi bi-arrow-up-right" /></a>
          </div>
          <button className="signout-link" onClick={logOut} type="button">
            <i className="bi bi-box-arrow-left" aria-hidden="true" /><span>{t('Sign out')}</span>
          </button>
          <div className="sidebar-meta"><span>WASALNI</span><span>V1.0</span></div>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" type="button" aria-label={drawerOpen ? t('Close navigation') : t('Open navigation')} aria-expanded={drawerOpen} aria-controls="primary-navigation" onClick={() => setDrawerOpen((open) => !open)}>
              <i className="bi bi-list" aria-hidden="true" />
            </button>
            <div className="breadcrumbs"><span>{t('Workspace')}</span><i className="bi bi-chevron-right" /><strong>{t(heading)}</strong></div>
          </div>
          <div className="topbar-right">
            <button
              className="icon-button theme-toggle"
              type="button"
              aria-label={t(colorTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode')}
              aria-pressed={colorTheme === 'dark'}
              title={t(colorTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode')}
              onClick={onToggleColorTheme}
            >
              <i className={`bi ${colorTheme === 'dark' ? 'bi-sun' : 'bi-moon'}`} aria-hidden="true" />
            </button>
            {isAnalyticsDashboard && (
              <button
                className="icon-button analytics-sidebar-toggle"
                type="button"
                aria-label={analyticsSidebarCollapsed ? t('Expand sidebar') : t('Collapse sidebar')}
                aria-pressed={analyticsSidebarCollapsed}
                title={analyticsSidebarCollapsed ? t('Expand sidebar') : t('Collapse sidebar')}
                onClick={() => {
                  setAnalyticsSidebarCollapsed((collapsed) => {
                    const next = !collapsed
                    window.localStorage.setItem('transitflow.analytics.sidebar-collapsed', String(next))
                    return next
                  })
                }}
              >
                <i className={`bi ${analyticsSidebarCollapsed ? 'bi-layout-sidebar' : 'bi-layout-sidebar-inset'}`} aria-hidden="true" />
              </button>
            )}
            <LanguageSwitcher />
            <span className="system-status"><i /> {t('API workspace')}</span>
            {isAdmin && <a className="icon-button docs-button" href="/swagger/" target="_blank" rel="noreferrer" aria-label={t('API documentation')} title={t('API documentation')}><i className="bi bi-question-circle" /></a>}
            <div className="user-chip"><span className="avatar">{(user?.first_name?.[0] ?? user?.username?.[0] ?? 'U').toUpperCase()}</span><span><strong>{user?.first_name || user?.username || t('Account')}</strong><small>{t(user?.role ?? 'Signed in')}</small></span></div>
          </div>
        </header>
        <main className="page-content" key={location.pathname}><PageLayout><Outlet /></PageLayout></main>
        <footer className="app-footer"><span lang="ar" dir="rtl">وصلني · WASALNI</span><span>{t('Connected to the transportation API')}</span></footer>
        <nav className="mobile-bottom-nav" aria-label={t('Mobile navigation')}>
          {mobileNavigation.map((link) => (
            <NavLink
              end={link.to === '/'}
              key={link.to}
              to={link.to}
              onClick={() => setDrawerOpen(false)}
            >
              <i className={`bi ${link.icon}`} aria-hidden="true" />
              <span>{t(link.label)}</span>
              {link.to === '/notifications' && notificationCount > 0 && <span className="mobile-nav-badge" aria-label={t('{{count}} unread notifications', { count: notificationCount })}>{notificationCount > 99 ? '99+' : notificationCount}</span>}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
