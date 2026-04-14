import { useMemo } from 'react'

import { AnchorProvider, type Idl, Program } from '@coral-xyz/anchor'
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react'
import { Connection } from '@solana/web3.js'

import { env } from '@/env/env.config'
import idlJson from '@/idl/levx.json'

const idl = idlJson as Idl

/**
 * Read-only connection for fetching account data without a wallet.
 * Useful for market listings and public data queries.
 */
export function getReadOnlyProvider(): AnchorProvider {
  const connection = new Connection(env.APP_RPC_URL, 'confirmed')
  return new AnchorProvider(connection, {} as never, { commitment: 'confirmed' })
}

/** Read-only program instance — no wallet needed. */
export function getReadOnlyProgram(): Program {
  return new Program(idl, getReadOnlyProvider())
}

/**
 * React hook: returns a typed Program instance backed by the connected wallet.
 * Returns null if no wallet is connected.
 */
export function useProgram(): Program | null {
  const { connection } = useConnection()
  const wallet = useAnchorWallet()

  return useMemo(() => {
    if (!wallet) return null
    const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' })
    return new Program(idl, provider)
  }, [connection, wallet])
}

export { idl }
