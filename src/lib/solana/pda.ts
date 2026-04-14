import { PublicKey } from '@solana/web3.js'
import { BN } from '@coral-xyz/anchor'

import { env } from '@/env/env.config'

export const PROGRAM_ID = new PublicKey(env.APP_PROGRAM_ID)

export function deriveMarketPda(marketId: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('market'), new BN(marketId).toArrayLike(Buffer, 'le', 8)],
    PROGRAM_ID,
  )
}

export function derivePathPda(marketId: number, pathIndex: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('path'), new BN(marketId).toArrayLike(Buffer, 'le', 8), Buffer.from([pathIndex])],
    PROGRAM_ID,
  )
}

export function derivePositionPda(
  marketId: number,
  user: PublicKey,
  pathIndex: number,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('position'),
      new BN(marketId).toArrayLike(Buffer, 'le', 8),
      user.toBuffer(),
      Buffer.from([pathIndex]),
    ],
    PROGRAM_ID,
  )
}

export function deriveSamplePda(marketId: number, checkpointIndex: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('sample'),
      new BN(marketId).toArrayLike(Buffer, 'le', 8),
      new BN(checkpointIndex).toArrayLike(Buffer, 'le', 2),
    ],
    PROGRAM_ID,
  )
}

export function deriveProtocolPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('protocol')], PROGRAM_ID)
}

export function deriveEigenCachePda(marketId: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('eigen'), new BN(marketId).toArrayLike(Buffer, 'le', 8)],
    PROGRAM_ID,
  )
}
