import { createContext } from 'react'
import type { AuthTokenResponse, UserRecord } from '../types'

export interface AuthContextValue {
  token: string | null
  user: UserRecord | null
  userLoading: boolean
  userError: string | null
  signIn: (tokens: AuthTokenResponse) => void
  signOut: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
