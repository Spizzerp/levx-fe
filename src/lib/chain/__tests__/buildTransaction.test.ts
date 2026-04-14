import { describe, it, expect } from 'vitest'
import { PublicKey, type TransactionInstruction } from '@solana/web3.js'
import { buildTransaction } from '@/lib/chain/buildTransaction'

function makeIx(): TransactionInstruction {
  return {
    keys: [],
    programId: new PublicKey('11111111111111111111111111111111'),
    data: new Uint8Array(),
  } as unknown as TransactionInstruction
}

describe('buildTransaction', () => {
  it('returns the provided instructions array unchanged in Phase 2 (shell stub) (FOUND-12)', async () => {
    const ix1 = makeIx()
    const ix2 = makeIx()
    const out = await buildTransaction({ instructions: [ix1, ix2] })
    expect(out).toEqual([ix1, ix2])
    expect(out[0]).toBe(ix1)
    expect(out[1]).toBe(ix2)
  })

  it('accepts optional computeUnitLimit and priorityFeeMicroLamports fields without throwing (FOUND-12)', async () => {
    const ix = makeIx()
    const out = await buildTransaction({
      instructions: [ix],
      computeUnitLimit: 200_000,
      priorityFeeMicroLamports: 50,
    })
    expect(out).toEqual([ix])
  })

  it('exported as an async function returning TransactionInstruction[] (FOUND-12)', async () => {
    const result = buildTransaction({ instructions: [] })
    // Promise check
    expect(typeof (result as Promise<unknown>).then).toBe('function')
    const resolved = await result
    expect(Array.isArray(resolved)).toBe(true)
    expect(resolved).toEqual([])
  })
})
