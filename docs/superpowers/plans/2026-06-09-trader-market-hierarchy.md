# Trader Market Hierarchy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make parent/child market hierarchy visible and navigable to traders without changing settlement, wagering, or admin behavior.

**Architecture:** Add a small trader-facing market group layer in the frontend. It derives group summaries from the existing enriched `Market` objects returned by `useMarkets()` / `useMarket()`, adds a dedicated group route, and adds lightweight context links from the markets list and market detail page. No new on-chain, infra, or indexer dependency is required.

**Tech Stack:** React 19, TypeScript, Vite, TanStack Router, TanStack Query, Vitest, Testing Library, Tailwind CSS v4, lucide-react, existing LEVX UI components.

---

## Product And Style Constraints

- Keep the existing LEVX theme. Use current tokens such as `bg-surface`, `bg-surface-1`, `border-line`, `text-ink-strong`, `text-ink-muted`, `text-success`, and `text-accent`.
- Match existing market surfaces: dense, chart-forward, utility-focused. Do not introduce marketing hero sections, new color systems, oversized rounded cards, or decorative gradients unrelated to market data.
- Use existing primitives where possible: `PageLayout`, `ChartFrame`, `DataTable`, `StatusDot`, `MarketCard`, `QueryErrorState`, `Button`, `TokenPairIcon`, `cn(...)`.
- Use lucide icons for controls and chips. Decorative icons must use `aria-hidden`.
- Use real `<button>` and TanStack `<Link>` / real links for navigation. No clickable `<div>`.
- Put shareable state in the URL. The group detail route is `/markets/group/$groupKeyHash`; `/markets?group=...` remains supported as a list filter.
- Flat markets must render exactly as they do today when no group sidecars exist.
- Do not add a new metadata source in this PR. Labels are derived from group kind, hash prefix, timeframe, pair, and child counts until richer indexed metadata exists.

## File Structure

- Modify `src/routes/router.tsx`
  - Register `/markets/group/$groupKeyHash` and export a route search type if needed.
- Create `src/features/marketGroups/groupPresentation.ts`
  - Pure formatting and aggregation helpers for trader-facing group summaries.
- Create `src/features/marketGroups/MarketGroupSummary.tsx`
  - Compact group overview surface used by the group detail route.
- Create `src/features/marketGroups/MarketGroupStrip.tsx`
  - Reusable group discovery strip for `/markets`.
- Create `src/routes/pages/MarketGroupPage.tsx`
  - Dedicated trader-facing page for a group and its child markets.
- Modify `src/routes/pages/MarketsPage.tsx`
  - Replace local group aggregation/labels with shared helpers and link groups to the new route.
- Modify `src/routes/pages/MarketPage.tsx`
  - Add a small group context chip near the market meta/header that links back to the group route.
- Add `src/features/marketGroups/__tests__/groupPresentation.test.ts`
  - Unit tests for label derivation, summaries, filtering, and flat fallback.
- Add `src/routes/pages/__tests__/MarketGroupPage.test.tsx`
  - Route/page tests for loading, error, empty, grouped children, and back navigation.
- Extend `src/routes/pages/__tests__/MarketsPage.test.tsx`
  - Verify group strip renders accessible links and the existing filter still works.
- Extend `src/routes/pages/__tests__/MarketPage.test.tsx`
  - Verify grouped market detail renders a group link and flat market detail does not.

---

### Task 1: Create The Isolated Frontend Worktree

**Files:**
- No source edits.

- [ ] **Step 1: Fetch current frontend main**

Run:

```bash
cd /Users/spizzerp/LevX-Parent/levx-fe
git fetch origin main
```

Expected: fetch succeeds and `origin/main` points at the current merged frontend main.

- [ ] **Step 2: Create a feature worktree**

Run:

```bash
cd /Users/spizzerp/LevX-Parent/levx-fe
git worktree add /Users/spizzerp/LevX-Parent/worktrees/levx-fe-trader-market-hierarchy -b feature/trader-market-hierarchy origin/main
```

Expected: new worktree exists at `/Users/spizzerp/LevX-Parent/worktrees/levx-fe-trader-market-hierarchy` on branch `feature/trader-market-hierarchy`.

