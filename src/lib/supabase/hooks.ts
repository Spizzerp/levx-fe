import { useContext } from 'react'
import { SupabaseAuthContext, type AuthContextValue } from './provider'

export function useSupabaseAuth(): AuthContextValue {
  const ctx = useContext(SupabaseAuthContext)
  if (!ctx) throw new Error('useSupabaseAuth must be used inside <SupabaseAuthProvider>')
  return ctx
}
