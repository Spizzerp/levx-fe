import { describe, it } from 'vitest'

describe('AnchorProgramProvider', () => {
  it.todo('renders children without error when publicKey is null (FOUND-10)')
  it.todo('renders children without error when publicKey is set (FOUND-10)')
  it.todo('useAnchorProgram returns null in Phase 2 (shell state)')
  it.todo('memoizes the program value by publicKey.toBase58() identity (FOUND-10)')
  it.todo('re-computes the memoized value when publicKey changes (reconnect recreates) (FOUND-10)')
  it.todo('does not recompute on unrelated renders (stable identity check) (FOUND-10)')
})
