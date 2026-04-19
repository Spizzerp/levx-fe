import { createContext, useContext, type PropsWithChildren } from 'react'
import type { Program } from '@coral-xyz/anchor'

import { useProgram } from '@/lib/solana/program'
import type { Levx } from '@/idl/levx'

// Must include the IDL type parameter — `Program` alone resolves to `Program<Idl>`
// (the default), and `Program<Levx>` is not assignable to `Program<Idl>` under
// Anchor's strict typing because the IDL type is invariant in the methods builder
// generic. `useProgram()` returns `Program<Levx> | null`.
type AnchorProgramValue = Program<Levx> | null

const AnchorProgramContext = createContext<AnchorProgramValue>(null)

export function AnchorProgramProvider({ children }: PropsWithChildren) {
  const program = useProgram()

  return <AnchorProgramContext.Provider value={program}>{children}</AnchorProgramContext.Provider>
}

export function useAnchorProgram(): AnchorProgramValue {
  return useContext(AnchorProgramContext)
}
