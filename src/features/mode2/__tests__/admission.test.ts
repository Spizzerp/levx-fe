// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { PublicKey, Transaction } from '@solana/web3.js'
import type { Address } from '@solana/kit'
import {
  POLICY_CERTIFIED,
  associatedTokenAddress,
  getAdmitBatchInstructionDataDecoder,
  positionPda,
} from '@spizzerp/levx-mode2-client'
import { buildTransaction } from '@/lib/chain/buildTransaction'
import { buildAdmitInstruction } from '../admission'
import type { PathOrder } from '../precheck'
import { FIXTURE_OWNER, makeGroup, makeView } from './fixtures'

const VIEW = makeView()
const GROUP_0 = VIEW.group!.address as Address
const OFFERS = VIEW.group!.data.offers
/** web3.js's `PACKET_DATA_SIZE`. */
const LEGACY_PACKET_BYTES = 1232

/** `low` units at 2× and `high` at 3× on each of `slots`. */
function split(slots: readonly number[], low: number, high: number): PathOrder[] {
  return slots.map((slot) => ({
    slot,
    parts: [
      { offerSlot: 0, leverage: 2, units: low },
      { offerSlot: 1, leverage: 3, units: high },
    ],
  }))
}

const decodeOrders = (data: Uint8Array) => getAdmitBatchInstructionDataDecoder().decode(data).orders

describe('buildAdmitInstruction', () => {
  it('builds one admit_batch with the owner as signer', () => {
    const { instruction } = buildAdmitInstruction(VIEW, FIXTURE_OWNER, split([0], 1, 1))
    expect(instruction.programId.toBase58()).toBe('A6TNLq28eHjhgvzoYN2FTxGvwEB2j9XWakcED3oEUfbJ')
    expect(instruction.keys).toHaveLength(13)
    const [owner, ownerToken, receipt] = instruction.keys
      .slice(10)
      .map(({ pubkey, isSigner, isWritable }) => ({ key: pubkey.toBase58(), isSigner, isWritable }))
    expect(owner).toEqual({ key: FIXTURE_OWNER, isSigner: true, isWritable: true })
    expect(ownerToken).toEqual({
      key: associatedTokenAddress(FIXTURE_OWNER, VIEW.epoch!.data.mint),
      isSigner: false,
      isWritable: true,
    })
    expect(receipt).toEqual({
      key: positionPda(GROUP_0, FIXTURE_OWNER),
      isSigner: false,
      isWritable: true,
    })
    const signers = instruction.keys
      .filter((key) => key.isSigner)
      .map((key) => key.pubkey.toBase58())
    expect(signers).toEqual([FIXTURE_OWNER])
  })

  it('encodes one order per non-zero part with the offer digest', () => {
    const orders: PathOrder[] = [
      {
        slot: 3,
        parts: [
          { offerSlot: 0, leverage: 2, units: 2 },
          { offerSlot: 1, leverage: 3, units: 0 },
        ],
      },
      {
        slot: 1,
        parts: [
          { offerSlot: 1, leverage: 3, units: 1 },
          { offerSlot: 0, leverage: 2, units: 3 },
        ],
      },
      { slot: 4, parts: [{ offerSlot: 1, leverage: 3, units: 0 }] },
    ]
    const { instruction, positions } = buildAdmitInstruction(VIEW, FIXTURE_OWNER, orders)
    const encoded = decodeOrders(instruction.data).map((order) => ({
      ...order,
      offerDigest: Array.from(order.offerDigest),
    }))
    const digest = (slot: number) => Array.from(OFFERS[slot].digest)
    // Path by path, in each path's part order, without the zero-unit parts.
    expect(encoded).toEqual([
      { ownerIndex: 0, offerSlot: 0, selectedPath: 3, count: 2, offerDigest: digest(0) },
      { ownerIndex: 0, offerSlot: 1, selectedPath: 1, count: 1, offerDigest: digest(1) },
      { ownerIndex: 0, offerSlot: 0, selectedPath: 1, count: 3, offerDigest: digest(0) },
    ])
    expect(positions).toBe(2)
  })

  it('fits a legacy transaction for 4 paths split across 2 offers', async () => {
    const { instruction, computeUnitLimit } = buildAdmitInstruction(
      VIEW,
      FIXTURE_OWNER,
      split([0, 1, 2, 3], 1, 1),
    )
    expect(decodeOrders(instruction.data)).toHaveLength(8)
    const tx = new Transaction().add(
      ...(await buildTransaction({
        instructions: [instruction],
        computeUnitLimit,
        priorityFeeMicroLamports: 10_000,
      })),
    )
    tx.feePayer = new PublicKey(FIXTURE_OWNER)
    tx.recentBlockhash = PublicKey.default.toBase58()
    const wire = tx.serialize({ requireAllSignatures: false, verifySignatures: false })
    expect(wire.length).toBeLessThanOrEqual(LEGACY_PACKET_BYTES)
  })

  it('refuses orders that do not fit a legacy transaction', () => {
    const nine = Array.from({ length: 9 }, (_, slot) => slot)
    expect(() => buildAdmitInstruction(VIEW, FIXTURE_OWNER, split(nine, 1, 1))).toThrow(
      'Too many orders for one transaction',
    )
  })

  it('uses the certified ceiling for a certified group', () => {
    const certified = makeView({
      group: { address: GROUP_0, data: makeGroup({ policy: POLICY_CERTIFIED }) },
    })
    const orders = split([0], 1, 1)
    expect(buildAdmitInstruction(certified, FIXTURE_OWNER, orders).computeUnitLimit).toBe(1_000_150)
    expect(buildAdmitInstruction(VIEW, FIXTURE_OWNER, orders).computeUnitLimit).toBe(300_150)
  })
})
