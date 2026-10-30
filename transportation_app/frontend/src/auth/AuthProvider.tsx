import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthContext } from './AuthContext'
import type { AuthContextValue } from './AuthContext'
import { api, revokeSession } from '../services/api'
import type { UserRecord } from '../types'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(
    () => window.localStorage.getItem('transport.access'),
  )
  const [user, setUser] = useState<UserRecord | null>(null)
  const [profileToken, setProfileToken] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const userLoading = Boolean(token) && profileToken !== token
  const userError = token && profileToken === token ? profileError : null
  const currentUser = token && profileToken === token ? user : null

  useEffect(() => {
    let active = true
    if (!token) {
      Promise.resolve().then(() => {
        if (active) {
          setUser(null)
          setProfileToken(null)
          setProfileError(null)
        }
      })
      return () => { active = false }
    }
    void api.get<UserRecord>('/api/me/')
      .then((profile) => {
        if (active) {
          setUser(profile)
          setProfileError(null)
          setProfileToken(token)
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setProfileError(reason instanceof Error ? reason.message : 'Could not load your account.')
          setProfileToken(token)
        }
      })
    return () => { active = false }
  }, [token])

  useEffect(() => {
    function clearExpiredSession() {
      setToken(null)
    }
    window.addEventListener('transport:unauthorized', clearExpiredSession)
    return () => window.removeEventListener('transport:unauthorized', clearExpiredSession)
  }, [])
  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user: currentUser,
      userLoading,
      userError,
      signIn: (tokens) => {
        window.localStorage.setItem('transport.access', tokens.access)
        window.localStorage.setItem('transport.refresh', tokens.refresh)
        setToken(tokens.access)
      },
      signOut: async () => {
        const refresh = window.localStorage.getItem('transport.refresh')
        try {
          if (refresh) await revokeSession(refresh)
        } finally {
          window.localStorage.removeItem('transport.access')
          window.localStorage.removeItem('transport.refresh')
          setToken(null)
        }
      },
    }),
    [token, currentUser, userLoading, userError],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
