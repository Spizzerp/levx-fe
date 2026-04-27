# levx-fe

A frontend base project for LEVX.

## Tech Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- TanStack Router
- TanStack Query
- Zustand

## Getting Started

### Requirements

- Node.js 22+
- pnpm 10+

### Install

```bash
pnpm i
```

### Run Dev Server

```bash
pnpm dev
```

Default port: `3030`

## Scripts

```bash
pnpm dev      # start dev server
pnpm build    # production build
pnpm preview  # preview production build
pnpm lint     # run ESLint
pnpm types    # run TypeScript type check
```

## Environment Variables

Example `.env.local`:

```bash
APP_ENV=local
APP_API_BASE_URL=http://localhost:3000
```

## Shared Docs

- Wireframe document: `docs/wireframe-document.md`
- Platform technical architecture: `docs/platform-technical-architecture.md`
- Mode 2 and liquidity architecture: `docs/mode2-liquidity-architecture.md`