- [ ] **Step 3: Verify baseline**

Run:

```bash
cd /Users/spizzerp/LevX-Parent/worktrees/levx-fe-trader-market-hierarchy
pnpm types
pnpm test:run src/lib/api/__tests__/marketGroups.test.ts src/routes/pages/__tests__/MarketsPage.test.tsx src/routes/pages/__tests__/MarketPage.test.tsx
```

Expected: typecheck passes and the focused tests pass before implementation.

---

### Task 2: Add Pure Group Presentation Helpers

**Files:**
- Create: `src/features/marketGroups/groupPresentation.ts`
- Create: `src/features/marketGroups/__tests__/groupPresentation.test.ts`

- [ ] **Step 1: Write failing helper tests**

Create `src/features/marketGroups/__tests__/groupPresentation.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import {
  buildMarketGroupSummaries,
  formatMarketGroupLabel,
  getMarketsForGroup,
} from '@/features/marketGroups/groupPresentation'
import type { Market } from '@/types/market'

function market(overrides: Partial<Market>): Market {
  return {
    id: overrides.id ?? '1',
    marketId: overrides.marketId ?? 1,
    pair: overrides.pair ?? 'BTC/USDC',
    base: overrides.base ?? 'BTC',
    quote: overrides.quote ?? 'USDC',
    vault: '',
    state: overrides.state ?? 'active',
    pool: overrides.pool ?? 100,
    traders: overrides.traders ?? 10,
    startTime: overrides.startTime ?? Date.UTC(2026, 0, 1),
    endTime: overrides.endTime ?? Date.UTC(2026, 0, 2),
    checkpointInterval: 3600,
    completedCheckpoints: 0,
    totalCheckpoints: 24,
    leverageEnabled: false,
    maxLeverage: 1,
    entryFeeBps: 150,
    history: [],
    paths: [],
    numPaths: 0,
    targetNumPaths: 3,
    amplitudes: [],
    lmsrShareQuantities: [],
    pricingActiveMask: 0,
    lmsrAlpha: 100_000,
    lambda: 0,
    decoherenceRate: 500_000,
    minimumProbability: 10_000,
    nudgeRate: 50_000,
    pathMaxAge: 3600,
    pathsScored: 0,
    pathsDissolved: 0,
    ...overrides,
  }
}

describe('market group presentation', () => {
  it('formats readable labels from group kind and hash prefix', () => {
    expect(formatMarketGroupLabel({ groupKind: 'assetSeason', groupKeyHash: 'ab'.repeat(32) })).toBe(
      'Asset season abababab',
    )
    expect(formatMarketGroupLabel({ groupKind: 'season', groupKeyHash: 'cd'.repeat(32) })).toBe(
      'Season cdcdcdcd',
    )
    expect(formatMarketGroupLabel({ groupKeyHash: undefined })).toBe('Ungrouped')
  })

  it('builds summaries with lifecycle counts and totals', () => {
    const groupKeyHash = 'ab'.repeat(32)
    const summaries = buildMarketGroupSummaries([
      market({ id: 'a', marketId: 1, state: 'active', groupKeyHash, groupKind: 'season' }),
      market({ id: 'b', marketId: 2, state: 'pending', groupKeyHash, groupKind: 'season' }),
      market({ id: 'c', marketId: 3, state: 'settled', groupKeyHash, groupKind: 'season' }),
      market({ id: 'flat', marketId: 4, state: 'active' }),
    ])

    expect(summaries).toHaveLength(1)
    expect(summaries[0]).toMatchObject({
      groupKeyHash,
      label: 'Season abababab',
      totalMarkets: 3,
      activeMarkets: 1,
      pendingMarkets: 1,
      settledMarkets: 1,
    })
  })

  it('returns only child markets for a selected group hash', () => {
    const target = 'ab'.repeat(32)
    const other = 'cd'.repeat(32)
    expect(
      getMarketsForGroup(
        [
          market({ id: 'target', groupKeyHash: target }),
          market({ id: 'other', groupKeyHash: other }),
          market({ id: 'flat' }),
        ],
        target,
      ).map((m) => m.id),
    ).toEqual(['target'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm test:run src/features/marketGroups/__tests__/groupPresentation.test.ts
```

