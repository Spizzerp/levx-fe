# levx-fe

Frontend for LEVX.

## Tech Stack

- React 19, TypeScript, Vite
- Tailwind CSS v4
- TanStack Router, TanStack Query
- Zustand
- Solana web3.js + wallet-adapter, Anchor
- Pyth (Hermes) price feeds
- Supabase
- Vitest

## Setup

Requires Node 22+ and pnpm 10+.

```bash
pnpm i
cp .env.example .env.local   # then fill in values
pnpm dev                     # dev server on :3030
```

## Scripts

```bash
pnpm dev        # dev server
pnpm build      # types + production build
pnpm preview    # preview build
pnpm lint
pnpm types      # tsc -b
pnpm test       # vitest
pnpm test:all   # unit + RLS + edge function tests
```

## Environment

`.env.local` example:

```bash
# Required
APP_RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_KEY
APP_NETWORK=devnet
APP_PROGRAM_ID=LEVXqi1Z2XujBw2jAEP15Dv8LyrDetDR95KZGGQNobV

# Supabase
APP_SUPABASE_URL=http://127.0.0.1:54321
APP_SUPABASE_ANON_KEY=

# Price source (see below)
APP_PRICE_SOURCE=free       # "free" (default) or "pyth"
APP_HERMES_URL=             # required only when APP_PRICE_SOURCE=pyth, e.g. https://hermes.pyth.network

# Optional
APP_ENV=local
APP_API_BASE_URL=           # required for chart history: the pipeline's public URL
APP_ADMIN_WALLETS=          # comma-separated base58 pubkeys
APP_USE_MOCK=               # "true" to use mock API responses
```

### Price sources

`APP_PRICE_SOURCE` picks the live price stream; nothing else differs between the two modes. `free`
(the default) streams Coinbase's public trades and keeps them on Pyth's level with Pyth's sponsored
on-chain price account, read over `APP_RPC_URL`, so it needs no key. `pyth` streams Pyth's own
price from Hermes at `APP_HERMES_URL`; the bundle cannot hold a secret, so if Pyth's paid access
needs a key, point `APP_HERMES_URL` at a relay that holds it. In both modes the chart history comes
from the pipeline's candles endpoint at `APP_API_BASE_URL`, the checkpoint dots are read from chain,
and markets settle on Pyth.

Going back to Pyth across the whole system:

| Service             | Back to Pyth                                                                   |
| ------------------- | ------------------------------------------------------------------------------ |
| pipeline            | set `PYTH_HERMES_API_KEY` (the history chain starts at Pyth)                   |
| Mode 1 keeper       | `PRICE_SOURCE=hermes` plus the key                                             |
| keeper-mode2 and lp | `PRICE_SOURCE=hermes` plus the key                                             |
| frontend            | `APP_PRICE_SOURCE=pyth` (plus `APP_HERMES_URL` at a relay, if needed), rebuild |

With a Pyth key on the pipeline a candle series can still mix sources; the free mode's history shift
treats only an all-Pyth series as already on Pyth's level and shifts a mixed one whole by the
current level.

## Docs

- `docs/wireframe-document.md`
- `docs/platform-technical-architecture.md`
- `docs/mode2-liquidity-architecture.md`
