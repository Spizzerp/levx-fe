import { createContext, useContext } from 'react'
import type { Program } from '@coral-xyz/anchor'

import type { Levx } from '@/idl/levx'

// Must include the IDL type parameter — `Program` alone resolves to `Program<Idl>`
// (the default), and `Program<Levx>` is not assignable to `Program<Idl>` under
// Anchor's strict typing because the IDL type is invariant in the methods builder
// generic. `useProgram()` returns `Program<Levx> | null`.
export type AnchorProgramValue = Program<Levx> | null

export const AnchorProgramContext = createContext<AnchorProgramValue>(null)

export function useAnchorProgram(): AnchorProgramValue {
  return useContext(AnchorProgramContext)
}