Expected: FAIL because `groupPresentation.ts` does not exist.

- [ ] **Step 3: Implement helpers**

Create `src/features/marketGroups/groupPresentation.ts`:

```ts
import { getMarketDisplayState } from '@/lib/market/status'
import type { Market, MarketGroupKind, MarketState } from '@/types/market'

export type MarketGroupSummary = {
  groupKeyHash: string
  label: string
  kind?: MarketGroupKind
  status?: Market['group'] extends infer G ? G extends { status?: infer S } ? S : never : never
  parentGroup?: string
  totalMarkets: number
  activeMarkets: number
  pendingMarkets: number
  settledMarkets: number
  childMarketCount?: number
  timeframeSeconds?: number
  startTime?: number
  endTime?: number
  totalPool: number
  totalTraders: number
}

const MARKET_GROUP_KIND_LABELS: Partial<Record<MarketGroupKind, string>> = {
  root: 'Root',
  league: 'League',
  season: 'Season',
  game: 'Game',
  event: 'Event',
  assetSeason: 'Asset season',
  horizon: 'Horizon',
  custom: 'Custom',
}

function countState(state: MarketState): 'activeMarkets' | 'pendingMarkets' | 'settledMarkets' | null {
  if (state === 'pending') return 'pendingMarkets'
  if (state === 'settled') return 'settledMarkets'
  if (state === 'active' || state === 'sampling') return 'activeMarkets'
  return null
}

export function formatMarketGroupLabel(args: {
  groupKind?: MarketGroupKind
  groupKeyHash?: string
}): string {
  if (!args.groupKeyHash) return 'Ungrouped'
  const kind = args.groupKind ? MARKET_GROUP_KIND_LABELS[args.groupKind] : undefined
  return `${kind ?? 'Group'} ${args.groupKeyHash.slice(0, 8)}`
}

export function getMarketsForGroup(markets: readonly Market[] | undefined, groupKeyHash: string): Market[] {
  return (markets ?? []).filter((market) => market.groupKeyHash === groupKeyHash)
}

export function buildMarketGroupSummaries(markets: readonly Market[] | undefined): MarketGroupSummary[] {
  const summaries = new Map<string, MarketGroupSummary>()

  for (const market of markets ?? []) {
    if (!market.groupKeyHash) continue

    const existing = summaries.get(market.groupKeyHash)
    const summary =
      existing ??
      ({
        groupKeyHash: market.groupKeyHash,
        label: formatMarketGroupLabel({
          groupKind: market.groupKind,
          groupKeyHash: market.groupKeyHash,
        }),
        kind: market.groupKind,
        status: market.group?.status,
        parentGroup: market.parentGroup,
        totalMarkets: 0,
        activeMarkets: 0,
        pendingMarkets: 0,
        settledMarkets: 0,
        childMarketCount: market.group?.childMarketCount,
        timeframeSeconds: market.timeframeSeconds,
        startTime: market.group?.startTime,
        endTime: market.group?.endTime,
        totalPool: 0,
        totalTraders: 0,
      } satisfies MarketGroupSummary)

    const stateBucket = countState(getMarketDisplayState(market))
    summary.totalMarkets += 1
    summary.totalPool += market.pool
    summary.totalTraders += market.traders
    if (stateBucket) summary[stateBucket] += 1

    summaries.set(market.groupKeyHash, summary)
  }

  return Array.from(summaries.values()).sort((a, b) => a.label.localeCompare(b.label))
}
```

- [ ] **Step 4: Run helper tests**

Run:

