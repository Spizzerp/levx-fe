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

function groupKeyHashBytes(groupKeyHash: Uint8Array | number[] | Buffer | string): Buffer {
  if (typeof groupKeyHash === 'string') {
    const hex = groupKeyHash.startsWith('0x') ? groupKeyHash.slice(2) : groupKeyHash
    if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
      throw new Error('groupKeyHash must be a 32-byte hex string')
    }
    return Buffer.from(hex, 'hex')
  }
  const bytes = Buffer.from(groupKeyHash)
  if (bytes.length !== 32) {
    throw new Error('groupKeyHash must be 32 bytes')
  }
  return bytes
}

export function deriveMarketGroupPda(
  groupKeyHash: Uint8Array | number[] | Buffer | string,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('market_group'), groupKeyHashBytes(groupKeyHash)],
    PROGRAM_ID,
  )
}

export function deriveMarketGroupLinkPda(marketId: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('market_group_link'), new BN(marketId).toArrayLike(Buffer, 'le', 8)],
    PROGRAM_ID,
  )
}

export function deriveLeverageConfigPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('leverage_config')], PROGRAM_ID)
}

export function derivePairRiskStatePda(
  baseMint: PublicKey,
  quoteMint: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('pair_risk_state'), baseMint.toBuffer(), quoteMint.toBuffer()],
    PROGRAM_ID,
  )
}

export function derivePathPda(marketId: number, pathIndex: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('path'), new BN(marketId).toArrayLike(Buffer, 'le', 8), Buffer.from([pathIndex])],
    PROGRAM_ID,
  )
}

export function derivePathUploadPda(
  marketId: number,
  creator: PublicKey,
  nonce: number | BN,
): [PublicKey, number] {
  const nonceBn = BN.isBN(nonce) ? nonce : new BN(nonce)
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('path_upload'),
      new BN(marketId).toArrayLike(Buffer, 'le', 8),
      creator.toBuffer(),
      nonceBn.toArrayLike(Buffer, 'le', 8),
    ],
    PROGRAM_ID,
  )
}

export function derivePathChunkPda(pathUpload: PublicKey, chunkIndex: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('path_chunk'), pathUpload.toBuffer(), Buffer.from([chunkIndex])],
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
