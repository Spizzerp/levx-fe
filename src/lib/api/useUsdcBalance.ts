import { useQuery } from '@tanstack/react-query'
import { useConnection } from '@solana/wallet-adapter-react'
import { getAssociatedTokenAddress, getAccount, TokenAccountNotFoundError } from '@solana/spl-token'
import { PublicKey } from '@solana/web3.js'

import { useWalletStore } from '@/stores/walletStore'
import { getReadOnlyProgram } from '@/lib/solana/program'
import { deriveProtocolPda } from '@/lib/solana/pda'

interface UsdcBalanceData {
  /** Mint pubkey of the protocol's collateral mint. */
  mint: PublicKey
  /** Associated token account owned by the wallet for `mint`. May not exist yet. */
  ata: PublicKey
  /** Balance in human (post-SCALE) USDC units. 0 if the ATA doesn't exist. */
  balance: number
}

const COLLATERAL_DECIMALS = 6

/**
 * Reads the protocol's collateral mint from `ProtocolState`, derives the
 * connected wallet's ATA, fetches the balance.
 *
 * Returns 0 (not an error) when the ATA doesn't exist yet — that's the
 * common state for a fresh wallet before its first faucet request, and
 * the caller can prompt the user to use the in-app faucet.
 *
 * Wired through React Query so PR2's `WagerPlaced` / `PositionExited` /
 * `ClaimPaid` invalidations refresh the balance live.
 */
export function useUsdcBalance() {
  const wallet = useWalletStore((s) => s.publicKey)
  const walletKey = wallet?.toBase58() ?? null
  const { connection } = useConnection()

  return useQuery<UsdcBalanceData | null>({
    queryKey: ['usdcBalance', walletKey],
    queryFn: async () => {
      if (!wallet) return null
      // ProtocolState is effectively immutable for a session — could be
      // module-cached, but the query already dedupes via React Query.
      const program = getReadOnlyProgram()
      const [protocolPda] = deriveProtocolPda()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const protocolState: any = await program.account.protocolState.fetch(protocolPda)
      const mint: PublicKey = protocolState.collateralMint
      const ata = await getAssociatedTokenAddress(mint, wallet, true)
      try {
        const acc = await getAccount(connection, ata)
        const balance = Number(acc.amount) / 10 ** COLLATERAL_DECIMALS
        return { mint, ata, balance }
      } catch (e) {
        if (e instanceof TokenAccountNotFoundError) {
          return { mint, ata, balance: 0 }
        }
        throw e
      }
    },
    enabled: !!wallet,
    staleTime: 5_000,
    refetchInterval: 30_000,
  })
}