```bash
pnpm test:run src/features/marketGroups/__tests__/groupPresentation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit helper layer**

Run:

```bash
git add src/features/marketGroups/groupPresentation.ts src/features/marketGroups/__tests__/groupPresentation.test.ts
git commit -m "feat(markets): add trader group presentation helpers"
```

---

### Task 3: Add The Market Group Discovery Strip

**Files:**
- Create: `src/features/marketGroups/MarketGroupStrip.tsx`
- Modify: `src/routes/pages/MarketsPage.tsx`
- Test: `src/routes/pages/__tests__/MarketsPage.test.tsx`

- [ ] **Step 1: Add failing MarketsPage tests**

Append tests to `src/routes/pages/__tests__/MarketsPage.test.tsx`:

```ts
it('renders grouped market discovery links when grouped markets exist', async () => {
  const groupKeyHash = 'ab'.repeat(32)
  await setUseMarkets({
    data: [
      makeMarket({
        id: 'grouped',
        pair: 'BTC/USDC',
        state: 'active',
        groupKeyHash,
        groupKind: 'season',
      }),
    ],
  })

  renderPage()

  const link = screen.getByRole('link', { name: /season abababab/i })
  expect(link).toHaveAttribute('href', `/markets/group/${groupKeyHash}`)
})

it('keeps flat market lists free of group discovery controls', async () => {
  await setUseMarkets({
    data: [makeMarket({ id: 'flat', pair: 'ETH/USDC', state: 'active' })],
  })

  renderPage()

  expect(screen.queryByRole('link', { name: /season/i })).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm test:run src/routes/pages/__tests__/MarketsPage.test.tsx
```

Expected: FAIL because the group discovery controls are still buttons and do not link to `/markets/group/$groupKeyHash`.

- [ ] **Step 3: Implement `MarketGroupStrip`**

Create `src/features/marketGroups/MarketGroupStrip.tsx`:

```tsx
import { Link } from '@tanstack/react-router'
import { Layers } from 'lucide-react'

import { cn } from '@/lib/cn'
import type { MarketGroupSummary } from '@/features/marketGroups/groupPresentation'

type MarketGroupStripProps = {
  groups: readonly MarketGroupSummary[]
  selectedGroup?: string
  onClear: () => void
}

export function MarketGroupStrip({ groups, selectedGroup, onClear }: MarketGroupStripProps) {
  if (groups.length === 0) return null

  return (
    <nav className="mb-5 flex flex-wrap items-center gap-2" aria-label="Market groups">
      <button
        type="button"
        onClick={onClear}
        className={cn(
          'inline-flex h-10 items-center gap-2 rounded-full border px-3',
          'text-label font-mono tracking-wider uppercase',
          'duration-short ease-levx transition-[border-color,color]',
          'focus-visible:ring-ink-strong focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
          !selectedGroup
            ? 'border-ink-strong text-ink-strong'
            : 'border-line-strong text-ink-muted hover:border-ink hover:text-ink',
        )}
      >
        <Layers size={14} strokeWidth={1.5} aria-hidden />
        All groups
      </button>

      {groups.map((group) => (
        <Link
          key={group.groupKeyHash}
          to="/markets/group/$groupKeyHash"
          params={{ groupKeyHash: group.groupKeyHash }}
          className={cn(
            'inline-flex h-10 items-center gap-2 rounded-full border px-3',
            'text-label font-mono tracking-wider uppercase',
            'duration-short ease-levx transition-[border-color,color]',
            'focus-visible:ring-ink-strong focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
            selectedGroup === group.groupKeyHash
              ? 'border-ink-strong text-ink-strong'
              : 'border-line-strong text-ink-muted hover:border-ink hover:text-ink',
          )}
        >
          {group.label}
          <span className="text-ink-dim">{group.totalMarkets}</span>
        </Link>
      ))}
    </nav>
  )
}
```

- [ ] **Step 4: Wire `MarketsPage` to shared helpers and strip**

In `src/routes/pages/MarketsPage.tsx`, replace the local `groupKindLabel`, `groupLabel`, and `groupedMarkets` logic with imports:

```tsx
import { MarketGroupStrip } from '@/features/marketGroups/MarketGroupStrip'
import { buildMarketGroupSummaries } from '@/features/marketGroups/groupPresentation'
```

Use:

```tsx
const groupedMarkets = useMemo(() => buildMarketGroupSummaries(markets), [markets])
```

Replace the existing group button block with:

```tsx
{hasAnyMarkets && (
  <MarketGroupStrip groups={groupedMarkets} selectedGroup={groupParam} onClear={() => setGroup(undefined)} />
)}
```

- [ ] **Step 5: Run MarketsPage tests**

Run:

```bash
pnpm test:run src/routes/pages/__tests__/MarketsPage.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit discovery strip**

Run:

```bash
git add src/features/marketGroups/MarketGroupStrip.tsx src/routes/pages/MarketsPage.tsx src/routes/pages/__tests__/MarketsPage.test.tsx
git commit -m "feat(markets): link grouped market discovery"
```

---

### Task 4: Add The Dedicated Group Route

**Files:**
- Create: `src/features/marketGroups/MarketGroupSummary.tsx`
- Create: `src/routes/pages/MarketGroupPage.tsx`
- Modify: `src/routes/router.tsx`
- Create: `src/routes/pages/__tests__/MarketGroupPage.test.tsx`

- [ ] **Step 1: Write failing route tests**

Create `src/routes/pages/__tests__/MarketGroupPage.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Market } from '@/types/market'

const GROUP = 'ab'.repeat(32)
const refetch = vi.fn()

vi.mock('@tanstack/react-router', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router')
  return {
    ...actual,
    Link: ({ children, to, params, ...props }: any) => (
      <a href={params?.groupKeyHash ? `/markets/group/${params.groupKeyHash}` : to} {...props}>
        {children}
      </a>
    ),
    useNavigate: () => vi.fn(),
    useParams: () => ({ groupKeyHash: GROUP }),
  }
})

vi.mock('@/lib/chain', () => ({
  useMarkets: vi.fn(),
}))

function makeMarket(overrides: Partial<Market>): Market {
  const now = Date.now()
  return {
    id: overrides.id ?? 'btc',
    marketId: overrides.marketId ?? 1,
    pair: overrides.pair ?? 'BTC/USDC',
    base: overrides.base ?? 'BTC',
    quote: overrides.quote ?? 'USDC',
    vault: '',
    state: overrides.state ?? 'active',
    pool: overrides.pool ?? 100_000,
    traders: overrides.traders ?? 20,
    startTime: now - 86_400_000,
    endTime: now + 86_400_000,
    checkpointInterval: 3600,
    completedCheckpoints: 0,
    totalCheckpoints: 48,
    leverageEnabled: false,
    maxLeverage: 1,
    entryFeeBps: 150,
    history: [],
    paths: [],
    numPaths: 0,
    targetNumPaths: 3,
    amplitudes: [],
    lmsrShareQuantities: [],
    pricingActiveMask: 0,
    lmsrAlpha: 100_000,
    lambda: 0,
    decoherenceRate: 500_000,
    minimumProbability: 10_000,
    nudgeRate: 50_000,
    pathMaxAge: 3600,
    pathsScored: 0,
    pathsDissolved: 0,
    groupKeyHash: GROUP,
    groupKind: 'season',
    timeframeSeconds: 86_400,
    ...overrides,
  }
}

async function setUseMarkets(value: Partial<ReturnType<any>>) {
  const { useMarkets } = await import('@/lib/chain')
  ;(useMarkets as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    data: value.data,
    isLoading: false,
    isError: false,
    refetch,
    ...value,
  })
}

function renderPage() {
  const queryClient = new QueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  const { MarketGroupPage } = require('@/routes/pages/MarketGroupPage')
  return render(<MarketGroupPage />, { wrapper })
}

describe('MarketGroupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders group summary and child markets', async () => {
    await setUseMarkets({
      data: [
        makeMarket({ id: 'btc', pair: 'BTC/USDC', state: 'active' }),
        makeMarket({ id: 'eth', pair: 'ETH/USDC', state: 'pending' }),
        makeMarket({ id: 'flat', pair: 'SOL/USDC', state: 'active', groupKeyHash: undefined }),
      ],
    })

    renderPage()

    expect(screen.getByRole('heading', { name: /season abababab/i })).toBeInTheDocument()
    expect(screen.getByText(/2 child markets/i)).toBeInTheDocument()
    expect(screen.getByText(/BTC/)).toBeInTheDocument()
    expect(screen.getByText(/ETH/)).toBeInTheDocument()
    expect(screen.queryByText(/SOL/)).not.toBeInTheDocument()
  })

  it('renders an empty state when the group hash has no children', async () => {
    await setUseMarkets({ data: [makeMarket({ id: 'flat', groupKeyHash: undefined })] })

    renderPage()

    expect(screen.getByText(/no child markets found/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to markets/i })).toHaveAttribute('href', '/markets')
  })

  it('renders an error state with retry', async () => {
    await setUseMarkets({ data: undefined, isError: true })

    renderPage()

    const alert = screen.getByRole('alert')
    expect(within(alert).getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run route tests to verify they fail**

Run:

```bash
pnpm test:run src/routes/pages/__tests__/MarketGroupPage.test.tsx
```

Expected: FAIL because `MarketGroupPage` does not exist.

- [ ] **Step 3: Implement `MarketGroupSummary`**

Create `src/features/marketGroups/MarketGroupSummary.tsx`:

```tsx
import { Activity, Clock3, Layers, Users } from 'lucide-react'

import { ChartFrame } from '@/features/chart/ChartFrame'
import { formatCountdown, formatUSD } from '@/lib/format'
import type { MarketGroupSummary as MarketGroupSummaryModel } from '@/features/marketGroups/groupPresentation'

type MarketGroupSummaryProps = {
  summary: MarketGroupSummaryModel
  now: number
}

function metric(label: string, value: string | number, icon: React.ReactNode) {
  return (
    <div className="border-line bg-surface/40 flex min-h-20 items-center gap-3 border p-4">
      <span className="text-ink-dim" aria-hidden>
        {icon}
      </span>
      <div>
        <div className="text-label text-ink-dim font-mono uppercase">{label}</div>
        <div className="text-ink-strong font-mono text-xl font-bold">{value}</div>
      </div>
    </div>
  )
}

export function MarketGroupSummary({ summary, now }: MarketGroupSummaryProps) {
  const endsIn =
    summary.endTime && summary.endTime > now ? formatCountdown(summary.endTime - now) : 'Open-ended'

  return (
    <ChartFrame glow className="p-5">
      <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-label text-ink-dim font-mono uppercase">Market group</p>
          <h1 className="text-ink-strong font-display text-3xl font-bold">{summary.label}</h1>
        </div>
        <div className="text-ink-muted font-mono text-xs uppercase">
          {summary.groupKeyHash.slice(0, 8)}...{summary.groupKeyHash.slice(-6)}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metric('Child markets', summary.totalMarkets, <Layers size={18} strokeWidth={1.5} />)}
        {metric('Active', summary.activeMarkets, <Activity size={18} strokeWidth={1.5} />)}
        {metric('Traders', summary.totalTraders.toLocaleString(), <Users size={18} strokeWidth={1.5} />)}
        {metric('Window', endsIn, <Clock3 size={18} strokeWidth={1.5} />)}
      </div>

      <div className="border-line mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-4">
        <span className="text-label text-ink-dim font-mono uppercase">
          Pool <span className="text-ink-muted">{formatUSD(summary.totalPool)}</span>
        </span>
        <span className="text-label text-ink-dim font-mono uppercase">
          Pending <span className="text-ink-muted">{summary.pendingMarkets}</span>
        </span>
        <span className="text-label text-ink-dim font-mono uppercase">
          Settled <span className="text-ink-muted">{summary.settledMarkets}</span>
        </span>
      </div>
    </ChartFrame>
  )
}
```

- [ ] **Step 4: Implement `MarketGroupPage` and route**

Create `src/routes/pages/MarketGroupPage.tsx` and register it in `src/routes/router.tsx`.

`src/routes/pages/MarketGroupPage.tsx`:

```tsx
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useMemo } from 'react'

