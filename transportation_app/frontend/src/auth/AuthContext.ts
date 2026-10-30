import { createContext } from 'react'
import type { UserRecord } from '../types'
import type { AuthTokenResponse } from '../types'

export interface AuthContextValue {
  token: string | null
  user: UserRecord | null
  userLoading: boolean
  userError: string | null
  signIn: (tokens: AuthTokenResponse) => void
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
