import { describe, expect, it } from 'vitest'
import {
  assertCurrentPathOutcomeLayout,
  PATH_OUTCOME_FIXED_ACCOUNT_SIZE,
  PATH_OUTCOME_GENERATION_METHOD_OFFSET,
} from '../onchain'

/** A minimal current-layout PathOutcome: one chunk, no inline prices, the given origin ordinal. */
function pathOutcomeBytes(originOrdinal: number): Uint8Array {
  const data = new Uint8Array(PATH_OUTCOME_FIXED_ACCOUNT_SIZE)
  data[PATH_OUTCOME_GENERATION_METHOD_OFFSET - 2] = 1 // chunk_count
  data[PATH_OUTCOME_GENERATION_METHOD_OFFSET] = originOrdinal
  return data
}

describe('assertCurrentPathOutcomeLayout', () => {
  it('accepts every PathOrigin ordinal the program emits: Ai (0), UserDrawn (1), External (2)', () => {
    for (const ordinal of [0, 1, 2]) {
      expect(() => assertCurrentPathOutcomeLayout(pathOutcomeBytes(ordinal), 'path')).not.toThrow()
    }
  })

  it('still refuses an origin ordinal the program does not define', () => {
    expect(() => assertCurrentPathOutcomeLayout(pathOutcomeBytes(3), 'path')).toThrow(/legacy\/incompatible/)
  })
})
