import { afterEach, describe, expect, it, vi } from 'vitest'

import { logTransactionError } from '../logTransactionError'

describe('logTransactionError', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs full simulation details outside the truncated toast path', async () => {
    const group = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => undefined)
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const groupEnd = vi.spyOn(console, 'groupEnd').mockImplementation(() => undefined)

    const txError = Object.assign(
      new Error(
        'Simulation failed. Message: Transaction simulation failed: Error processing Instruction 3',
      ),
      {
        logs: [
          'Program ComputeBudget111111111111111111111111111111 invoke [1]',
          'Program log: AnchorError caused by account: creator. Error Code: Unauthorized.',
        ],
      },
    )

    await logTransactionError('admin.createMarket sendAndConfirm failed', txError, {
      details: {
        instructionLabels: [
          '0: setComputeUnitLimit',
          '1: setComputeUnitPrice',
          '2: createAssociatedTokenAccountIdempotent',
          '3: createMarket',
        ],
      },
    })

    const infoOutput = info.mock.calls.flat().join('\n')

    expect(group).toHaveBeenCalledWith('[tx:error] admin.createMarket sendAndConfirm failed')
    expect(error).toHaveBeenCalledWith('Raw error', txError)
    expect(info).toHaveBeenCalledWith(
      'Context',
      expect.objectContaining({
        instructionLabels: expect.arrayContaining(['3: createMarket']),
      }),
    )
    expect(infoOutput).toContain('Program log: AnchorError caused by account: creator')
    expect(groupEnd).toHaveBeenCalled()
  })
})
