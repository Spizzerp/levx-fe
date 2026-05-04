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
APP_HERMES_URL=https://hermes.pyth.network
APP_RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_KEY
APP_NETWORK=devnet
APP_PROGRAM_ID=LEVXqi1Z2XujBw2jAEP15Dv8LyrDetDR95KZGGQNobV

# Supabase
APP_SUPABASE_URL=http://127.0.0.1:54321
APP_SUPABASE_ANON_KEY=

# Optional
APP_ENV=local
APP_API_BASE_URL=
APP_ADMIN_WALLETS=          # comma-separated base58 pubkeys
APP_USE_MOCK=               # "true" to use mock API responses
```

## Docs

- `docs/wireframe-document.md`
- `docs/platform-technical-architecture.md`
- `docs/mode2-liquidity-architecture.md`
