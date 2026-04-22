import { createContext } from 'react'

import type { AuthStatus } from './types'

export type AuthContextValue = {
  status: AuthStatus
  jwt: string | null
  wallet: string | null
  expiresAt: number | null
  authenticate(): Promise<void>
  signOut(): void
}

export const SupabaseAuthContext = createContext<AuthContextValue | null>(null)