import { MarketGroupSummary } from '@/features/marketGroups/MarketGroupSummary'
import {
  buildMarketGroupSummaries,
  getMarketsForGroup,
} from '@/features/marketGroups/groupPresentation'
import { MarketCard } from '@/features/market/MarketCard'
import { PageLayout } from '@/layouts/PageLayout'
import { QueryErrorState } from '@/ui/QueryErrorState'
import { Button } from '@/ui/Button'
import { useMarkets } from '@/lib/chain'

export function MarketGroupPage() {
  const { groupKeyHash } = useParams({ from: '/markets/group/$groupKeyHash' })
  const navigate = useNavigate()
  const { data: markets, isLoading, isError, refetch } = useMarkets()
  const now = Date.now()

  const childMarkets = useMemo(() => getMarketsForGroup(markets, groupKeyHash), [markets, groupKeyHash])
  const summary = useMemo(
    () => buildMarketGroupSummaries(childMarkets).find((item) => item.groupKeyHash === groupKeyHash),
    [childMarkets, groupKeyHash],
  )

  return (
    <PageLayout title="Market Group" subtitle="Child markets settle independently.">
      <div className="mb-5">
        <Link
          to="/markets"
          className="text-ink-muted hover:text-ink inline-flex h-10 items-center gap-2 font-mono text-xs uppercase focus-visible:ring-2 focus-visible:ring-ink-strong focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          <ArrowLeft size={14} strokeWidth={1.5} aria-hidden />
          Back to markets
        </Link>
      </div>

      {isLoading && <div role="status" aria-label="Loading market group" className="border-line h-40 animate-pulse border bg-surface/40" />}

      {isError && (
        <QueryErrorState
          title="We couldn't load this market group"
          message="The market feed did not return group metadata. Try again."
          onRetry={() => void refetch()}
        />
      )}

      {!isLoading && !isError && !summary && (
        <div className="border-line-strong flex flex-col items-center justify-center gap-4 border border-dashed py-24 text-center">
          <p className="text-ink-muted text-label font-mono uppercase">[ No child markets found ]</p>
          <Button variant="secondary" onClick={() => void navigate({ to: '/markets' })}>
            Back to markets
          </Button>
        </div>
      )}

      {!isLoading && !isError && summary && (
        <div className="space-y-5">
          <MarketGroupSummary summary={summary} now={now} />
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {childMarkets.map((market) => (
              <MarketCard
                key={market.id}
                market={market}
                now={now}
                onClick={() => void navigate({ to: '/market/$id', params: { id: market.id } })}
              />
            ))}
          </div>
        </div>
      )}
    </PageLayout>
  )
}
```

In `src/routes/router.tsx`, import and register:

```tsx
import { MarketGroupPage } from '@/routes/pages/MarketGroupPage'

const marketGroupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/markets/group/$groupKeyHash',
  component: MarketGroupPage,
})
```

Add `marketGroupRoute` to `routeTree`.

- [ ] **Step 5: Run route tests**

Run:

```bash
pnpm test:run src/routes/pages/__tests__/MarketGroupPage.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit group route**

Run:

```bash
git add src/features/marketGroups/MarketGroupSummary.tsx src/routes/pages/MarketGroupPage.tsx src/routes/router.tsx src/routes/pages/__tests__/MarketGroupPage.test.tsx
git commit -m "feat(markets): add market group detail page"
```

---

### Task 5: Add Market Detail Group Context

**Files:**
- Modify: `src/routes/pages/MarketPage.tsx`
- Test: `src/routes/pages/__tests__/MarketPage.test.tsx`

- [ ] **Step 1: Add failing MarketPage tests**

Extend `src/routes/pages/__tests__/MarketPage.test.tsx` with:

```tsx
it('links grouped markets back to their market group', async () => {
  await setMarketState('active', {
    groupKeyHash: 'ab'.repeat(32),
    groupKind: 'season',
  })

  renderMarketPage()

  expect(screen.getByRole('link', { name: /season abababab/i })).toHaveAttribute(
    'href',
    `/markets/group/${'ab'.repeat(32)}`,
  )
})

it('does not render a group context link for flat markets', async () => {
  await setMarketState('active', {
    groupKeyHash: undefined,
    groupKind: undefined,
  })

  renderMarketPage()

  expect(screen.queryByRole('link', { name: /season/i })).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm test:run src/routes/pages/__tests__/MarketPage.test.tsx
```

