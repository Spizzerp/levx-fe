import { PublicKey } from '@solana/web3.js'

export const PATH_CHUNK_SIZE = 40
export const MAX_CHECKPOINTS = 480
export const MAX_PATH_UPLOAD_CHUNKS = 12

const PATH_CHUNK_HASH_DOMAIN = new TextEncoder().encode('levx:path-chunk:v1')
const PATH_ROOT_HASH_DOMAIN = new TextEncoder().encode('levx:path-root:v1')

export interface PathChunkPayload {
  chunkIndex: number
  prices: number[]
  chunkHash: Uint8Array
}

function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function u8(value: number): Uint8Array {
  return Uint8Array.of(value)
}

function u16Le(value: number): Uint8Array {
  const out = new Uint8Array(2)
  new DataView(out.buffer).setUint16(0, value, true)
  return out
}

function u64Le(value: number | bigint): Uint8Array {
  const out = new Uint8Array(8)
  new DataView(out.buffer).setBigUint64(0, BigInt(value), true)
  return out
}

async function sha256(parts: readonly Uint8Array[]): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', concatBytes(parts)))
}

export function chunkPrices(prices: readonly number[]): number[][] {
  if (prices.length <= 0 || prices.length > MAX_CHECKPOINTS) {
    throw new Error(`Path must contain 1-${MAX_CHECKPOINTS} checkpoints`)
  }
  const chunks: number[][] = []
  for (let i = 0; i < prices.length; i += PATH_CHUNK_SIZE) {
    chunks.push([...prices.slice(i, i + PATH_CHUNK_SIZE)])
  }
  if (chunks.length > MAX_PATH_UPLOAD_CHUNKS) {
    throw new Error(`Path cannot exceed ${MAX_PATH_UPLOAD_CHUNKS} chunks`)
  }
  return chunks
}

export async function computePathChunkHash(
  marketId: number,
  pathUpload: PublicKey,
  chunkIndex: number,
  prices: readonly number[],
): Promise<Uint8Array> {
  const priceBytes = concatBytes(prices.map((price) => u64Le(price)))
  return sha256([
    PATH_CHUNK_HASH_DOMAIN,
    u64Le(marketId),
    pathUpload.toBytes(),
    u8(chunkIndex),
    u8(prices.length),
    priceBytes,
  ])
}

export async function computePathRoot(
  marketId: number,
  creator: PublicKey,
  generationMethodOrdinal: number,
  numCheckpoints: number,
  chunkHashes: readonly Uint8Array[],
): Promise<Uint8Array> {
  return sha256([
    PATH_ROOT_HASH_DOMAIN,
    u64Le(marketId),
    creator.toBytes(),
    u8(generationMethodOrdinal),
    u16Le(numCheckpoints),
    u8(chunkHashes.length),
    concatBytes(chunkHashes),
  ])
}

export async function buildPathChunks(
  marketId: number,
  pathUpload: PublicKey,
  fixedPointPrices: readonly number[],
): Promise<PathChunkPayload[]> {
  const chunks = chunkPrices(fixedPointPrices)
  return Promise.all(
    chunks.map(async (prices, chunkIndex) => ({
      chunkIndex,
      prices,
      chunkHash: await computePathChunkHash(marketId, pathUpload, chunkIndex, prices),
    })),
  )
}
