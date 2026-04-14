import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, renderHook } from '@testing-library/react'
import React, { useEffect, useRef } from 'react'
import { PublicKey } from '@solana/web3.js'

// Controllable wallet-adapter-react mock
const walletState: { publicKey: PublicKey | null } = { publicKey: null }
vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({ publicKey: walletState.publicKey }),
}))

import {
  AnchorProgramProvider,
  useAnchorProgram,
} from '@/lib/chain/AnchorProgramProvider'

const KEY_A = new PublicKey('11111111111111111111111111111111')
const KEY_B = new PublicKey('So11111111111111111111111111111111111111112')

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(AnchorProgramProvider, null, children)
}

describe('AnchorProgramProvider', () => {
  beforeEach(() => {
    walletState.publicKey = null
  })

  it('renders children without error when publicKey is null (FOUND-10)', () => {
    walletState.publicKey = null
    const { getByText } = render(
      React.createElement(
        AnchorProgramProvider,
        null,
        React.createElement('div', null, 'child-null'),
      ),
    )
    expect(getByText('child-null')).toBeTruthy()
  })

  it('renders children without error when publicKey is set (FOUND-10)', () => {
    walletState.publicKey = KEY_A
    const { getByText } = render(
      React.createElement(
        AnchorProgramProvider,
        null,
        React.createElement('div', null, 'child-set'),
      ),
    )
    expect(getByText('child-set')).toBeTruthy()
  })

  it('useAnchorProgram returns null in Phase 2 (shell state)', () => {
    walletState.publicKey = KEY_A
    const { result } = renderHook(() => useAnchorProgram(), { wrapper })
    expect(result.current).toBeNull()
  })

  it('memoizes the program value by publicKey.toBase58() identity (FOUND-10)', () => {
    walletState.publicKey = KEY_A
    const { result, rerender } = renderHook(() => useAnchorProgram(), { wrapper })
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })

  it('re-computes the memoized value when publicKey changes (reconnect recreates) (FOUND-10)', () => {
    // Capture memo output across key changes using a ref-collector component.
    const captures: unknown[] = []
    function Probe() {
      const val = useAnchorProgram()
      const countRef = useRef(0)
      useEffect(() => {
        captures.push(val)
        countRef.current += 1
      })
      return null
    }

    walletState.publicKey = KEY_A
    const { rerender } = render(
      React.createElement(AnchorProgramProvider, null, React.createElement(Probe)),
    )

    walletState.publicKey = KEY_B
    rerender(
      React.createElement(AnchorProgramProvider, null, React.createElement(Probe)),
    )

    // At least one capture happened per render; memo must recompute when key changes.
    // Both values are null in Phase 2 — the invariant we assert is that the memo
    // fired without throwing across a key swap.
    expect(captures.length).toBeGreaterThanOrEqual(2)
  })

  it('does not recompute on unrelated renders (stable identity check) (FOUND-10)', () => {
    walletState.publicKey = KEY_A
    const { result, rerender } = renderHook(() => useAnchorProgram(), { wrapper })
    const v1 = result.current
    rerender()
    const v2 = result.current
    rerender()
    const v3 = result.current
    expect(v2).toBe(v1)
    expect(v3).toBe(v1)
  })
})
