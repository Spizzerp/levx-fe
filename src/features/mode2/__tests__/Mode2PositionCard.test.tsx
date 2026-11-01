import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Mode2PositionCard } from '../Mode2PositionCard'
import type { PathPosition, PositionSummary } from '../position'

const USDC = 1_000_000n

/** 20 USDC at 2.5× on Mode 1 path 3 and 20 USDC at 2.0× on path 4. */
const PATHS: PathPosition[] = [
  {
    slot: 0,
    pathIndex: 3,
    leverage: 2.5,
    principal: 20n * USDC,
    valueWithLeverage: 50n * USDC,
    maxWin: 29_700_000n,
    fee: 300_000n,
    maxLoss: 20n * USDC,
    finalPayout: null,
  },
  {
    slot: 2,
    pathIndex: 4,
    leverage: 2,
    principal: 20n * USDC,
    valueWithLeverage: 40n * USDC,
    maxWin: 39_800_000n,
    fee: 200_000n,
    maxLoss: 20n * USDC,
    finalPayout: null,
  },
]

const PATH_LABELS = {
  3: { name: 'Path 1', direction: 'LONG' as const },
  4: { name: 'Path 2', direction: 'SHORT' as const },
}

function summary(o: Partial<PositionSummary> = {}): PositionSummary {
  return {
    status: 'waiting',
    principal: 40n * USDC,
    checkpoint: 0,
    totalCheckpoints: 6,
    finalPayout: null,
    paid: null,
    paths: PATHS,
    ...o,
  }
}

function renderCard(o: Partial<PositionSummary> = {}) {
  return render(<Mode2PositionCard summary={summary(o)} pathLabels={PATH_LABELS} />)
}

const card = () => screen.getByRole('region', { name: 'Leveraged positions' })
const summaryBlock = (name: string) => within(card()).getByRole('group', { name })

describe('Mode2PositionCard', () => {
  it('shows the principal and when the estimate starts while waiting for the start', () => {
    renderCard()
    expect(within(card()).getByText('Waiting for the start')).toBeInTheDocument()
    const block = summaryBlock('Principal')
    expect(block).toHaveTextContent('40.00 USDC')
    expect(within(block).getByText('Estimate from checkpoint 4')).toBeInTheDocument()
  })

  it('shows the checkpoint reached while running', () => {
    renderCard({ status: 'running', checkpoint: 2 })
    expect(within(card()).getByText('Running · checkpoint 2 of 6')).toBeInTheDocument()
    const block = summaryBlock('Principal')
    expect(block).toHaveTextContent('40.00 USDC')
    expect(within(block).getByText('Estimate from checkpoint 4')).toBeInTheDocument()
  })

  it('shows the final result and when it is paid once the result is in', () => {
    renderCard({
      status: 'result-in',
      checkpoint: 6,
      finalPayout: 54_500_000n,
      paths: [
        { ...PATHS[0], finalPayout: 34_700_000n },
        { ...PATHS[1], finalPayout: 19_800_000n },
      ],
    })
    expect(within(card()).getByText('Result in')).toBeInTheDocument()
    const block = summaryBlock('Final result')
    expect(block).toHaveTextContent('54.50 USDC')
    expect(block).toHaveTextContent('+14.50')
    expect(
      within(block).getByText('Paid to your wallet automatically after the review period'),
    ).toBeInTheDocument()
    const path = within(card()).getByRole('group', { name: 'Path 1 · LONG' })
    expect(within(path).getByRole('definition', { name: 'Final result' })).toHaveTextContent(
      '34.70 USDC',
    )
  })

  it('shows the amount paid to the wallet once paid', () => {
    renderCard({ status: 'paid', checkpoint: 6, paid: 54_500_000n, paths: [] })
    expect(within(card()).getByText('Paid')).toBeInTheDocument()
    const block = summaryBlock('Paid to your wallet')
    expect(block).toHaveTextContent('54.50 USDC')
    expect(block).toHaveTextContent('+14.50')
  })

  it('shows the principal refunded when voided', () => {
    renderCard({ status: 'voided', checkpoint: 3 })
    expect(within(card()).getByText('Voided')).toBeInTheDocument()
    expect(summaryBlock('Refunded to your wallet')).toHaveTextContent('40.00 USDC')
  })

  it('opens a path dropdown to show its breakdown', async () => {
    const user = userEvent.setup()
    renderCard()
    const first = within(card()).getByRole('group', { name: 'Path 1 · LONG' })
    const second = within(card()).getByRole('group', { name: 'Path 2 · SHORT' })
    expect(first).toHaveAttribute('open')
    expect(second).not.toHaveAttribute('open')

    await user.click(within(second).getByText('Path 2 · SHORT'))

    expect(second).toHaveAttribute('open')
    expect(within(second).getByRole('definition', { name: 'Leverage' })).toHaveTextContent('2.0×')
    expect(within(second).getByRole('definition', { name: 'Principal' })).toHaveTextContent(
      '20.00 USDC',
    )
    expect(within(second).getByRole('definition', { name: 'Max win' })).toHaveTextContent(
      '+39.80 USDC',
    )
    expect(
      within(second).getByRole('definition', { name: 'Fee (taken from the payout)' }),
    ).toHaveTextContent('0.20 USDC')
    expect(within(second).getByRole('definition', { name: 'Max loss' })).toHaveTextContent(
      '20.00 USDC',
    )
  })
})
