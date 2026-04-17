// @vitest-environment node
// ComputeBudgetProgram encodes instruction data via @solana/buffer-layout,
// which rejects jsdom's Buffer (not a Uint8Array). Run this file in node.

import { describe, it, expect } from 'vitest'
import { ComputeBudgetProgram, PublicKey, type TransactionInstruction } from '@solana/web3.js'
import { buildTransaction } from '@/lib/chain/buildTransaction'

function makeIx(): TransactionInstruction {
  return {
    keys: [],
    programId: new PublicKey('11111111111111111111111111111111'),
    data: new Uint8Array(),
  } as unknown as TransactionInstruction
}

describe('buildTransaction', () => {
  it('passes instructions through unchanged when no budget knobs are set', async () => {
    const ix1 = makeIx()
    const ix2 = makeIx()
    const out = await buildTransaction({ instructions: [ix1, ix2] })
    expect(out).toEqual([ix1, ix2])
    expect(out[0]).toBe(ix1)
    expect(out[1]).toBe(ix2)
  })

  it('prepends a setComputeUnitLimit instruction when computeUnitLimit is provided', async () => {
    const ix = makeIx()
    const out = await buildTransaction({ instructions: [ix], computeUnitLimit: 300_000 })
    expect(out).toHaveLength(2)
    expect(out[0].programId.equals(ComputeBudgetProgram.programId)).toBe(true)
    expect(out[1]).toBe(ix)
  })

  it('prepends a setComputeUnitPrice instruction when priorityFeeMicroLamports is provided', async () => {
    const ix = makeIx()
    const out = await buildTransaction({ instructions: [ix], priorityFeeMicroLamports: 42_000 })
    expect(out).toHaveLength(2)
    expect(out[0].programId.equals(ComputeBudgetProgram.programId)).toBe(true)
    expect(out[1]).toBe(ix)
  })

  it('prepends both budget instructions in order [limit, price, …user ixs]', async () => {
    const ix = makeIx()
    const out = await buildTransaction({
      instructions: [ix],
      computeUnitLimit: 600_000,
      priorityFeeMicroLamports: 10_000,
    })
    expect(out).toHaveLength(3)
    expect(out[0].programId.equals(ComputeBudgetProgram.programId)).toBe(true)
    expect(out[1].programId.equals(ComputeBudgetProgram.programId)).toBe(true)
    expect(out[2]).toBe(ix)
    // discriminator byte 2 = setComputeUnitLimit, 3 = setComputeUnitPrice
    expect(out[0].data[0]).toBe(2)
    expect(out[1].data[0]).toBe(3)
  })

  it('returns a Promise<TransactionInstruction[]>', async () => {
    const result = buildTransaction({ instructions: [] })
    expect(typeof (result as Promise<unknown>).then).toBe('function')
    const resolved = await result
    expect(Array.isArray(resolved)).toBe(true)
    expect(resolved).toEqual([])
  })
})
