import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PublicKey } from '@solana/web3.js'

import { useWalletStore } from '@/stores/walletStore'
import type { Market, PredictionPath } from '@/types/market'
import { formatMarketWindow } from '../format'
import { LeverageSection } from '../LeverageSection'
import type { Mode2Forecasts, Mode2MarketView } from '../types'
import {
  FIXTURE_OWNER,
  FIXTURE_START_MS,
  makeGroup,
  makeReceipt,
  makeView,
  todayOffers,
} from './fixtures'

const mutateMock = vi.hoisted(() => vi.fn())
/** The trader's USDC as `useUsdcBalance` reports it, in USDC. */
const wallet = vi.hoisted(() => ({ usdc: 1000 }))

vi.mock('@/features/mode2/api', () => ({
  ADMIT_FEE_LAMPORTS: 10_000,
  useWalletFunds: () => ({ lamports: 1_000_000_000, rentLamports: 2_449_920 }),
  useOpenMode2Positions: () => ({ mutate: mutateMock, isPending: false }),
}))

vi.mock('@/lib/api/useUsdcBalance', () => ({
  useUsdcBalance: () => ({ data: { balance: wallet.usdc } }),
}))

// ConnectGate opens the wallet modal; RequestUsdcButton reads the Supabase session.
vi.mock('@solana/wallet-adapter-react-ui', () => ({
  useWalletModal: () => ({ setVisible: vi.fn(), visible: false }),
}))
vi.mock('@/lib/supabase/hooks', () => ({
  useSupabaseAuth: () => ({ status: 'idle', authenticate: vi.fn() }),
}))

/** Two minutes before the start: entry is open and closes, with the signature margin, in 1:50. */
const NOW_MS = FIXTURE_START_MS - 120_000
const HOUR_MS = 3_600_000

/** The fields the section reads; the rest of a Market is irrelevant here. */
const MARKET = {
  marketId: 142,
  pair: 'SOL/USDC',
  state: 'pending',
  startTime: FIXTURE_START_MS,
  endTime: FIXTURE_START_MS + HOUR_MS,
} as Market

function pathOf(pathIndex: number, label: string, values: readonly number[]): PredictionPath {
  return {
    id: `path-${pathIndex}`,
    label,
    pathIndex,
    data: values.map((value, i) => ({ time: FIXTURE_START_MS + i * 600_000, value })),
  } as PredictionPath
}

/** Mode 1 path 3 is cohort slot 0 and path 4 is slot 2; path 9 (user-drawn) is outside the cohort. */
const PATH_1 = pathOf(3, 'Path 1', [150, 152])
const PATH_2 = pathOf(4, 'Path 2', [150, 148])
const DRAWN = pathOf(9, 'My path', [150, 151])
const FORECASTS: Mode2Forecasts = { slotToPathIndex: [3, 1, 4, 0, 2], prices: [] }

/** Today's offers with the 3× offer (slot 1), or both, at `admitted === maxAdmissions`. */
function viewWithFull(...fullSlots: number[]): Mode2MarketView {
  const view = makeView()
  const offers = todayOffers().map((offer, slot) =>
    fullSlots.includes(slot) ? { ...offer, admitted: offer.maxAdmissions } : offer,
  )
  return { ...view, group: { ...view.group!, data: makeGroup({ offers }) } }
}

/** Today's offers with the 3× offer expiring 5 s from now, inside the signature margin. */
function viewWithThreeXExpiring(): Mode2MarketView {
  const view = makeView()
  const [twoX, threeX] = todayOffers()
  const expiresAt = BigInt(Math.floor((NOW_MS + 5_000) / 1000))
  const offers = [twoX, { ...threeX, expiresAt }]
  return { ...view, group: { ...view.group!, data: makeGroup({ offers }) } }
}

interface SectionProps {
  view: Mode2MarketView
  forecasts: Mode2Forecasts | null
  selectedPaths: PredictionPath[]
}

function renderSection(props: Partial<SectionProps> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const ui = (p: Partial<SectionProps>) => (
    <QueryClientProvider client={queryClient}>
      <LeverageSection
        market={MARKET}
        view={p.view ?? makeView()}
        forecasts={p.forecasts === undefined ? FORECASTS : p.forecasts}
        selectedPaths={p.selectedPaths ?? [PATH_1]}
        nowMs={NOW_MS}
      />
    </QueryClientProvider>
  )
  const result = render(ui(props))
  return {
    rerenderWith: (next: Partial<SectionProps>) => result.rerender(ui({ ...props, ...next })),
  }
}

