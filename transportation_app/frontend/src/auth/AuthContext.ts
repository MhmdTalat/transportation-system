import { createContext } from 'react'
import type { UserRecord } from '../types'

export interface AuthContextValue {
  token: string | null
  user: UserRecord | null
  userLoading: boolean
  userError: string | null
  signIn: (token: string) => void
  signOut: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
