import type { PropsWithChildren } from 'react'

import { useProgram } from '@/lib/solana/program'
import { AnchorProgramContext } from './anchorProgramContext'

export function AnchorProgramProvider({ children }: PropsWithChildren) {
  const program = useProgram()

  return <AnchorProgramContext.Provider value={program}>{children}</AnchorProgramContext.Provider>
}