Expected: FAIL because the detail page has no group link.

- [ ] **Step 3: Add group context chip**

In `src/routes/pages/MarketPage.tsx`, import:

```tsx
import { Layers } from 'lucide-react'
import { formatMarketGroupLabel } from '@/features/marketGroups/groupPresentation'
```

Near the market header/meta block, render this only when `market.groupKeyHash` exists:

```tsx
{market.groupKeyHash && (
  <Link
    to="/markets/group/$groupKeyHash"
    params={{ groupKeyHash: market.groupKeyHash }}
    className={cn(
      'inline-flex h-10 items-center gap-2 rounded-full border px-3',
      'border-line-strong text-ink-muted hover:border-ink hover:text-ink',
      'text-label font-mono tracking-wider uppercase',
      'duration-short ease-levx transition-[border-color,color]',
      'focus-visible:ring-ink-strong focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
    )}
  >
    <Layers size={14} strokeWidth={1.5} aria-hidden />
    {formatMarketGroupLabel({
      groupKind: market.groupKind,
      groupKeyHash: market.groupKeyHash,
    })}
  </Link>
)}
```

Place it where it does not disrupt the chart or wager panel: near existing meta text in the page header, before the main chart/action grid.

- [ ] **Step 4: Run MarketPage tests**

Run:

