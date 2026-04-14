import { createContext, useContext, useMemo, type PropsWithChildren } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'

/**
 * Phase 2 shell: context value is always null.
 * Phase 3 will hold a `Program<LevxIdl>` instance constructed from the pinned IDL.
 * Shape is intentionally loose so Phase 3 doesn't need a breaking re-export.
 */
type AnchorProgramValue = unknown | null

const AnchorProgramContext = createContext<AnchorProgramValue>(null)

export function AnchorProgramProvider({ children }: PropsWithChildren) {
  const { publicKey } = useWallet()

  // Memoize by base58 identity so reconnects (new PublicKey instance, same key)
  // do not recompute, but a different wallet does (FOUND-10 key invariant).
  const program = useMemo<AnchorProgramValue>(
    () => {
      if (!publicKey) return null
      // TODO Phase 3: construct AnchorProvider + new Program(levxIdl, provider) here.
      return null
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [publicKey?.toBase58()],
  )

  return <AnchorProgramContext.Provider value={program}>{children}</AnchorProgramContext.Provider>
}

export function useAnchorProgram(): AnchorProgramValue {
  return useContext(AnchorProgramContext)
}