const principalInput = () => screen.getByRole('textbox', { name: /^Principal/ })

async function enterPrincipal(user: UserEvent, text: string) {
  const input = principalInput()
  await user.clear(input)
  await user.type(input, text)
  await user.tab()
}

const valueOf = (name: string) => screen.getByRole('definition', { name })
const openButton = () => screen.getByRole('button', { name: /^Open/ })
const tick = (leverage: string) => screen.getByRole('button', { name: `Set to ${leverage}` })

describe('LeverageSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    wallet.usdc = 1000
    useWalletStore.setState({
      publicKey: { toBase58: () => FIXTURE_OWNER } as unknown as PublicKey,
      connected: true,
      connecting: false,
      wrongNetwork: false,
      cluster: 'devnet',
    })
  })

  it('shows the window, the slider and the breakdown', () => {
    renderSection({ selectedPaths: [PATH_1, PATH_2, DRAWN] })

    expect(screen.getByText('Leverage open')).toBeInTheDocument()
    expect(screen.getByText('1:50')).toBeInTheDocument()
    expect(tick('2.5×')).toBeEnabled()
    expect(tick('2.0×')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('2×')).toBeInTheDocument()
    expect(screen.getByText('3× max · 1h')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Principal per path' })).toHaveValue('20.00')
    expect(screen.getByText('In steps of 10 USDC')).toBeInTheDocument()

    expect(valueOf('Market')).toHaveTextContent('SOL/USDC')
    expect(valueOf('Duration')).toHaveTextContent(
      formatMarketWindow(FIXTURE_START_MS, FIXTURE_START_MS + HOUR_MS),
    )
    expect(screen.getByText('Path 1 · LONG')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Path 1 · LONG' })).toHaveAttribute('open')
    expect(screen.getByRole('group', { name: 'Path 2 · SHORT' })).not.toHaveAttribute('open')
    expect(
      screen.getByText(
        'A small SOL deposit opens your position record; it comes back when you are paid',
      ),
    ).toBeInTheDocument()
  })

  it('updates value with leverage when the slider moves', async () => {
    const user = userEvent.setup()
    renderSection()
    await enterPrincipal(user, '20')

    expect(screen.getByRole('textbox', { name: 'Principal' })).toBeInTheDocument()
    expect(valueOf('Total value with leverage')).toHaveTextContent('40.00 USDC')
    expect(screen.queryByRole('definition', { name: 'Made of' })).not.toBeInTheDocument()

    await user.click(tick('2.5×'))
    const path = screen.getByRole('group', { name: 'Path 1 · LONG' })
    expect(within(path).getByRole('definition', { name: 'Leverage' })).toHaveTextContent('2.5×')
    expect(within(path).getByRole('definition', { name: 'Made of' })).toHaveTextContent(
      '10.00 at 2× + 10.00 at 3×',
    )
    expect(valueOf('Total value with leverage')).toHaveTextContent('50.00 USDC')

    await user.click(tick('3.0×'))
    expect(valueOf('Total value with leverage')).toHaveTextContent('60.00 USDC')
    expect(valueOf('Total principal')).toHaveTextContent('20.00 USDC')
    expect(valueOf('Total max loss')).toHaveTextContent('20.00 USDC')
    expect(screen.queryByRole('definition', { name: 'Made of' })).not.toBeInTheDocument()
  })

  it('rounds the principal on blur', async () => {
    const user = userEvent.setup()
    renderSection()

    await enterPrincipal(user, '25')
    expect(screen.getByRole('textbox', { name: 'Principal' })).toHaveValue('20.00')
    expect(openButton()).toBeEnabled()

    await enterPrincipal(user, 'abc')
    expect(screen.getByRole('textbox', { name: 'Principal' })).toHaveValue('0.00')
    expect(openButton()).toBeDisabled()
    expect(screen.getByText('Choose a path and a principal')).toBeInTheDocument()
  })

  it('lists a path outside the cohort as not available and leaves it out of the count', async () => {
    const user = userEvent.setup()
    renderSection({ selectedPaths: [PATH_1, PATH_2, DRAWN] })
    await enterPrincipal(user, '20')

    expect(valueOf('Not available with leverage')).toHaveTextContent('My path')
    expect(screen.queryByRole('group', { name: /My path/ })).not.toBeInTheDocument()
    expect(openButton()).toHaveAccessibleName('Open 2 Positions at 2.0×')
    expect(valueOf('Total principal')).toHaveTextContent('40.00 USDC')
  })

  it('disables the steps a small principal cannot fill', async () => {
    const user = userEvent.setup()
    renderSection()

    await enterPrincipal(user, '20')
    expect(tick('2.4×')).toBeDisabled()
    expect(tick('2.5×')).toBeEnabled()

    await enterPrincipal(user, '50')
    expect(tick('2.4×')).toBeEnabled()
    expect(tick('2.5×')).toBeDisabled()
  })

  it('moves the thumb when its step fills up', async () => {
    const user = userEvent.setup()
    const { rerenderWith } = renderSection()
    await enterPrincipal(user, '20')
    await user.click(tick('3.0×'))
    expect(tick('3.0×')).toHaveAttribute('aria-pressed', 'true')

    rerenderWith({ view: viewWithFull(1) })

    expect(tick('3.0×')).toBeDisabled()
    expect(tick('2.0×')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('That leverage step is full')).toBeInTheDocument()
    expect(openButton()).toHaveAccessibleName('Open Position at 2.0×')
    expect(openButton()).toBeEnabled()
  })

  it('drops an offer’s steps before it expires', async () => {
    const user = userEvent.setup()
    const { rerenderWith } = renderSection()
    await enterPrincipal(user, '20')
    await user.click(tick('3.0×'))

    rerenderWith({ view: viewWithThreeXExpiring() })

    expect(screen.queryByRole('button', { name: 'Set to 2.5×' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Set to 3.0×' })).not.toBeInTheDocument()
    expect(tick('2.0×')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('That leverage step has closed')).toBeInTheDocument()
    expect(openButton()).toHaveAccessibleName('Open Position at 2.0×')
    expect(openButton()).toBeEnabled()
  })

  it('disables every step when every offer is full', () => {
    renderSection({ view: viewWithFull(0, 1) })

    for (const leverage of ['2.0×', '2.5×', '3.0×']) expect(tick(leverage)).toBeDisabled()
    expect(screen.getByText('That leverage step is full')).toBeInTheDocument()
    expect(openButton()).toBeDisabled()
  })

  it('names the USDC shortfall', async () => {
    wallet.usdc = 5
    const user = userEvent.setup()
    renderSection()
    await enterPrincipal(user, '20')

    expect(screen.getByText('You need 15.00 USDC more')).toBeInTheDocument()
    expect(openButton()).toBeDisabled()
    expect(tick('2.5×')).toBeEnabled()
  })

  it('sends the orders from the button', async () => {
    const user = userEvent.setup()
    const view = makeView()
    renderSection({ view, selectedPaths: [PATH_1, PATH_2, DRAWN] })
    await enterPrincipal(user, '20')
    await user.click(tick('2.5×'))
    await user.click(screen.getByRole('button', { name: 'Open 2 Positions at 2.5×' }))

    const split = [
      { offerSlot: 0, leverage: 2, units: 1 },
      { offerSlot: 1, leverage: 3, units: 1 },
    ]
    expect(mutateMock).toHaveBeenCalledWith({
      view,
      orders: [
        { slot: 0, parts: split },
        { slot: 2, parts: split },
      ],
      leverage: 2.5,
    })
  })

  it('waits for the forecasts before it maps the paths', () => {
    renderSection({ forecasts: null, selectedPaths: [PATH_1, DRAWN] })

    expect(tick('2.5×')).toBeEnabled()
    expect(screen.queryByRole('group', { name: /Path 1/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Not available with leverage')).not.toBeInTheDocument()
    expect(valueOf('Total principal')).toHaveTextContent('0.00 USDC')
    expect(openButton()).toBeDisabled()
  })

  it('leaves out the rent line for a returning trader', () => {
    renderSection({ view: makeView({ receipt: { address: 'receipt', data: makeReceipt([1]) } }) })

    expect(screen.queryByText(/A small SOL deposit/)).not.toBeInTheDocument()
  })
})
