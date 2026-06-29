import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const useMode2ReadinessMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api/hooks', () => ({
  useMode2Readiness: useMode2ReadinessMock,
}))

vi.mock('@/layouts/PageLayout', () => ({
  PageLayout: ({
    title,
    subtitle,
    children,
  }: {
    title: string
    subtitle?: string
    children: React.ReactNode
  }) => (
    <div>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
      {children}
    </div>
  ),
}))

import { VaultPage } from '@/routes/pages/VaultPage'

describe('VaultPage', () => {
  it('shows dormant Mode 2 readiness while keeping vault actions disabled', () => {
    useMode2ReadinessMock.mockReturnValue({
      isLoading: false,
      data: {
        leverageEnabled: false,
        leverageConfig: {
          address: 'config',
          authority: 'authority',
          status: 'accepted',
          currentParams: {
            maxLeverage: 5,
            maxMarketLeveragedOi: 40_000,
            maxPairLeveragedOi: 100_000,
            maxPathLeveragedOi: 10_000,
            maxPathClusterLeveragedOi: 25_000,
            vaultUtilizationCeilingBps: 7500,
            borrowBaseRateBps: 100,
            borrowKinkUtilizationBps: 6000,
            borrowKinkRateBps: 800,
            borrowMaxRateBps: 2000,
            liquidationThreshold: 1.15,
            keeperRewardBps: 50,
            profitWarmupCheckpoints: 4,
            minPairBufferBps: 2500,
          },
          pendingParams: {
            maxLeverage: 5,
            maxMarketLeveragedOi: 40_000,
            maxPairLeveragedOi: 100_000,
            maxPathLeveragedOi: 10_000,
            maxPathClusterLeveragedOi: 25_000,
            vaultUtilizationCeilingBps: 7500,
            borrowBaseRateBps: 100,
            borrowKinkUtilizationBps: 6000,
            borrowKinkRateBps: 800,
            borrowMaxRateBps: 2000,
            liquidationThreshold: 1.15,
            keeperRewardBps: 50,
            profitWarmupCheckpoints: 4,
            minPairBufferBps: 2500,
          },
          simulatorOutputHash: '01'.repeat(32),
          pendingSimulatorOutputHash: '02'.repeat(32),
          activationDelaySeconds: 86_400,
          stagedAt: 1_700_000_000_000,
          acceptedAt: 1_700_086_400_000,
        },
        pairRiskStates: [
          {
            address: 'pair',
            authority: 'authority',
            baseMint: 'So11111111111111111111111111111111111111112',
            quoteMint: 'BPFLoader1111111111111111111111111111111111',
            status: 'active',
            maxPairLeveragedOi: 100_000,
            maxLeverage: 5,
            bufferTargetBps: 2500,
            bufferDrainThresholdBps: 1500,
            bufferReopenThresholdBps: 3000,
            lastStatusChange: 1_700_000_000_000,
            configHash: '03'.repeat(32),
          },
        ],
      },
    })

    render(<VaultPage />)

    expect(screen.getByText('Dormant Config')).toBeInTheDocument()
    expect(screen.getByText('accepted')).toBeInTheDocument()
    expect(screen.getByText('$100,000')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'deposit' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'withdraw' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Disabled' })).toBeDisabled()
  })
})
