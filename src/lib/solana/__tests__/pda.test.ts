// @vitest-environment node

import { BN } from '@coral-xyz/anchor'
import { PublicKey } from '@solana/web3.js'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/env/env.config', () => ({
  env: {
    APP_PROGRAM_ID: 'LEVXqi1Z2XujBw2jAEP15Dv8LyrDetDR95KZGGQNobV',
    APP_RPC_URL: 'http://localhost:8899',
    APP_HERMES_URL: 'https://hermes.pyth.network',
    APP_NETWORK: 'devnet',
    APP_SUPABASE_URL: 'http://localhost:54321',
    APP_SUPABASE_ANON_KEY: 'anon',
    APP_ADMIN_WALLETS: [],
    APP_PATH_UPLOAD_RELAY_FEE_LAMPORTS: 50_000,
    APP_EIGENCACHE_QUOTES_ENABLED: false,
  },
}))

import {
  PROGRAM_ID,
  deriveLeverageConfigPda,
  derivePairRiskStatePda,
} from '@/lib/solana/pda'

describe('Mode 2 PDA helpers', () => {
  it('derives the singleton leverage config PDA from the program seed', () => {
    const expected = PublicKey.findProgramAddressSync([Buffer.from('leverage_config')], PROGRAM_ID)

    expect(deriveLeverageConfigPda()).toEqual(expected)
  })

  it('derives pair risk state PDA from base and quote mint seeds', () => {
    const baseMint = new PublicKey('So11111111111111111111111111111111111111112')
    const quoteMint = new PublicKey('BPFLoader1111111111111111111111111111111111')
    const expected = PublicKey.findProgramAddressSync(
      [Buffer.from('pair_risk_state'), baseMint.toBuffer(), quoteMint.toBuffer()],
      PROGRAM_ID,
    )

    expect(derivePairRiskStatePda(baseMint, quoteMint)).toEqual(expected)
  })

  it('does not reuse market-id based seeds', () => {
    const baseMint = new PublicKey('So11111111111111111111111111111111111111112')
    const quoteMint = new PublicKey('BPFLoader1111111111111111111111111111111111')
    const [pairRiskPda] = derivePairRiskStatePda(baseMint, quoteMint)
    const [marketLikePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('pair_risk_state'), new BN(1).toArrayLike(Buffer, 'le', 8)],
      PROGRAM_ID,
    )

    expect(pairRiskPda.toBase58()).not.toBe(marketLikePda.toBase58())
  })
})
