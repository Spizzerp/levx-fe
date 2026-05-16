# LevX Supabase

Off-chain layer: wallet-based JWT auth, per-market comments (RLS-enforced, edits supported, rate-limited), and ephemeral realtime path-draw broadcasts.

Full design: `docs/superpowers/specs/2026-04-17-supabase-fe-integration-design.md`.

## Local development

Requires Docker Desktop running and Node ≥ 22 (use `nvm use 22`).

```bash
supabase start                                                          # Postgres + Realtime + Edge Runtime on localhost
supabase db reset                                                       # apply migrations from scratch
supabase functions serve verify-wallet \
  --no-verify-jwt \
  --env-file /absolute/path/to/supabase/functions/.env.local            # serve the edge function
```

Notes:
- `--env-file` requires an **absolute path** (the CLI resolves relative paths against the function dir).
- The Supabase CLI strips any `SUPABASE_*` prefixed key from `--env-file` (auto-injected vars cannot be overridden), so the local override variable is named **`EDGE_JWT_SECRET`**. Use the **same value** as the project JWT secret from `supabase status -o env` (local) or Dashboard → **Project Settings → API** (JWT signing keys / JWT Secret).

`supabase/functions/.env.local` (gitignored, dev only):
```
EDGE_JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long
APP_ORIGIN=*
```

The FE points at the local stack via `.env.local`:
```
APP_SUPABASE_URL=http://127.0.0.1:54321
APP_SUPABASE_ANON_KEY=<anon key from `supabase status -o env`>
```

## Tests

```bash
pnpm test:run       # FE unit + hook tests (mocked supabase-js)
pnpm test:rls       # RLS tests against local supabase start (12 tests)
pnpm test:edge      # Edge Function tests (Deno) — needs `supabase functions serve` running (8 tests)
pnpm test:all       # everything
```

Two Deno-version caveats:
- `pnpm test:edge` runs with `--no-lock` because the host Deno (≥ 2.7) writes lockfile v5 which the `edge_runtime` container's bundled Deno (2.1.4) cannot read.
- `tweetnacl` exposes `nacl.sign.*` only via the **default** import on Deno's resolver — `import * as nacl` will give you a namespace object missing the `sign` namespace.

## Deploying to a hosted Supabase project

```bash
supabase link --project-ref <your-ref>
supabase db push
supabase secrets set EDGE_JWT_SECRET='<paste JWT Secret from Dashboard → Project Settings → API>'
supabase functions deploy verify-wallet
supabase secrets set APP_ORIGIN=https://levx.app
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are provided by the hosted runtime. **JWT signing secret is not** — `verify-wallet` signs HS256 tokens that PostgREST must validate, so you must set **`EDGE_JWT_SECRET`** to the exact **JWT Secret** (or legacy JWT signing key) shown under **Project Settings → API**. Without it, `POST /verify-wallet/verify` returns 500 (or 503 with `jwt_secret_missing` after the latest handler).

## Manual smoke checklist (pre-release)

1. Connect wallet → sign-to-verify popup → comment posts → appears in a second browser tab in <2s.
2. Disconnect (extension) → reconnect → sign prompt re-appears.
3. Switch wallets in the extension → ghost path from old wallet stops; new wallet's appears.
4. Wait 24h on a stale tab → comment fails → "Re-authenticate" toast → succeeds.
5. Two browsers in the same market → drag a path → second browser sees a dashed ghost line.
6. Hammer comment button 5× → first succeeds, next four show cooldown toast.

## Schema overview

- `auth_nonces` — single-use nonces (5 min TTL). RLS denies all client access; only the Edge Function (service_role) reads/writes.
- `users` — wallet-bound public user records with username, display name, bio, X ID, and avatar metadata. Public read; RLS-gated writes keyed on `auth.jwt() ->> 'wallet'`.
- `comments` — per-market comments. Public read; RLS-gated insert/update/delete keyed on `auth.jwt() ->> 'wallet'`. Immutable columns enforced by trigger; `edited_at` server-stamped.
- `comment_rate_limit` — last-comment-at per wallet for the cooldown trigger (10s cooldown + 30/hr cap; service_role bypasses).
- `market_participants` — service-maintained per-market wallet aggregates for top-participant UI. Public read; service_role writes only.
- `realtime.messages` — Realtime Authorization policies for the private `path-draw:*` channels (subscribe + publish require `authenticated`).

## Files

```
supabase/
├── config.toml
├── migrations/0001_init.sql
├── migrations/0002_users.sql
├── functions/verify-wallet/
│   ├── index.ts                router + /nonce + /verify handlers
│   ├── index.test.ts           Deno tests (8 cases)
│   ├── deno.json               pinned imports
│   └── _shared/
│       ├── cors.ts
│       └── message.ts          canonical signing message (sole source of truth)
└── tests/
    ├── helpers.ts              service/anon/wallet client factories
    └── rls.test.ts             12 RLS + Realtime auth tests
```