```bash
pnpm test:run src/routes/pages/__tests__/MarketPage.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit detail context**

Run:

```bash
git add src/routes/pages/MarketPage.tsx src/routes/pages/__tests__/MarketPage.test.tsx
git commit -m "feat(markets): show group context on market detail"
```

---

### Task 6: Final Validation And UI Review

**Files:**
- Modify only if validation exposes issues.

- [ ] **Step 1: Run focused tests**

Run:

```bash
pnpm test:run src/features/marketGroups/__tests__/groupPresentation.test.ts src/routes/pages/__tests__/MarketsPage.test.tsx src/routes/pages/__tests__/MarketGroupPage.test.tsx src/routes/pages/__tests__/MarketPage.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run full typecheck and test suite**

Run:

```bash
pnpm types
pnpm test:run
```

Expected: `pnpm types` passes and Vitest reports all tests passing.

- [ ] **Step 3: Build production bundle**

Run:

```bash
pnpm build
```

Expected: Vite build completes successfully.

- [ ] **Step 4: Run diff checks**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors. Status only shows intended files.

- [ ] **Step 5: Browser smoke**

Run:

```bash
pnpm dev --host 127.0.0.1
```

Open:

- `http://127.0.0.1:3030/markets`
- `http://127.0.0.1:3030/markets/group/abababababababababababababababababababababababababababababababab`
- A grouped market detail route from mock data or devnet data.

Check:

- The group strip matches existing LEVX density, typography, borders, and colors.
- Links and buttons have visible keyboard focus.
- Group page renders at 375 px, 768 px, and 1280 px with no text overlap.
- Loading, error, and empty states are present.
- Flat markets still render without group controls.

- [ ] **Step 6: Final commit if validation fixes were needed**

Run only if Step 1-5 produced follow-up edits:

```bash
git add <changed-files>
git commit -m "fix(markets): polish trader group navigation"
```

---

## PR Summary Template

```markdown
## Summary

- Adds trader-facing market group navigation for parent/child market hierarchy.
- Adds `/markets/group/$groupKeyHash` with group summary and child market cards.
- Adds group links from `/markets` and market detail while preserving flat-market fallback.

## Validation

- pnpm test:run src/features/marketGroups/__tests__/groupPresentation.test.ts src/routes/pages/__tests__/MarketsPage.test.tsx src/routes/pages/__tests__/MarketGroupPage.test.tsx src/routes/pages/__tests__/MarketPage.test.tsx
- pnpm types
- pnpm test:run
- pnpm build
- git diff --check
```

## Self-Review

- Spec coverage: The plan covers trader-facing discovery, a dedicated group page, market detail context, flat fallback, tests, and visual review.
- Placeholder scan: No placeholder tasks are required before implementation. Rich display names remain explicitly out of scope for this PR because there is no indexed metadata source yet.
- Type consistency: Route param is consistently `groupKeyHash`; helper summary field is consistently `MarketGroupSummary`; grouped markets continue using `Market.groupKeyHash` and `Market.groupKind`.
