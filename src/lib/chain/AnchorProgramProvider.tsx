import { createContext, useContext, type PropsWithChildren } from 'react'
import type { Program } from '@coral-xyz/anchor'

import { useProgram } from '@/lib/solana/program'

type AnchorProgramValue = Program | null

const AnchorProgramContext = createContext<AnchorProgramValue>(null)

export function AnchorProgramProvider({ children }: PropsWithChildren) {
  const program = useProgram()

  return <AnchorProgramContext.Provider value={program}>{children}</AnchorProgramContext.Provider>
}

export function useAnchorProgram(): AnchorProgramValue {
  return useContext(AnchorProgramContext)
}
