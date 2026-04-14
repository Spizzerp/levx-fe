import { describe, it } from 'vitest'

describe('MarketsPage', () => {
  it.todo('renders the table even when walletStore.connected=false (WALLET-03)')
  it.todo('does not redirect when wallet is disconnected (WALLET-03)')
  it.todo('renders a Paths column in the DataTable header (MARKET-01)')
  it.todo('Paths column value equals market.paths.length for each row (MARKET-01)')
  it.todo(
    'rows are ordered by STATE_ORDER: active, sampling, pending, settling, maturing, settled, void (MARKET-01)',
  )
  it.todo(
    'renders existing columns (idx, pair, state, ends, pool) plus the new paths column (MARKET-01)',
  )
  it.todo('renders a skeleton component when useMarkets is loading (MARKET-08)')
  it.todo('renders an error state with a retry button when useMarkets errors (MARKET-08)')
  it.todo('renders an empty-state message when useMarkets returns zero markets (MARKET-08)')
  it.todo('retry button re-invokes the query refetch (MARKET-08)')
})
