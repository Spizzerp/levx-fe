import { Profiler } from 'react'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LivePriceDot } from '@/features/market/LivePriceDot'
import { priceSource } from '@/lib/price/source'
import type { FeedState } from '@/lib/price'
import { PYTH_FEED_IDS } from '@/lib/pyth/feedIds'
import { usePriceStore } from '@/stores/priceStore'

vi.mock('@/lib/price/source', () => ({ priceSource: vi.fn(() => 'free') }))

const FEED = PYTH_FEED_IDS['SOL/USDC']

const LEVELED_COPY =
  "Live price from Coinbase trades, kept on Pyth's level. Markets settle on Pyth."
const UNLEVELED_COPY =
  "Live price from Coinbase trades. Pyth's level isn't available for this pair."
const PYTH_COPY = 'Live price from Pyth.'
const DELAYED_COPY = "Price delayed: the live price stream isn't updating."

function setFeed(state: FeedState) {
  act(() => usePriceStore.getState().setFeedState(FEED, state))
}

describe('LivePriceDot', () => {
  beforeEach(() => {
    usePriceStore.setState({ ticks: {}, feeds: {}, levels: {}, trails: {} })
  })

  afterEach(() => {
    vi.mocked(priceSource).mockReturnValue('free')
  })

  it('shows Live with the leveled hover copy', () => {
    setFeed({ status: 'live', leveled: true, levelAgeSec: 12 })
    render(<LivePriceDot feedId={FEED} />)

    expect(screen.getByTitle(LEVELED_COPY)).toHaveTextContent('Live')
  })

  it('shows the level age in minutes when the level is old', () => {
    setFeed({ status: 'live', leveled: true, levelAgeSec: 7 * 60 + 42 })
    render(<LivePriceDot feedId={FEED} />)

    expect(
      screen.getByTitle(
        "Live price from Coinbase trades. Pyth's level last updated 7 min ago. Markets settle on Pyth.",
      ),
    ).toHaveTextContent('Live')
  })

  it('shows the unleveled copy for a pair without a sponsored account', () => {
    setFeed({ status: 'live', leveled: false, levelAgeSec: null })
    render(<LivePriceDot feedId={FEED} />)

    expect(screen.getByTitle(UNLEVELED_COPY)).toHaveTextContent('Live')
  })

  it('shows Delayed with its copy', () => {
    setFeed({ status: 'delayed', leveled: false, levelAgeSec: null })
    render(<LivePriceDot feedId={FEED} />)

    expect(screen.getByTitle(DELAYED_COPY)).toHaveTextContent('Delayed')
    expect(screen.queryByText('Live')).not.toBeInTheDocument()
  })

  it('shows the Pyth copy in pyth mode', () => {
    vi.mocked(priceSource).mockReturnValue('pyth')
    setFeed({ status: 'live', leveled: true, levelAgeSec: 0 })
    render(<LivePriceDot feedId={FEED} />)

    expect(screen.getByTitle(PYTH_COPY)).toHaveTextContent('Live')
  })

  it('renders nothing for a null feed id or before the feed reports', () => {
    const { container, rerender } = render(<LivePriceDot feedId={FEED} />)
    expect(container).toBeEmptyDOMElement()

    setFeed({ status: 'live', leveled: true, levelAgeSec: 12 })
    rerender(<LivePriceDot feedId={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('does not re-render while only the level age moves within its minute', () => {
    const onRender = vi.fn()
    setFeed({ status: 'live', leveled: true, levelAgeSec: 12 })
    render(
      <Profiler id="dot" onRender={onRender}>
        <LivePriceDot feedId={FEED} />
      </Profiler>,
    )
    expect(onRender).toHaveBeenCalledTimes(1)

    setFeed({ status: 'live', leveled: true, levelAgeSec: 13 })
    setFeed({ status: 'live', leveled: true, levelAgeSec: 4 * 60 })
    setFeed({ status: 'live', leveled: true, levelAgeSec: 4 * 60 + 30 })
    expect(onRender).toHaveBeenCalledTimes(2)
    expect(screen.getByTitle(/last updated 4 min ago/)).toHaveTextContent('Live')
  })
})
