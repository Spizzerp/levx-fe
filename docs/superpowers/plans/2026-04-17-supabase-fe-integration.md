# Supabase FE Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Supabase off-chain layer to levx-fe providing wallet-based JWT auth, per-market comments (with RLS, edits, rate limiting), and ephemeral realtime path-draw broadcasts — without touching any on-chain code path.

**Architecture:** Supabase project (`supabase/` at repo root, CLI-managed) holds a `comments` table with row-level security keyed on `auth.jwt() ->> 'wallet'`, an `auth_nonces` table, and a `verify-wallet` Edge Function that signs custom JWTs after verifying ed25519 wallet signatures. FE consumes it through a single module `src/lib/supabase/` exposing a React provider + TanStack-Query-compatible hooks. The supabase-js client uses the modern `accessToken` async callback (not the deprecated `setSession` pattern) so JWT rotation is transparent. Failure of Supabase fails open — markets, wagers, and chain reads keep working.

**Tech Stack:** @supabase/supabase-js v2.45+, Supabase CLI, Deno (Edge Functions: tweetnacl, bs58, djwt), TanStack Query v5 (already present), Vitest + React Testing Library (already present), Zustand `useWalletStore` (already present at `src/stores/walletStore.ts`).

**Reference spec:** `docs/superpowers/specs/2026-04-17-supabase-fe-integration-design.md`

---

## Prerequisites

Before starting, verify:
- Supabase CLI installed (`supabase --version` ≥ 1.200) and logged in (`supabase login`).
- Deno installed (`deno --version` ≥ 1.40) for Edge Function tests.
- Docker running (Supabase CLI uses it for `supabase start`).
- An empty Supabase project created via the dashboard; note the `project-ref`. (You can do this later before the deploy step — local dev works without it.)

---

## File Structure

### New files
```
supabase/
├── config.toml                                 Task 1
├── migrations/
│   └── 0001_init.sql                           Task 2
├── functions/
│   └── verify-wallet/
│       ├── index.ts                            Tasks 7–8
│       ├── deno.json                           Task 6
│       ├── index.test.ts                       Tasks 7–8
│       └── _shared/
│           └── cors.ts                         Task 6
├── tests/
│   ├── helpers.ts                              Task 3
│   └── rls.test.ts                             Tasks 4–5
└── README.md                                   Task 21

src/lib/supabase/
├── client.ts                                   Task 10
├── auth.ts                                     Tasks 11–12
├── channels.ts                                 Task 13
├── provider.tsx                                Task 14
├── hooks.ts                                    Tasks 14–16
├── types.ts                                    Task 10
├── __mocks__/
│   └── supabase-js.ts                          Task 14
└── __tests__/
    ├── auth.test.ts                            Tasks 11–12
    ├── channels.test.ts                        Task 13
    ├── useSupabaseAuth.test.tsx                Task 14
    ├── useComments.test.tsx                    Task 15
    ├── usePostComment.test.tsx                 Task 15
    └── useDrawBroadcast.test.tsx               Task 16

src/components/
└── MarketComments.tsx                          Task 18
```

### Modified files
```
.env.example                                    Task 1
src/env/env.config.ts                           Task 9
package.json                                    Tasks 9, 21
src/ui/UIRoot.tsx                               Task 17
src/routes/pages/MarketPage.tsx                 Task 18, 19
src/routes/pages/PositionsPage.tsx              Task 20
src/routes/pages/PortfolioPage.tsx              Task 20
src/components/LevXChart.tsx (or DrawingLayer)  Task 19
```

---

## Task 1: Initialize Supabase project structure

**Files:**
- Create: `supabase/config.toml`
- Modify: `.env.example`

- [ ] **Step 1: Run `supabase init` to scaffold the CLI layout**

From repo root:
```bash
cd /Users/spizzerp/levx-fe
supabase init
```

This creates `supabase/config.toml`, `supabase/seed.sql`, `.gitignore` additions. Accept defaults when prompted.

- [ ] **Step 2: Edit `supabase/config.toml` — set project_id and desired local ports**

Open `supabase/config.toml` and ensure the following (add or correct):
```toml
project_id = "levx"

[api]
port = 54321

[db]
port = 54322
major_version = 15

[studio]
port = 54323

[realtime]
enabled = true

[auth]
enabled = true

[edge_runtime]
enabled = true
```

Leave everything else at CLI defaults.

- [ ] **Step 3: Update `.env.example` — replace the "Phase 3" comment with live entries**

Open `.env.example`, replace the last 3 lines (the commented Supabase block) with:
```bash
# Supabase
APP_SUPABASE_URL=http://127.0.0.1:54321
APP_SUPABASE_ANON_KEY=
```

(Leave the value empty in `.env.example`; developers populate `.env.local` with the anon key printed by `supabase start`.)

- [ ] **Step 4: Verify `supabase start` succeeds**

Run:
```bash
supabase start
```

Expected: output ends with "Started supabase local development setup." and prints API URL, Studio URL, anon key, service_role key, JWT secret. Leave the stack running for later tasks.

- [ ] **Step 5: Commit**

```bash
git add supabase/config.toml .env.example
git commit -m "chore(supabase): scaffold CLI project and env template"
```

---

## Task 2: Write 0001_init.sql migration

**Files:**
- Create: `supabase/migrations/0001_init.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/0001_init.sql` with the full content:

```sql
-- 0001_init.sql: comments + auth_nonces + rate limiting + Realtime Authorization
create extension if not exists "pgcrypto";

-- ── auth_nonces ─────────────────────────────────────────────
create table public.auth_nonces (
  nonce       text        primary key,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
create index auth_nonces_expires_at_idx on public.auth_nonces (expires_at);

alter table public.auth_nonces enable row level security;
-- No policies → all client access denied. Only service_role (Edge Function) reaches it.

-- ── comments ────────────────────────────────────────────────
create table public.comments (
  id          uuid        primary key default gen_random_uuid(),
  market_id   text        not null,
  wallet      text        not null,
  body        text        not null check (length(body) between 1 and 2000),
  created_at  timestamptz not null default now(),
  edited_at   timestamptz
);
create index comments_market_id_created_at_idx
  on public.comments (market_id, created_at desc);
create index comments_wallet_idx
  on public.comments (wallet);

alter table public.comments enable row level security;

create policy "comments select public"
  on public.comments for select
  to anon, authenticated
  using (true);

create policy "comments insert own wallet"
  on public.comments for insert
  to authenticated
  with check ( (auth.jwt() ->> 'wallet') = wallet );

create policy "comments update own"
  on public.comments for update
  to authenticated
  using      ( (auth.jwt() ->> 'wallet') = wallet )
  with check ( (auth.jwt() ->> 'wallet') = wallet );

create policy "comments delete own"
  on public.comments for delete
  to authenticated
  using ( (auth.jwt() ->> 'wallet') = wallet );

-- ── comment_rate_limit ──────────────────────────────────────
create table public.comment_rate_limit (
  wallet           text        primary key,
  last_comment_at  timestamptz not null
);

-- ── rate limit trigger ──────────────────────────────────────
create or replace function public.enforce_comment_rate_limit()
returns trigger language plpgsql security definer as $$
declare
  per_message_cooldown interval := interval '10 seconds';
  hourly_cap           int      := 30;
  last_at              timestamptz;
  hourly_count         int;
begin
  if (auth.jwt() ->> 'wallet') is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;

  select last_comment_at into last_at
  from public.comment_rate_limit
  where wallet = new.wallet;

  if last_at is not null and (now() - last_at) < per_message_cooldown then
    raise exception 'rate_limit_cooldown'
      using errcode = 'P0001',
            hint = 'Wait a few seconds before posting again.';
  end if;

  select count(*) into hourly_count
  from public.comments
  where wallet = new.wallet
    and created_at > now() - interval '1 hour';

  if hourly_count >= hourly_cap then
    raise exception 'rate_limit_hourly'
      using errcode = 'P0001',
            hint = 'Hourly comment limit reached.';
  end if;

  insert into public.comment_rate_limit (wallet, last_comment_at)
  values (new.wallet, now())
  on conflict (wallet) do update set last_comment_at = excluded.last_comment_at;

  return new;
end;
$$;

create trigger comments_rate_limit
  before insert on public.comments
  for each row execute function public.enforce_comment_rate_limit();

-- ── immutable-column trigger (edits only mutate body; edited_at server-stamped) ──
create or replace function public.lock_comment_immutables()
returns trigger language plpgsql as $$
begin
  if new.id         is distinct from old.id
  or new.market_id  is distinct from old.market_id
  or new.wallet     is distinct from old.wallet
  or new.created_at is distinct from old.created_at then
    raise exception 'immutable_column_modified' using errcode = '42501';
  end if;
  new.edited_at := now();
  return new;
end;
$$;

create trigger comments_lock_immutables
  before update on public.comments
  for each row execute function public.lock_comment_immutables();

-- ── Realtime Authorization for path-draw broadcast ──────────
create policy "path-draw subscribe authenticated"
  on realtime.messages for select
  to authenticated
  using ( (select realtime.topic()) like 'path-draw:%' );

create policy "path-draw publish authenticated"
  on realtime.messages for insert
  to authenticated
  with check ( (select realtime.topic()) like 'path-draw:%' );
```

- [ ] **Step 2: Apply the migration locally**

```bash
supabase db reset
```

Expected: output ends with "Finished supabase db reset on branch ...". No errors.

- [ ] **Step 3: Manually sanity-check the schema exists**

```bash
supabase db diff --use-migra --schema public
```

Expected: empty diff (nothing to migrate — your migration is the current state).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "feat(supabase): add comments, auth_nonces schema with RLS and rate limit"
```

---

## Task 3: RLS test scaffolding

**Files:**
- Create: `supabase/tests/helpers.ts`

- [ ] **Step 1: Install the dev dependency used to sign test JWTs**

```bash
pnpm add -D jose
```

- [ ] **Step 2: Create `supabase/tests/helpers.ts` with the test helpers**

Create `supabase/tests/helpers.ts`:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SignJWT } from 'jose'

// Local-only values printed by `supabase start`. These are the default CLI keys,
// safe to commit because they only unlock the local development stack.
const LOCAL_URL             = 'http://127.0.0.1:54321'
const LOCAL_ANON_KEY        = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const LOCAL_SERVICE_ROLE    = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const LOCAL_JWT_SECRET      = 'super-secret-jwt-token-with-at-least-32-characters-long'

// If the local `supabase start` prints different keys for your machine, replace
// the constants above. The defaults have been stable across CLI versions.

export function anonClient(): SupabaseClient {
  return createClient(LOCAL_URL, LOCAL_ANON_KEY)
}

export function serviceClient(): SupabaseClient {
  return createClient(LOCAL_URL, LOCAL_SERVICE_ROLE, { auth: { persistSession: false } })
}

/** Build a Supabase client authenticated as the given wallet via a test-signed JWT. */
export async function walletClient(wallet: string): Promise<SupabaseClient> {
  const secret = new TextEncoder().encode(LOCAL_JWT_SECRET)
  const jwt = await new SignJWT({
    wallet,
    role: 'authenticated',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(wallet)
    .setIssuer('supabase')
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret)

  return createClient(LOCAL_URL, LOCAL_ANON_KEY, {
    accessToken: async () => jwt,
  })
}

/** Wipe comments + rate-limit state between tests. */
export async function resetTables() {
  const svc = serviceClient()
  await svc.from('comments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await svc.from('comment_rate_limit').delete().neq('wallet', '__never__')
  await svc.from('auth_nonces').delete().neq('nonce', '__never__')
}

export const WALLET_A = 'AliceWalletPubkey1111111111111111111111111111'
export const WALLET_B = 'BobWalletPubkey22222222222222222222222222222'
```

- [ ] **Step 3: Verify Vitest can load this file (no test run yet)**

```bash
pnpm tsc --noEmit --project tsconfig.json
```

Expected: no errors mentioning `supabase/tests/helpers.ts`. If the compiler complains about the file being outside `rootDir`, add `supabase/tests/**/*.ts` to the `include` array in `tsconfig.app.json`.

- [ ] **Step 4: Commit**

```bash
git add supabase/tests/helpers.ts package.json pnpm-lock.yaml tsconfig.app.json
git commit -m "test(rls): add test helpers for authenticated Supabase clients"
```

---

## Task 4: RLS tests — comments policies

**Files:**
- Create: `supabase/tests/rls.test.ts` (partial — Tasks 4 + 5 fill it in)

- [ ] **Step 1: Create `supabase/tests/rls.test.ts` with the comments-policy tests**

Create `supabase/tests/rls.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { anonClient, serviceClient, walletClient, resetTables, WALLET_A, WALLET_B } from './helpers'

describe('RLS — comments', () => {
  beforeEach(async () => {
    await resetTables()
  })

  it('anon cannot insert', async () => {
    const { error } = await anonClient()
      .from('comments').insert({ market_id: 'btc', wallet: WALLET_A, body: 'hi' })
    expect(error).not.toBeNull()
  })

  it('auth: cannot insert with wallet claim != row wallet', async () => {
    const client = await walletClient(WALLET_A)
    const { error } = await client
      .from('comments').insert({ market_id: 'btc', wallet: WALLET_B, body: 'hi' })
    expect(error).not.toBeNull()
  })

  it('auth: insert with matching wallet succeeds', async () => {
    const client = await walletClient(WALLET_A)
    const { data, error } = await client
      .from('comments').insert({ market_id: 'btc', wallet: WALLET_A, body: 'hi' }).select().single()
    expect(error).toBeNull()
    expect(data?.wallet).toBe(WALLET_A)
  })

  it('anon can read all comments', async () => {
    const svc = serviceClient()
    await svc.from('comments').insert({ market_id: 'btc', wallet: WALLET_A, body: 'public' })
    const { data, error } = await anonClient().from('comments').select()
    expect(error).toBeNull()
    expect(data?.length).toBeGreaterThan(0)
  })

  it('auth: update changing wallet raises immutable_column_modified', async () => {
    const svc = serviceClient()
    const { data: row } = await svc.from('comments')
      .insert({ market_id: 'btc', wallet: WALLET_A, body: 'orig' }).select().single()
    const client = await walletClient(WALLET_A)
    const { error } = await client
      .from('comments').update({ wallet: WALLET_B }).eq('id', row!.id)
    expect(error?.message).toMatch(/immutable_column_modified/)
  })

  it('auth: update changing body succeeds and stamps edited_at', async () => {
    const svc = serviceClient()
    const { data: row } = await svc.from('comments')
      .insert({ market_id: 'btc', wallet: WALLET_A, body: 'orig' }).select().single()
    const client = await walletClient(WALLET_A)
    const { data: updated, error } = await client
      .from('comments').update({ body: 'edited' }).eq('id', row!.id).select().single()
    expect(error).toBeNull()
    expect(updated?.body).toBe('edited')
    expect(updated?.edited_at).not.toBeNull()
    expect(updated?.created_at).toBe(row!.created_at)
  })

  it('auth: delete others comment affects 0 rows', async () => {
    const svc = serviceClient()
    const { data: row } = await svc.from('comments')
      .insert({ market_id: 'btc', wallet: WALLET_B, body: 'bob' }).select().single()
    const client = await walletClient(WALLET_A)
    const { error, count } = await client
      .from('comments').delete({ count: 'exact' }).eq('id', row!.id)
    expect(error).toBeNull()
    expect(count).toBe(0)
  })

  it('auth: delete own comment affects 1 row', async () => {
    const client = await walletClient(WALLET_A)
    const { data: row } = await client
      .from('comments').insert({ market_id: 'btc', wallet: WALLET_A, body: 'mine' }).select().single()
    const { count } = await client
      .from('comments').delete({ count: 'exact' }).eq('id', row!.id)
    expect(count).toBe(1)
  })
})
```

- [ ] **Step 2: Add a `test:rls` script to package.json**

Edit `package.json`, add to `scripts`:
```json
"test:rls": "vitest run --config vitest.rls.config.ts"
```

- [ ] **Step 3: Create `vitest.rls.config.ts`**

Create `vitest.rls.config.ts` at repo root:
```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['supabase/tests/**/*.test.ts'],
    testTimeout: 15000,
    hookTimeout: 15000,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
})
```

- [ ] **Step 4: Ensure `supabase start` is running, then run the tests**

```bash
supabase status   # should show "Started"
pnpm test:rls
```

Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/tests/rls.test.ts vitest.rls.config.ts package.json
git commit -m "test(rls): comments policies (insert/select/update/delete/immutable-cols)"
```

---

## Task 5: RLS tests — rate limit + Realtime policies

**Files:**
- Modify: `supabase/tests/rls.test.ts` (append new describe blocks)

- [ ] **Step 1: Append rate-limit tests to `supabase/tests/rls.test.ts`**

Add to the end of the file:

```ts
describe('RLS — comment rate limiting', () => {
  beforeEach(async () => { await resetTables() })

  it('insert violating 10s cooldown raises P0001 rate_limit_cooldown', async () => {
    const client = await walletClient(WALLET_A)
    await client.from('comments').insert({ market_id: 'btc', wallet: WALLET_A, body: 'first' })
    const { error } = await client
      .from('comments').insert({ market_id: 'btc', wallet: WALLET_A, body: 'second' })
    expect(error?.message).toMatch(/rate_limit_cooldown/)
  })

  it('insert at hourly cap raises P0001 rate_limit_hourly', async () => {
    const svc = serviceClient()
    // Seed 30 comments within the last hour, bypassing the trigger via service role.
    // The trigger still fires on service role inserts (it's on the table), so we
    // manually insert and simultaneously seed comment_rate_limit with an old value
    // to bypass the per-message cooldown for setup only.
    const now = Date.now()
    for (let i = 0; i < 30; i++) {
      await svc.from('comments').insert({
        market_id: 'btc', wallet: WALLET_A, body: `seed-${i}`,
        created_at: new Date(now - (30 - i) * 60_000).toISOString(),
      })
      // Reset the cooldown row each iteration so the trigger lets the next insert through.
      await svc.from('comment_rate_limit').upsert({
        wallet: WALLET_A,
        last_comment_at: new Date(now - 60_000).toISOString(),
      })
    }
    // Now as the wallet itself, attempt one more.
    const client = await walletClient(WALLET_A)
    const { error } = await client
      .from('comments').insert({ market_id: 'btc', wallet: WALLET_A, body: 'overflow' })
    expect(error?.message).toMatch(/rate_limit_hourly/)
  })
})

describe('RLS — realtime.messages (path-draw policies)', () => {
  beforeEach(async () => { await resetTables() })

  it('anon cannot subscribe to path-draw:* channel', async () => {
    const anon = anonClient()
    const channel = anon.channel('path-draw:1', { config: { private: true } })
    const status = await new Promise<string>((resolve) => {
      channel.subscribe((s) => resolve(s))
    })
    expect(['CHANNEL_ERROR', 'CLOSED', 'TIMED_OUT']).toContain(status)
    anon.removeChannel(channel)
  })

  it('auth can subscribe and publish to path-draw:* channel', async () => {
    const client = await walletClient(WALLET_A)
    const channel = client.channel('path-draw:1', { config: { private: true } })
    const subStatus = await new Promise<string>((resolve) => {
      channel.subscribe((s) => { if (s === 'SUBSCRIBED') resolve(s) })
    })
    expect(subStatus).toBe('SUBSCRIBED')

    const sent = await channel.send({
      type: 'broadcast',
      event: 'draw_frame',
      payload: { wallet: WALLET_A, points: [] },
    })
    expect(sent).toBe('ok')
    client.removeChannel(channel)
  })
})
```

- [ ] **Step 2: Run the test suite**

```bash
pnpm test:rls
```

Expected: 12 tests pass total.

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/rls.test.ts
git commit -m "test(rls): rate-limit cooldown/hourly + realtime path-draw policies"
```

---

## Task 6: Edge Function scaffolding

**Files:**
- Create: `supabase/functions/verify-wallet/deno.json`
- Create: `supabase/functions/verify-wallet/_shared/cors.ts`
- Create: `supabase/functions/verify-wallet/index.ts` (skeleton, no logic yet)

- [ ] **Step 1: Create `supabase/functions/verify-wallet/deno.json`**

```json
{
  "imports": {
    "std/http/server":  "https://deno.land/std@0.224.0/http/server.ts",
    "supabase-js":      "https://esm.sh/@supabase/supabase-js@2.45.4",
    "tweetnacl":        "https://esm.sh/tweetnacl@1.0.3",
    "bs58":             "https://esm.sh/bs58@5.0.0",
    "djwt":             "https://deno.land/x/djwt@v3.0.2/mod.ts"
  }
}
```

- [ ] **Step 2: Create `supabase/functions/verify-wallet/_shared/cors.ts`**

```ts
const ORIGIN = Deno.env.get('APP_ORIGIN') ?? '*'

export const corsHeaders = {
  'Access-Control-Allow-Origin':  ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
```

- [ ] **Step 3: Create `supabase/functions/verify-wallet/index.ts` skeleton**

```ts
import { serve } from 'std/http/server'
import { createClient } from 'supabase-js'
import * as nacl from 'tweetnacl'
import bs58 from 'bs58'
import { create as signJWT, getNumericDate } from 'djwt'
import { corsHeaders } from './_shared/cors.ts'

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_JWT_SECRET       = Deno.env.get('SUPABASE_JWT_SECRET')!
const NONCE_TTL_SECONDS         = 5 * 60
const JWT_TTL_SECONDS           = 24 * 60 * 60

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const jwtKey = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(SUPABASE_JWT_SECRET),
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['sign', 'verify'],
)

export function buildMessage(nonce: string): string {
  return `Sign to verify ownership of your wallet for LevX.\n\nNonce: ${nonce}\n\nThis is not a transaction and will not move funds.`
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const url = new URL(req.url)

  try {
    if (url.pathname.endsWith('/nonce'))  return json({ error: 'not_implemented' }, 501)
    if (url.pathname.endsWith('/verify')) return json({ error: 'not_implemented' }, 501)
    return json({ error: 'not_found' }, 404)
  } catch (e) {
    console.error(e)
    return json({ error: 'internal' }, 500)
  }
})
```

- [ ] **Step 4: Serve the function locally and verify the 501s return**

In one terminal:
```bash
supabase functions serve verify-wallet --no-verify-jwt
```

In another:
```bash
curl -X POST http://127.0.0.1:54321/functions/v1/verify-wallet/nonce
```

Expected: `{"error":"not_implemented"}` with status 501.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/verify-wallet
git commit -m "feat(supabase): verify-wallet edge function scaffold (stubs return 501)"
```

---

## Task 7: Edge Function — `/nonce` route (TDD)

**Files:**
- Create: `supabase/functions/verify-wallet/index.test.ts`
- Modify: `supabase/functions/verify-wallet/index.ts`

- [ ] **Step 1: Create the Deno test file with `/nonce` tests (failing)**

Create `supabase/functions/verify-wallet/index.test.ts`:

```ts
import { assertEquals, assertExists } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { buildMessage } from './index.ts'

const FN_URL = Deno.env.get('FN_URL') ?? 'http://127.0.0.1:54321/functions/v1/verify-wallet'

async function postJSON(path: string, body: unknown = {}) {
  const res = await fetch(`${FN_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json() }
}

Deno.test('nonce: returns nonce, message containing that nonce, and expiresAt', async () => {
  const { status, body } = await postJSON('/nonce')
  assertEquals(status, 200)
  assertExists(body.nonce)
  assertExists(body.expiresAt)
  assertExists(body.message)
  assertEquals(body.message, buildMessage(body.nonce))
})

Deno.test('nonce: subsequent calls return different nonces', async () => {
  const a = await postJSON('/nonce')
  const b = await postJSON('/nonce')
  assertEquals(a.status, 200)
  assertEquals(b.status, 200)
  if (a.body.nonce === b.body.nonce) throw new Error('nonces must be unique')
})
```

- [ ] **Step 2: Run the tests — they should fail (501 from stub)**

In one terminal keep `supabase functions serve verify-wallet` running. In another:
```bash
cd supabase/functions/verify-wallet
deno test --allow-env --allow-net index.test.ts
```

Expected: both tests FAIL (status 501 vs. expected 200).

- [ ] **Step 3: Implement `handleNonce` in `index.ts`**

Replace the `/nonce` branch in `serve(...)` and add the handler. The final `serve` block:

```ts
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const url = new URL(req.url)
  try {
    if (url.pathname.endsWith('/nonce'))  return await handleNonce()
    if (url.pathname.endsWith('/verify')) return json({ error: 'not_implemented' }, 501)
    return json({ error: 'not_found' }, 404)
  } catch (e) {
    console.error(e)
    return json({ error: 'internal' }, 500)
  }
})

async function handleNonce(): Promise<Response> {
  await admin.from('auth_nonces').delete().lt('expires_at', new Date().toISOString())
  const nonce = bs58.encode(crypto.getRandomValues(new Uint8Array(32)))
  const expiresAt = new Date(Date.now() + NONCE_TTL_SECONDS * 1000).toISOString()
  const { error } = await admin.from('auth_nonces').insert({ nonce, expires_at: expiresAt })
  if (error) throw error
  return json({ nonce, message: buildMessage(nonce), expiresAt })
}
```

- [ ] **Step 4: Re-run tests**

```bash
cd supabase/functions/verify-wallet
deno test --allow-env --allow-net index.test.ts
```

Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/verify-wallet/index.ts supabase/functions/verify-wallet/index.test.ts
git commit -m "feat(edge-fn): implement verify-wallet/nonce with opportunistic cleanup"
```

---

## Task 8: Edge Function — `/verify` route (TDD)

**Files:**
- Modify: `supabase/functions/verify-wallet/index.test.ts`
- Modify: `supabase/functions/verify-wallet/index.ts`

- [ ] **Step 1: Extend test file with `/verify` fixtures + six tests**

Append to `supabase/functions/verify-wallet/index.test.ts`:

```ts
import * as nacl from 'https://esm.sh/tweetnacl@1.0.3'
import bs58 from 'https://esm.sh/bs58@5.0.0'
import { verify as verifyJWT } from 'https://deno.land/x/djwt@v3.0.2/mod.ts'

const TEST_JWT_SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long'

async function testJWTKey() {
  return await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(TEST_JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )
}

function newKeypair() {
  return nacl.sign.keyPair()
}

function sign(message: string, secretKey: Uint8Array): string {
  const sig = nacl.sign.detached(new TextEncoder().encode(message), secretKey)
  return bs58.encode(sig)
}

async function freshNonce(): Promise<{ nonce: string; message: string }> {
  const { body } = await postJSON('/nonce')
  return { nonce: body.nonce, message: body.message }
}

Deno.test('verify: rejects malformed body', async () => {
  const { status, body } = await postJSON('/verify', { pubkey: 123 })
  assertEquals(status, 400)
  assertEquals(body.error, 'malformed')
})

Deno.test('verify: rejects unknown nonce', async () => {
  const kp = newKeypair()
  const pubkey = bs58.encode(kp.publicKey)
  const message = 'never-issued-by-server'
  const signature = sign(message, kp.secretKey)
  const { status, body } = await postJSON('/verify', {
    pubkey, nonce: 'unknown-nonce-abc', signature,
  })
  assertEquals(status, 400)
  assertEquals(body.error, 'nonce_used_or_expired')
})

Deno.test('verify: rejects bad signature', async () => {
  const { nonce, message } = await freshNonce()
  const kp = newKeypair()
  const otherKp = newKeypair()                              // sign with wrong key
  const badSig = sign(message, otherKp.secretKey)
  const { status, body } = await postJSON('/verify', {
    pubkey: bs58.encode(kp.publicKey), nonce, signature: badSig,
  })
  assertEquals(status, 401)
  assertEquals(body.error, 'invalid_signature')
})

Deno.test('verify: rejects double-spend (race)', async () => {
  const { nonce, message } = await freshNonce()
  const kp = newKeypair()
  const pubkey = bs58.encode(kp.publicKey)
  const signature = sign(message, kp.secretKey)

  const [a, b] = await Promise.all([
    postJSON('/verify', { pubkey, nonce, signature }),
    postJSON('/verify', { pubkey, nonce, signature }),
  ])
  const successes = [a, b].filter((r) => r.status === 200).length
  const rejections = [a, b].filter((r) => r.status !== 200).length
  assertEquals(successes, 1)
  assertEquals(rejections, 1)
})

Deno.test('verify: returns a valid JWT for a good signature', async () => {
  const { nonce, message } = await freshNonce()
  const kp = newKeypair()
  const pubkey = bs58.encode(kp.publicKey)
  const signature = sign(message, kp.secretKey)
  const { status, body } = await postJSON('/verify', { pubkey, nonce, signature })
  assertEquals(status, 200)
  assertExists(body.jwt)
  const key = await testJWTKey()
  const payload = await verifyJWT(body.jwt, key)
  assertEquals(payload.wallet, pubkey)
  assertEquals(payload.sub, pubkey)
  assertEquals(payload.role, 'authenticated')
  assertEquals(payload.aud, 'authenticated')
})

Deno.test('verify: second call with the same consumed nonce fails', async () => {
  const { nonce, message } = await freshNonce()
  const kp = newKeypair()
  const pubkey = bs58.encode(kp.publicKey)
  const signature = sign(message, kp.secretKey)
  const first = await postJSON('/verify', { pubkey, nonce, signature })
  assertEquals(first.status, 200)
  const second = await postJSON('/verify', { pubkey, nonce, signature })
  assertEquals(second.status, 400)
  assertEquals(second.body.error, 'nonce_used_or_expired')
})
```

- [ ] **Step 2: Run the tests — they should fail (501 still)**

```bash
cd supabase/functions/verify-wallet
deno test --allow-env --allow-net index.test.ts
```

Expected: the new tests FAIL (501 from `/verify` stub).

- [ ] **Step 3: Implement `handleVerify` in `index.ts`**

Replace the `/verify` branch in `serve(...)` and add the handler:

```ts
    if (url.pathname.endsWith('/verify')) return await handleVerify(req)
```

Append the handler:

```ts
async function handleVerify(req: Request): Promise<Response> {
  const parsed = await req.json().catch(() => null)
  if (!parsed || typeof parsed !== 'object') return json({ error: 'malformed' }, 400)
  const { pubkey, nonce, signature } = parsed as Record<string, unknown>
  if (typeof pubkey !== 'string' || typeof nonce !== 'string' || typeof signature !== 'string') {
    return json({ error: 'malformed' }, 400)
  }

  // Atomic consume: single delete returning the row, gated on expires_at.
  const { data: deleted, error: delErr } = await admin
    .from('auth_nonces').delete().eq('nonce', nonce)
    .gt('expires_at', new Date().toISOString())
    .select('nonce').maybeSingle()
  if (delErr || !deleted) return json({ error: 'nonce_used_or_expired' }, 400)

  const messageBytes = new TextEncoder().encode(buildMessage(nonce))
  let sigBytes: Uint8Array
  let pubkeyBytes: Uint8Array
  try {
    sigBytes    = bs58.decode(signature)
    pubkeyBytes = bs58.decode(pubkey)
  } catch {
    return json({ error: 'malformed' }, 400)
  }
  if (sigBytes.length !== 64 || pubkeyBytes.length !== 32) {
    return json({ error: 'malformed' }, 400)
  }

  const ok = nacl.sign.detached.verify(messageBytes, sigBytes, pubkeyBytes)
  if (!ok) return json({ error: 'invalid_signature' }, 401)

  const jwt = await signJWT(
    { alg: 'HS256', typ: 'JWT' },
    {
      iss:    'supabase',
      sub:    pubkey,
      role:   'authenticated',
      aud:    'authenticated',
      wallet: pubkey,
      iat:    getNumericDate(0),
      exp:    getNumericDate(JWT_TTL_SECONDS),
    },
    jwtKey,
  )
  const expiresAt = new Date(Date.now() + JWT_TTL_SECONDS * 1000).toISOString()
  return json({ jwt, expiresAt })
}
```

- [ ] **Step 4: Re-run tests**

```bash
cd supabase/functions/verify-wallet
deno test --allow-env --allow-net index.test.ts
```

Expected: all 8 tests PASS.

- [ ] **Step 5: Add the `test:edge` script to package.json**

Edit `package.json`, add:
```json
"test:edge": "cd supabase/functions/verify-wallet && deno test --allow-env --allow-net"
```

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/verify-wallet/index.ts supabase/functions/verify-wallet/index.test.ts package.json
git commit -m "feat(edge-fn): implement verify-wallet/verify with atomic nonce consume"
```

---

## Task 9: FE env vars + install supabase-js

**Files:**
- Modify: `src/env/env.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Install supabase-js**

```bash
pnpm add @supabase/supabase-js
```

- [ ] **Step 2: Update `src/env/env.config.ts`**

Replace the entire file contents:

```ts
function requireEnv(key: string): string {
  const val = import.meta.env[key]
  if (!val) throw new Error(`[env] Required variable ${key} is missing`)
  return val
}

export type AppEnv = {
  APP_ENV: string
  APP_API_BASE_URL: string
  APP_HERMES_URL: string
  APP_RPC_URL: string
  APP_NETWORK: 'devnet' | 'mainnet'
  APP_PROGRAM_ID: string
  APP_ADMIN_WALLETS: string[]
  APP_SUPABASE_URL: string
  APP_SUPABASE_ANON_KEY: string
}

export const env: AppEnv = {
  APP_ENV:               import.meta.env.APP_ENV ?? 'local',
  APP_API_BASE_URL:      import.meta.env.APP_API_BASE_URL ?? '',
  APP_HERMES_URL:        requireEnv('APP_HERMES_URL'),
  APP_RPC_URL:           requireEnv('APP_RPC_URL'),
  APP_NETWORK:           requireEnv('APP_NETWORK') as AppEnv['APP_NETWORK'],
  APP_PROGRAM_ID:        requireEnv('APP_PROGRAM_ID'),
  APP_ADMIN_WALLETS:     (import.meta.env.APP_ADMIN_WALLETS ?? '').split(',').map((s: string) => s.trim()).filter(Boolean),
  APP_SUPABASE_URL:      requireEnv('APP_SUPABASE_URL'),
  APP_SUPABASE_ANON_KEY: requireEnv('APP_SUPABASE_ANON_KEY'),
}
```

- [ ] **Step 3: Update your local `.env.local` with the anon key from `supabase status`**

```bash
supabase status
```

Copy the `anon key` value into `.env.local`:
```bash
APP_SUPABASE_URL=http://127.0.0.1:54321
APP_SUPABASE_ANON_KEY=<paste_here>
```

- [ ] **Step 4: Verify the FE typechecks and builds**

```bash
pnpm types
pnpm dev   # open in browser briefly to confirm no env errors, then Ctrl-C
```

Expected: no type errors; dev server starts without "Required variable APP_SUPABASE_URL is missing".

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml src/env/env.config.ts
git commit -m "chore(fe): install supabase-js and require supabase env vars"
```

---

## Task 10: FE supabase client + types

**Files:**
- Create: `src/lib/supabase/types.ts`
- Create: `src/lib/supabase/client.ts`

- [ ] **Step 1: Create `src/lib/supabase/types.ts`**

```ts
export type Comment = {
  id:          string
  market_id:   string
  wallet:      string
  body:        string
  created_at:  string
  edited_at:   string | null
}

export type JWTRecord = {
  jwt:        string
  expiresAt:  number   // unix ms
  wallet:     string
}

export type DrawFrame = {
  wallet:     string
  points:     Array<{ time: number; value: number }>
  timestamp:  number
  done?:      boolean
}

export type AuthStatus = 'idle' | 'pending' | 'authenticated' | 'error'
```

- [ ] **Step 2: Create `src/lib/supabase/client.ts`**

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/env'
import { getActiveJWT } from './auth'

let clientRef: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (clientRef) return clientRef
  clientRef = createClient(env.APP_SUPABASE_URL, env.APP_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    accessToken: async () => {
      const rec = getActiveJWT()
      return rec?.jwt ?? null
    },
  })
  return clientRef
}
```

> Note: `getActiveJWT` is defined in Task 11. TypeScript will complain until that file exists. The order is deliberate — Task 11 immediately follows and fixes the reference.

- [ ] **Step 3: Do NOT run typecheck yet (will fail until Task 11). Commit anyway.**

```bash
git add src/lib/supabase/types.ts src/lib/supabase/client.ts
git commit -m "feat(fe/supabase): client singleton and shared types"
```

---

## Task 11: FE `auth.ts` — cache CRUD (TDD)

**Files:**
- Create: `src/lib/supabase/__tests__/auth.test.ts`
- Create: `src/lib/supabase/auth.ts`

- [ ] **Step 1: Create `src/lib/supabase/__tests__/auth.test.ts` with cache-only tests**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { cacheJWT, loadCachedJWT, clearJWT, getActiveJWT, __setActiveWallet } from '../auth'

const PUBKEY_A = 'AliceWalletPubkey1111111111111111111111111111'
const PUBKEY_B = 'BobWalletPubkey22222222222222222222222222222'
const ONE_HOUR_MS = 60 * 60 * 1000

describe('auth cache', () => {
  beforeEach(() => {
    localStorage.clear()
    __setActiveWallet(null)
    vi.useRealTimers()
  })

  it('stores and retrieves a record keyed by wallet', () => {
    const exp = Date.now() + ONE_HOUR_MS
    cacheJWT({ jwt: 'abc', expiresAt: exp, wallet: PUBKEY_A })
    expect(loadCachedJWT(PUBKEY_A)).toEqual({ jwt: 'abc', expiresAt: exp, wallet: PUBKEY_A })
  })

  it('returns null for a different wallet', () => {
    cacheJWT({ jwt: 'abc', expiresAt: Date.now() + ONE_HOUR_MS, wallet: PUBKEY_A })
    expect(loadCachedJWT(PUBKEY_B)).toBeNull()
  })

  it('returns null for an expired record', () => {
    cacheJWT({ jwt: 'abc', expiresAt: Date.now() - 1000, wallet: PUBKEY_A })
    expect(loadCachedJWT(PUBKEY_A)).toBeNull()
  })

  it('clearJWT purges that wallet only', () => {
    cacheJWT({ jwt: 'a', expiresAt: Date.now() + ONE_HOUR_MS, wallet: PUBKEY_A })
    cacheJWT({ jwt: 'b', expiresAt: Date.now() + ONE_HOUR_MS, wallet: PUBKEY_B })
    clearJWT(PUBKEY_A)
    expect(loadCachedJWT(PUBKEY_A)).toBeNull()
    expect(loadCachedJWT(PUBKEY_B)?.jwt).toBe('b')
  })

  it('getActiveJWT returns null when no active wallet is set', () => {
    cacheJWT({ jwt: 'abc', expiresAt: Date.now() + ONE_HOUR_MS, wallet: PUBKEY_A })
    expect(getActiveJWT()).toBeNull()
  })

  it('getActiveJWT returns the record for the active wallet', () => {
    cacheJWT({ jwt: 'abc', expiresAt: Date.now() + ONE_HOUR_MS, wallet: PUBKEY_A })
    __setActiveWallet(PUBKEY_A)
    expect(getActiveJWT()?.jwt).toBe('abc')
  })

  it('getActiveJWT honors the 60s expiry margin', () => {
    // expires in 30s — inside the 60s margin → should be treated as expired
    cacheJWT({ jwt: 'abc', expiresAt: Date.now() + 30_000, wallet: PUBKEY_A })
    __setActiveWallet(PUBKEY_A)
    expect(getActiveJWT()).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests — should fail (auth.ts does not exist)**

```bash
pnpm test:run src/lib/supabase/__tests__/auth.test.ts
```

Expected: FAIL — "Cannot find module '../auth'".

- [ ] **Step 3: Create `src/lib/supabase/auth.ts` with cache CRUD**

```ts
import type { JWTRecord } from './types'

const KEY_PREFIX = 'levx_jwt:'
const EXPIRY_MARGIN_MS = 60_000

let activeWallet: string | null = null

/** Test-only helper. Must be called from the provider whenever the wallet changes. */
export function __setActiveWallet(wallet: string | null): void {
  activeWallet = wallet
}

export function cacheJWT(rec: JWTRecord): void {
  localStorage.setItem(KEY_PREFIX + rec.wallet, JSON.stringify(rec))
}

export function loadCachedJWT(wallet: string): JWTRecord | null {
  const raw = localStorage.getItem(KEY_PREFIX + wallet)
  if (!raw) return null
  try {
    const rec = JSON.parse(raw) as JWTRecord
    if (rec.wallet !== wallet) return null                       // paranoia
    if (rec.expiresAt <= Date.now() + EXPIRY_MARGIN_MS) return null
    return rec
  } catch {
    return null
  }
}

export function clearJWT(wallet: string): void {
  localStorage.removeItem(KEY_PREFIX + wallet)
}

export function getActiveJWT(): JWTRecord | null {
  if (!activeWallet) return null
  return loadCachedJWT(activeWallet)
}
```

- [ ] **Step 4: Re-run tests**

```bash
pnpm test:run src/lib/supabase/__tests__/auth.test.ts
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/auth.ts src/lib/supabase/__tests__/auth.test.ts
git commit -m "feat(fe/supabase): auth cache CRUD with wallet scoping and 60s margin"
```

---

## Task 12: FE `auth.ts` — Edge Function calls (TDD)

**Files:**
- Modify: `src/lib/supabase/__tests__/auth.test.ts`
- Modify: `src/lib/supabase/auth.ts`

- [ ] **Step 1: Append Edge Function call tests**

Append to `src/lib/supabase/__tests__/auth.test.ts`:

```ts
import { requestNonce, verifyAndGetJWT } from '../auth'

describe('auth edge function calls', () => {
  const realFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch
  })

  afterAll(() => {
    globalThis.fetch = realFetch
  })

  it('requestNonce posts to /functions/v1/verify-wallet/nonce and returns payload', async () => {
    const payload = {
      nonce: 'abc', message: 'hello sign this', expiresAt: new Date(Date.now() + 60_000).toISOString(),
    }
    ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true, json: async () => payload,
    })
    const out = await requestNonce()
    expect(out).toEqual(payload)
    const call = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[0]).toMatch(/\/functions\/v1\/verify-wallet\/nonce$/)
    expect(call[1].method).toBe('POST')
  })

  it('verifyAndGetJWT posts pubkey/nonce/signature and returns JWT envelope', async () => {
    const payload = { jwt: 'eyJ...', expiresAt: new Date(Date.now() + 3600_000).toISOString() }
    ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true, json: async () => payload,
    })
    const out = await verifyAndGetJWT({ pubkey: PUBKEY_A, nonce: 'abc', signature: 'sig' })
    expect(out.jwt).toBe('eyJ...')
    expect(out.wallet).toBe(PUBKEY_A)
    expect(typeof out.expiresAt).toBe('number')
  })

  it('verifyAndGetJWT throws on non-ok response', async () => {
    ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false, status: 401, json: async () => ({ error: 'invalid_signature' }),
    })
    await expect(verifyAndGetJWT({ pubkey: PUBKEY_A, nonce: 'n', signature: 's' })).rejects.toThrow(/invalid_signature/)
  })
})
```

Also add `afterAll` to the existing vitest imports at the top of the file.

- [ ] **Step 2: Run tests — should fail (functions don't exist)**

```bash
pnpm test:run src/lib/supabase/__tests__/auth.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Append implementations to `src/lib/supabase/auth.ts`**

```ts
import { env } from '@/env'

export type NonceResponse = { nonce: string; message: string; expiresAt: string }
export type VerifyRequest = { pubkey: string; nonce: string; signature: string }

export async function requestNonce(): Promise<NonceResponse> {
  const res = await fetch(`${env.APP_SUPABASE_URL}/functions/v1/verify-wallet/nonce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.APP_SUPABASE_ANON_KEY },
    body: '{}',
  })
  if (!res.ok) throw new Error(`nonce request failed: ${res.status}`)
  return (await res.json()) as NonceResponse
}

export async function verifyAndGetJWT(req: VerifyRequest): Promise<JWTRecord> {
  const res = await fetch(`${env.APP_SUPABASE_URL}/functions/v1/verify-wallet/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.APP_SUPABASE_ANON_KEY },
    body: JSON.stringify(req),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body?.error ?? `verify failed: ${res.status}`)
  return {
    jwt:       body.jwt as string,
    expiresAt: Date.parse(body.expiresAt as string),
    wallet:    req.pubkey,
  }
}
```

- [ ] **Step 4: Re-run tests**

```bash
pnpm test:run src/lib/supabase/__tests__/auth.test.ts
```

Expected: all 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/auth.ts src/lib/supabase/__tests__/auth.test.ts
git commit -m "feat(fe/supabase): requestNonce + verifyAndGetJWT edge function clients"
```

---

## Task 13: FE `channels.ts` — ref-counted channel manager (TDD)

**Files:**
- Create: `src/lib/supabase/__tests__/channels.test.ts`
- Create: `src/lib/supabase/channels.ts`

- [ ] **Step 1: Create `src/lib/supabase/__tests__/channels.test.ts`**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { acquireChannel, releaseChannel, __resetChannelRegistry } from '../channels'

type FakeChannel = { name: string; removed: boolean }
const fakeChannels: Record<string, FakeChannel> = {}

function fakeSupabase() {
  return {
    channel(name: string, _opts?: unknown) {
      const ch: FakeChannel = { name, removed: false }
      fakeChannels[name] = ch
      return ch
    },
    removeChannel(ch: FakeChannel) {
      ch.removed = true
    },
  } as unknown as import('@supabase/supabase-js').SupabaseClient
}

describe('channels ref-counting', () => {
  beforeEach(() => {
    for (const k of Object.keys(fakeChannels)) delete fakeChannels[k]
    __resetChannelRegistry()
  })

  it('three acquires yield one underlying channel', () => {
    const s = fakeSupabase()
    const a = acquireChannel(s, 'comments:1', { config: {} })
    const b = acquireChannel(s, 'comments:1', { config: {} })
    const c = acquireChannel(s, 'comments:1', { config: {} })
    expect(a).toBe(b)
    expect(b).toBe(c)
    expect(Object.keys(fakeChannels).length).toBe(1)
  })

  it('releases decrement the count; removeChannel only on final release', () => {
    const s = fakeSupabase()
    acquireChannel(s, 'comments:1', { config: {} })
    acquireChannel(s, 'comments:1', { config: {} })
    releaseChannel(s, 'comments:1')
    expect(fakeChannels['comments:1'].removed).toBe(false)
    releaseChannel(s, 'comments:1')
    expect(fakeChannels['comments:1'].removed).toBe(true)
  })

  it('release beyond zero is a noop', () => {
    const s = fakeSupabase()
    acquireChannel(s, 'comments:1', { config: {} })
    releaseChannel(s, 'comments:1')
    releaseChannel(s, 'comments:1')   // ref already 0
    expect(fakeChannels['comments:1'].removed).toBe(true)
  })

  it('different names yield different channels', () => {
    const s = fakeSupabase()
    const a = acquireChannel(s, 'comments:1', { config: {} })
    const b = acquireChannel(s, 'comments:2', { config: {} })
    expect(a).not.toBe(b)
  })
})
```

- [ ] **Step 2: Run — should fail (no channels.ts)**

```bash
pnpm test:run src/lib/supabase/__tests__/channels.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Create `src/lib/supabase/channels.ts`**

```ts
import type { RealtimeChannel, RealtimeChannelOptions, SupabaseClient } from '@supabase/supabase-js'

type Entry = { channel: RealtimeChannel; count: number }
const registry = new Map<string, Entry>()

export function __resetChannelRegistry(): void {
  registry.clear()
}

export function acquireChannel(
  supabase: SupabaseClient,
  name: string,
  opts: RealtimeChannelOptions,
): RealtimeChannel {
  const existing = registry.get(name)
  if (existing) {
    existing.count += 1
    return existing.channel
  }
  const channel = supabase.channel(name, opts)
  registry.set(name, { channel, count: 1 })
  return channel
}

export function releaseChannel(supabase: SupabaseClient, name: string): void {
  const entry = registry.get(name)
  if (!entry) return
  entry.count -= 1
  if (entry.count <= 0) {
    supabase.removeChannel(entry.channel)
    registry.delete(name)
  }
}
```

- [ ] **Step 4: Re-run tests**

```bash
pnpm test:run src/lib/supabase/__tests__/channels.test.ts
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/channels.ts src/lib/supabase/__tests__/channels.test.ts
git commit -m "feat(fe/supabase): ref-counted realtime channel registry"
```

---

## Task 14: FE `SupabaseAuthProvider` + `useSupabaseAuth` (TDD)

**Files:**
- Create: `src/lib/supabase/__mocks__/supabase-js.ts`
- Create: `src/lib/supabase/__tests__/useSupabaseAuth.test.tsx`
- Create: `src/lib/supabase/provider.tsx`
- Create: `src/lib/supabase/hooks.ts`

- [ ] **Step 1: Create the supabase-js mock at `src/lib/supabase/__mocks__/supabase-js.ts`**

```ts
import { vi } from 'vitest'

type Listener = (payload: unknown) => void
const listeners = new Map<string, Listener[]>()

export function __emitRealtime(name: string, event: string, payload: unknown) {
  const key = `${name}::${event}`
  listeners.get(key)?.forEach((l) => l(payload))
}

export function __resetSupabaseMock() {
  listeners.clear()
}

export const mockFrom = vi.fn()
export const mockSend = vi.fn(async () => 'ok')
export const mockRemoveChannel = vi.fn()

export const createClient = vi.fn(() => ({
  from: mockFrom,
  channel(name: string) {
    return {
      on(_type: string, filter: { event: string } | unknown, cb: Listener) {
        const event = (filter as { event: string }).event ?? 'INSERT'
        const key = `${name}::${event}`
        const list = listeners.get(key) ?? []
        list.push(cb)
        listeners.set(key, list)
        return this
      },
      subscribe(cb?: (s: string) => void) { cb?.('SUBSCRIBED'); return this },
      send: mockSend,
      unsubscribe() { /* noop */ },
    }
  },
  removeChannel: mockRemoveChannel,
}))
```

- [ ] **Step 2: Wire the mock into the existing test setup**

Edit `src/test/setup.ts` (open it first to see its current contents); append:
```ts
import { vi } from 'vitest'
vi.mock('@supabase/supabase-js', () => import('@/lib/supabase/__mocks__/supabase-js'))
```

If the file does not already import vitest's `vi`, add that import at the top.

- [ ] **Step 3: Create `src/lib/supabase/__tests__/useSupabaseAuth.test.tsx`**

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { SupabaseAuthProvider } from '../provider'
import { useSupabaseAuth } from '../hooks'
import { useWalletStore } from '@/stores/walletStore'
import { cacheJWT } from '../auth'
import { PublicKey } from '@solana/web3.js'

const PUBKEY_A = 'AliceWalletPubkey1111111111111111111111111111'

function wrapper({ children }: PropsWithChildren) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <SupabaseAuthProvider>{children}</SupabaseAuthProvider>
    </QueryClientProvider>
  )
}

function mockSignMessage(_msg: Uint8Array): Promise<Uint8Array> {
  return Promise.resolve(new Uint8Array(64))
}

function setConnectedWallet(wallet: string | null) {
  useWalletStore.setState({
    publicKey: wallet ? ({ toBase58: () => wallet } as unknown as PublicKey) : null,
    connected: wallet !== null,
    connecting: false,
    wrongNetwork: false,
    cluster: 'devnet',
  })
}

describe('useSupabaseAuth', () => {
  beforeEach(() => {
    localStorage.clear()
    useWalletStore.setState({
      publicKey: null, connected: false, connecting: false, wrongNetwork: false, cluster: null,
    })
    vi.stubGlobal('fetch', vi.fn())
  })

  it('warm path: valid cached JWT restores silently', async () => {
    cacheJWT({ jwt: 'cached.jwt', expiresAt: Date.now() + 3600_000, wallet: PUBKEY_A })
    const { result } = renderHook(() => useSupabaseAuth(), { wrapper })
    act(() => setConnectedWallet(PUBKEY_A))
    await waitFor(() => expect(result.current.status).toBe('authenticated'))
    expect(result.current.jwt).toBe('cached.jwt')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('cold path: no cache → calls Edge Function, signs, stores JWT', async () => {
    ;(fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          nonce: 'n1', message: 'sign me', expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jwt: 'fresh.jwt', expiresAt: new Date(Date.now() + 86400_000).toISOString() }),
      })

    const { result } = renderHook(() => useSupabaseAuth({ signMessage: mockSignMessage }), { wrapper })
    act(() => setConnectedWallet(PUBKEY_A))
    await waitFor(() => expect(result.current.status).toBe('authenticated'))
    expect(result.current.jwt).toBe('fresh.jwt')
  })

  it('user rejects sig → status=error; authenticate() retries', async () => {
    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ nonce: 'n1', message: 'sign', expiresAt: new Date(Date.now() + 60_000).toISOString() }),
    })
    const reject = vi.fn().mockRejectedValueOnce(new Error('User rejected'))
    const { result } = renderHook(() => useSupabaseAuth({ signMessage: reject }), { wrapper })
    act(() => setConnectedWallet(PUBKEY_A))
    await waitFor(() => expect(result.current.status).toBe('error'))
  })

  it('wallet change: old cache is purged', async () => {
    cacheJWT({ jwt: 'old', expiresAt: Date.now() + 3600_000, wallet: PUBKEY_A })
    const { result } = renderHook(() => useSupabaseAuth(), { wrapper })
    act(() => setConnectedWallet(PUBKEY_A))
    await waitFor(() => expect(result.current.status).toBe('authenticated'))

    act(() => setConnectedWallet(null))                       // disconnect
    await waitFor(() => expect(result.current.status).toBe('idle'))
    // Cache should be purged.
    expect(localStorage.getItem('levx_jwt:' + PUBKEY_A)).toBeNull()
  })
})
```

- [ ] **Step 4: Run — should fail (no provider/hooks)**

```bash
pnpm test:run src/lib/supabase/__tests__/useSupabaseAuth.test.tsx
```

Expected: FAIL — missing imports.

- [ ] **Step 5: Create `src/lib/supabase/provider.tsx`**

```tsx
import { createContext, useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'

import { useWalletStore } from '@/stores/walletStore'
import type { AuthStatus, JWTRecord } from './types'
import {
  cacheJWT, clearJWT, loadCachedJWT, requestNonce, verifyAndGetJWT, __setActiveWallet,
} from './auth'

type SignMessageFn = (message: Uint8Array) => Promise<Uint8Array>

export type AuthContextValue = {
  status:      AuthStatus
  jwt:         string | null
  wallet:      string | null
  expiresAt:   number | null
  authenticate(): Promise<void>
  signOut():   void
}

export const SupabaseAuthContext = createContext<AuthContextValue | null>(null)

type Props = PropsWithChildren<{
  /** Optional override for tests — defaults to the wallet adapter's signMessage. */
  signMessage?: SignMessageFn
}>

export function SupabaseAuthProvider({ children, signMessage: signOverride }: Props) {
  const adapter = useWallet()
  const connected = useWalletStore((s) => s.connected)
  const publicKey = useWalletStore((s) => s.publicKey)

  const [status, setStatus] = useState<AuthStatus>('idle')
  const [record, setRecord] = useState<JWTRecord | null>(null)
  const prevWalletRef = useRef<string | null>(null)

  const wallet = publicKey?.toBase58() ?? null

  const signMessage: SignMessageFn = useCallback(async (msg) => {
    if (signOverride) return signOverride(msg)
    if (!adapter.signMessage) throw new Error('wallet does not support signMessage')
    return adapter.signMessage(msg)
  }, [adapter, signOverride])

  const authenticate = useCallback(async () => {
    if (!wallet) return
    setStatus('pending')
    try {
      const { nonce, message } = await requestNonce()
      const sig = await signMessage(new TextEncoder().encode(message))
      const { default: bs58 } = await import('bs58')
      const signature = bs58.encode(sig)
      const rec = await verifyAndGetJWT({ pubkey: wallet, nonce, signature })
      cacheJWT(rec)
      setRecord(rec)
      setStatus('authenticated')
    } catch (e) {
      console.error('[supabase auth]', e)
      setStatus('error')
    }
  }, [wallet, signMessage])

  const signOut = useCallback(() => {
    if (wallet) clearJWT(wallet)
    setRecord(null)
    setStatus('idle')
    __setActiveWallet(null)
  }, [wallet])

  // React to wallet connect/disconnect/change.
  useEffect(() => {
    const prev = prevWalletRef.current
    prevWalletRef.current = wallet

    if (!connected || !wallet) {
      if (prev) clearJWT(prev)                                // symmetric purge
      setRecord(null)
      setStatus('idle')
      __setActiveWallet(null)
      return
    }

    if (prev && prev !== wallet) clearJWT(prev)

    __setActiveWallet(wallet)
    const cached = loadCachedJWT(wallet)
    if (cached) {
      setRecord(cached)
      setStatus('authenticated')
      return
    }
    void authenticate()
  }, [connected, wallet, authenticate])

  const value = useMemo<AuthContextValue>(() => ({
    status,
    jwt:       record?.jwt ?? null,
    wallet:    wallet,
    expiresAt: record?.expiresAt ?? null,
    authenticate,
    signOut,
  }), [status, record, wallet, authenticate, signOut])

  return (
    <SupabaseAuthContext.Provider value={value}>
      {children}
    </SupabaseAuthContext.Provider>
  )
}
```

- [ ] **Step 6: Create `src/lib/supabase/hooks.ts` with just `useSupabaseAuth`**

```ts
import { useContext } from 'react'
import { SupabaseAuthContext, type AuthContextValue } from './provider'

export function useSupabaseAuth(): AuthContextValue {
  const ctx = useContext(SupabaseAuthContext)
  if (!ctx) throw new Error('useSupabaseAuth must be used inside <SupabaseAuthProvider>')
  return ctx
}
```

Note: the provider's prop shape supports the test harness's `signMessage` override. In real app use (Task 17), the override is omitted and the adapter's built-in `signMessage` is used.

- [ ] **Step 7: Install `bs58` for the provider's signature encoding**

```bash
pnpm add bs58
```

- [ ] **Step 8: Run tests**

```bash
pnpm test:run src/lib/supabase/__tests__/useSupabaseAuth.test.tsx
```

Expected: 4 tests PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/supabase/provider.tsx src/lib/supabase/hooks.ts src/lib/supabase/__mocks__/supabase-js.ts src/lib/supabase/__tests__/useSupabaseAuth.test.tsx src/test/setup.ts package.json pnpm-lock.yaml
git commit -m "feat(fe/supabase): SupabaseAuthProvider with eager-cached wallet sign-in"
```

---

## Task 15: FE `useComments` + `usePostComment` (TDD)

**Files:**
- Create: `src/lib/supabase/__tests__/useComments.test.tsx`
- Create: `src/lib/supabase/__tests__/usePostComment.test.tsx`
- Modify: `src/lib/supabase/hooks.ts`

- [ ] **Step 1: Create `src/lib/supabase/__tests__/useComments.test.tsx`**

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useComments } from '../hooks'
import { mockFrom, __emitRealtime, __resetSupabaseMock } from '../__mocks__/supabase-js'

function wrapper({ children }: PropsWithChildren) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

function mockSelectChain(rows: unknown[]) {
  return {
    select: () => ({
      eq: () => ({
        order: () => ({
          limit: () => Promise.resolve({ data: rows, error: null }),
        }),
      }),
    }),
  }
}

describe('useComments', () => {
  beforeEach(() => {
    __resetSupabaseMock()
    ;(mockFrom as unknown as ReturnType<typeof vi.fn>).mockReset()
  })

  it('fetches initial comments', async () => {
    const rows = [
      { id: '1', market_id: 'btc', wallet: 'A', body: 'hi', created_at: '2026-04-17T00:00:00Z', edited_at: null },
    ]
    ;(mockFrom as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockSelectChain(rows))
    const { result } = renderHook(() => useComments('btc'), { wrapper })
    await waitFor(() => expect(result.current.data?.length).toBe(1))
    expect(result.current.data?.[0].body).toBe('hi')
  })

  it('realtime INSERT with new id prepends to cache', async () => {
    const initial = [
      { id: '1', market_id: 'btc', wallet: 'A', body: 'first', created_at: '2026-04-17T00:00:00Z', edited_at: null },
    ]
    ;(mockFrom as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockSelectChain(initial))
    const { result } = renderHook(() => useComments('btc'), { wrapper })
    await waitFor(() => expect(result.current.data?.length).toBe(1))

    act(() => {
      __emitRealtime('comments:btc', 'INSERT', {
        new: { id: '2', market_id: 'btc', wallet: 'B', body: 'second', created_at: '2026-04-17T00:01:00Z', edited_at: null },
      })
    })
    await waitFor(() => expect(result.current.data?.length).toBe(2))
    expect(result.current.data?.[0].id).toBe('2')              // prepended
  })

  it('realtime INSERT with existing id does NOT duplicate', async () => {
    const initial = [
      { id: '1', market_id: 'btc', wallet: 'A', body: 'first', created_at: '2026-04-17T00:00:00Z', edited_at: null },
    ]
    ;(mockFrom as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockSelectChain(initial))
    const { result } = renderHook(() => useComments('btc'), { wrapper })
    await waitFor(() => expect(result.current.data?.length).toBe(1))

    act(() => {
      __emitRealtime('comments:btc', 'INSERT', { new: initial[0] })
    })
    // Give React a tick.
    await new Promise((r) => setTimeout(r, 10))
    expect(result.current.data?.length).toBe(1)
  })
})
```

- [ ] **Step 2: Create `src/lib/supabase/__tests__/usePostComment.test.tsx`**

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { usePostComment } from '../hooks'
import { mockFrom, __resetSupabaseMock } from '../__mocks__/supabase-js'

function wrapper({ children }: PropsWithChildren) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

function mockInsertReturning(row: unknown, error: unknown = null) {
  return {
    insert: () => ({
      select: () => ({
        single: () => Promise.resolve({ data: row, error }),
      }),
    }),
  }
}

describe('usePostComment', () => {
  beforeEach(() => {
    __resetSupabaseMock()
    ;(mockFrom as unknown as ReturnType<typeof vi.fn>).mockReset()
  })

  it('success path: mutation returns the new row', async () => {
    const row = { id: '1', market_id: 'btc', wallet: 'A', body: 'hi', created_at: 'now', edited_at: null }
    ;(mockFrom as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockInsertReturning(row))
    const { result } = renderHook(() => usePostComment('btc', 'A'), { wrapper })
    result.current.mutate({ body: 'hi' })
    await waitFor(() => expect(result.current.data?.body).toBe('hi'))
  })

  it('rate-limit P0001 surfaces a rate_limit error', async () => {
    ;(mockFrom as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      mockInsertReturning(null, { code: 'P0001', message: 'rate_limit_cooldown' }),
    )
    const { result } = renderHook(() => usePostComment('btc', 'A'), { wrapper })
    result.current.mutate({ body: 'spam' })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toMatch(/rate_limit/)
  })

  it('RLS rejection (42501) surfaces a permission error', async () => {
    ;(mockFrom as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      mockInsertReturning(null, { code: '42501', message: 'permission denied' }),
    )
    const { result } = renderHook(() => usePostComment('btc', 'A'), { wrapper })
    result.current.mutate({ body: 'spoof' })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toMatch(/permission/)
  })
})
```

- [ ] **Step 3: Run — should fail**

```bash
pnpm test:run src/lib/supabase/__tests__/useComments.test.tsx src/lib/supabase/__tests__/usePostComment.test.tsx
```

Expected: FAIL — `useComments` / `usePostComment` not exported.

- [ ] **Step 4: Extend `src/lib/supabase/hooks.ts` with the comment hooks**

Append to `src/lib/supabase/hooks.ts`:

```ts
import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query'
import { getSupabase } from './client'
import { acquireChannel, releaseChannel } from './channels'
import type { Comment } from './types'

export function useComments(marketId: string): UseQueryResult<Comment[]> {
  const qc = useQueryClient()
  const query = useQuery<Comment[]>({
    queryKey: ['supabase', 'comments', marketId],
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('comments')
        .select('*')
        .eq('market_id', marketId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw new Error(error.message)
      return (data ?? []) as Comment[]
    },
  })

  useEffect(() => {
    const supabase = getSupabase()
    const name = `comments:${marketId}`
    const channel = acquireChannel(supabase, name, { config: {} })
    channel
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments', filter: `market_id=eq.${marketId}` },
        (payload: { new: Comment }) => {
          qc.setQueryData<Comment[]>(['supabase', 'comments', marketId], (prev) => {
            const curr = prev ?? []
            if (curr.some((c) => c.id === payload.new.id)) return curr
            return [payload.new, ...curr]
          })
        },
      )
      .subscribe()
    return () => { releaseChannel(supabase, name) }
  }, [marketId, qc])

  return query
}

export function usePostComment(marketId: string, wallet: string | null): UseMutationResult<Comment, Error, { body: string }> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ body }) => {
      if (!wallet) throw new Error('not_connected')
      const { data, error } = await getSupabase()
        .from('comments')
        .insert({ market_id: marketId, wallet, body })
        .select()
        .single()
      if (error) {
        if (error.code === 'P0001') throw new Error(`rate_limit: ${error.message}`)
        if (error.code === '42501') throw new Error(`permission_denied: ${error.message}`)
        throw new Error(error.message)
      }
      return data as Comment
    },
    onSuccess: (row) => {
      qc.setQueryData<Comment[]>(['supabase', 'comments', marketId], (prev) => {
        const curr = prev ?? []
        if (curr.some((c) => c.id === row.id)) return curr
        return [row, ...curr]
      })
    },
  })
}
```

- [ ] **Step 5: Re-run tests**

```bash
pnpm test:run src/lib/supabase/__tests__/useComments.test.tsx src/lib/supabase/__tests__/usePostComment.test.tsx
```

Expected: all 6 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase/hooks.ts src/lib/supabase/__tests__/useComments.test.tsx src/lib/supabase/__tests__/usePostComment.test.tsx
git commit -m "feat(fe/supabase): useComments (realtime) and usePostComment hooks"
```

---

## Task 16: FE `useDrawBroadcast` + `usePublishDrawFrame` (TDD)

**Files:**
- Create: `src/lib/supabase/__tests__/useDrawBroadcast.test.tsx`
- Modify: `src/lib/supabase/hooks.ts`

- [ ] **Step 1: Create `src/lib/supabase/__tests__/useDrawBroadcast.test.tsx`**

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { PropsWithChildren } from 'react'

import { useDrawBroadcast, usePublishDrawFrame } from '../hooks'
import { __emitRealtime, __resetSupabaseMock, mockSend } from '../__mocks__/supabase-js'

function wrapper({ children }: PropsWithChildren) {
  return <>{children}</>
}

describe('useDrawBroadcast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    __resetSupabaseMock()
    mockSend.mockClear()
  })

  it('last frame per wallet wins; own wallet excluded', () => {
    const { result } = renderHook(() => useDrawBroadcast('btc', 'A'), { wrapper })
    act(() => {
      __emitRealtime('path-draw:btc', 'draw_frame', { payload: { wallet: 'B', points: [{ time: 1, value: 1 }], timestamp: 1 } })
      __emitRealtime('path-draw:btc', 'draw_frame', { payload: { wallet: 'B', points: [{ time: 1, value: 2 }], timestamp: 2 } })
      __emitRealtime('path-draw:btc', 'draw_frame', { payload: { wallet: 'A', points: [{ time: 1, value: 9 }], timestamp: 3 } })
    })
    expect(result.current.liveDraws['B']?.timestamp).toBe(2)
    expect(result.current.liveDraws['A']).toBeUndefined()
  })

  it('stale frames expire after 5s of no updates', () => {
    const { result } = renderHook(() => useDrawBroadcast('btc', 'A'), { wrapper })
    act(() => {
      __emitRealtime('path-draw:btc', 'draw_frame', { payload: { wallet: 'B', points: [], timestamp: Date.now() } })
    })
    expect(result.current.liveDraws['B']).toBeDefined()
    act(() => { vi.advanceTimersByTime(5500) })
    expect(result.current.liveDraws['B']).toBeUndefined()
  })
})

describe('usePublishDrawFrame', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    __resetSupabaseMock()
    mockSend.mockClear()
  })

  it('throttles bursts to ~10 Hz with leading + trailing edge', () => {
    const { result } = renderHook(() => usePublishDrawFrame('btc', 'A'))
    act(() => {
      result.current({ wallet: 'A', points: [{ time: 1, value: 1 }], timestamp: 1 })
      result.current({ wallet: 'A', points: [{ time: 2, value: 2 }], timestamp: 2 })
      result.current({ wallet: 'A', points: [{ time: 3, value: 3 }], timestamp: 3 })
    })
    // Leading edge fires synchronously.
    expect(mockSend).toHaveBeenCalledTimes(1)
    act(() => { vi.advanceTimersByTime(120) })
    // Trailing edge after the throttle window.
    expect(mockSend).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Run — should fail**

```bash
pnpm test:run src/lib/supabase/__tests__/useDrawBroadcast.test.tsx
```

Expected: FAIL (hooks don't exist).

- [ ] **Step 3: Extend `src/lib/supabase/hooks.ts` with the broadcast hooks**

Append to `src/lib/supabase/hooks.ts`:

```ts
import { useCallback, useRef, useState } from 'react'
import type { DrawFrame } from './types'

const STALE_MS = 5000
const THROTTLE_MS = 100

export function useDrawBroadcast(marketId: string, selfWallet: string | null): { liveDraws: Record<string, DrawFrame> } {
  const [liveDraws, setLiveDraws] = useState<Record<string, DrawFrame>>({})
  const sweepRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const supabase = getSupabase()
    const name = `path-draw:${marketId}`
    const channel = acquireChannel(supabase, name, { config: { private: true } })
    channel
      .on('broadcast', { event: 'draw_frame' }, ({ payload }: { payload: DrawFrame }) => {
        if (payload.wallet === selfWallet) return
        setLiveDraws((prev) => ({ ...prev, [payload.wallet]: payload }))
      })
      .subscribe()

    sweepRef.current = setInterval(() => {
      const cutoff = Date.now() - STALE_MS
      setLiveDraws((prev) => {
        let changed = false
        const next: Record<string, DrawFrame> = {}
        for (const [k, v] of Object.entries(prev)) {
          if (v.timestamp >= cutoff) next[k] = v
          else changed = true
        }
        return changed ? next : prev
      })
    }, 1000)

    return () => {
      if (sweepRef.current) clearInterval(sweepRef.current)
      releaseChannel(supabase, name)
    }
  }, [marketId, selfWallet])

  return { liveDraws }
}

export function usePublishDrawFrame(marketId: string, selfWallet: string | null): (frame: DrawFrame) => void {
  const lastSentRef = useRef<number>(0)
  const pendingRef  = useRef<DrawFrame | null>(null)
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback(() => {
    const frame = pendingRef.current
    pendingRef.current = null
    timerRef.current = null
    if (!frame) return
    const supabase = getSupabase()
    const name = `path-draw:${marketId}`
    const channel = acquireChannel(supabase, name, { config: { private: true } })
    void channel.send({ type: 'broadcast', event: 'draw_frame', payload: frame })
    lastSentRef.current = Date.now()
    releaseChannel(supabase, name)                            // ref-counted; release immediately after send
  }, [marketId])

  return useCallback((frame: DrawFrame) => {
    if (!selfWallet) return
    const now = Date.now()
    if (now - lastSentRef.current >= THROTTLE_MS) {
      pendingRef.current = frame
      flush()
    } else {
      pendingRef.current = frame
      if (!timerRef.current) {
        const wait = THROTTLE_MS - (now - lastSentRef.current)
        timerRef.current = setTimeout(flush, wait)
      }
    }
  }, [selfWallet, flush])
}
```

The `useEffect` import was added in Task 15 — reuse it; don't import twice.

- [ ] **Step 4: Re-run tests**

```bash
pnpm test:run src/lib/supabase/__tests__/useDrawBroadcast.test.tsx
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/hooks.ts src/lib/supabase/__tests__/useDrawBroadcast.test.tsx
git commit -m "feat(fe/supabase): useDrawBroadcast subscribe + throttled publish helper"
```

---

## Task 17: Wire `SupabaseAuthProvider` into `UIRoot`

**Files:**
- Modify: `src/ui/UIRoot.tsx`

- [ ] **Step 1: Add the import**

In `src/ui/UIRoot.tsx`, add at the top with other imports:

```ts
import { SupabaseAuthProvider } from '@/lib/supabase/provider'
```

- [ ] **Step 2: Wrap children inside `AnchorProgramProvider`**

Edit `src/ui/UIRoot.tsx` — the returned JSX changes from:
```tsx
<AnchorProgramProvider>
  <WalletSync />
  {children}
</AnchorProgramProvider>
```
to:
```tsx
<AnchorProgramProvider>
  <WalletSync />
  <SupabaseAuthProvider>
    {children}
  </SupabaseAuthProvider>
</AnchorProgramProvider>
```

The provider is mounted AFTER `WalletSync` so `useWalletStore` has up-to-date state from the first render.

- [ ] **Step 3: Run the full unit suite to confirm no regression**

```bash
pnpm test:run
```

Expected: existing tests pass; any `useWallet`-dependent tests unaffected.

- [ ] **Step 4: Start the dev server and visually confirm no crashes**

```bash
pnpm dev
```

Open `http://localhost:3030`, click "Connect Wallet", approve in the extension, then approve the sign-to-verify popup. You should see no red errors in the browser console; DevTools → Application → Local Storage should show `levx_jwt:<pubkey>`.

Stop the dev server with Ctrl-C.

- [ ] **Step 5: Commit**

```bash
git add src/ui/UIRoot.tsx
git commit -m "feat(ui): mount SupabaseAuthProvider inside UIRoot"
```

---

## Task 18: `MarketComments` component + integration into `MarketPage`

**Files:**
- Create: `src/components/MarketComments.tsx`
- Modify: `src/routes/pages/MarketPage.tsx`

- [ ] **Step 1: Create `src/components/MarketComments.tsx`**

```tsx
import { useState } from 'react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'

import { useComments, usePostComment, useSupabaseAuth } from '@/lib/supabase/hooks'
import { useWalletStore } from '@/stores/walletStore'
import { cn } from '@/lib/cn'

type Props = { marketId: string }

export function MarketComments({ marketId }: Props) {
  const connected = useWalletStore((s) => s.connected)
  const walletPubkey = useWalletStore((s) => s.publicKey)
  const wallet = walletPubkey?.toBase58() ?? null
  const { status } = useSupabaseAuth()
  const { setVisible } = useWalletModal()

  const { data: comments, isLoading, error } = useComments(marketId)
  const post = usePostComment(marketId, wallet)

  const [body, setBody] = useState('')

  const canPost = connected && status === 'authenticated' && body.trim().length > 0

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canPost) return
    post.mutate({ body: body.trim() }, { onSuccess: () => setBody('') })
  }

  return (
    <section className={cn('flex flex-col gap-4 rounded-lg border border-line p-5')}>
      <h3 className="text-body font-mono uppercase tracking-wide">Comments</h3>

      {isLoading && <p className="text-ink-muted text-caption">Loading…</p>}
      {error && <p className="text-accent text-caption">Failed to load comments.</p>}

      <ul className="flex flex-col gap-3">
        {(comments ?? []).map((c) => (
          <li key={c.id} className="rounded-md border border-line-weak p-3">
            <div className="flex justify-between text-caption text-ink-muted">
              <span className="font-mono">{c.wallet.slice(0, 4)}…{c.wallet.slice(-4)}</span>
              <span>
                {new Date(c.created_at).toLocaleString()}
                {c.edited_at && <span className="ml-2 italic">(edited)</span>}
              </span>
            </div>
            <p className="text-ink whitespace-pre-wrap">{c.body}</p>
          </li>
        ))}
        {(comments ?? []).length === 0 && !isLoading && (
          <li className="text-ink-muted text-caption">No comments yet. Be the first.</li>
        )}
      </ul>

      {!connected ? (
        <button
          type="button"
          onClick={() => setVisible(true)}
          className={cn(
            'inline-flex min-h-11 items-center justify-center rounded-full px-6 py-3',
            'border border-dashed border-line-strong text-ink-muted hover:text-ink-strong hover:border-ink',
            'text-caption font-mono font-bold uppercase tracking-wide',
          )}
        >
          Connect wallet to post
        </button>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share your take…"
            maxLength={2000}
            rows={3}
            className={cn(
              'rounded-md border border-line bg-transparent p-3',
              'text-ink focus:outline-none focus:border-ink-strong',
            )}
          />
          <div className="flex items-center justify-between">
            <span className="text-ink-muted text-caption">{body.length}/2000</span>
            <button
              type="submit"
              disabled={!canPost || post.isPending}
              className={cn(
                'inline-flex items-center justify-center rounded-full px-5 py-2',
                'bg-ink text-surface font-mono font-bold uppercase tracking-wide text-caption',
                'disabled:opacity-40 disabled:cursor-not-allowed',
              )}
            >
              {post.isPending ? 'Posting…' : 'Post'}
            </button>
          </div>
          {post.error && (
            <p className="text-accent text-caption">
              {post.error.message.startsWith('rate_limit') ? 'Slow down — wait a few seconds before posting again.'
                : post.error.message.startsWith('permission_denied') ? 'Permission denied.'
                : 'Failed to post. Try again.'}
            </p>
          )}
        </form>
      )}
    </section>
  )
}
```

> Tailwind class names assume `cn()` utility and the design tokens already in use (`text-ink`, `border-line`, etc.). Verify by grepping `src/components/Button.tsx` for matching patterns — adjust any token names if they differ in this project.

- [ ] **Step 2: Render `<MarketComments marketId={...} />` in `MarketPage.tsx`**

Open `src/routes/pages/MarketPage.tsx`. Find where the market detail body ends (the primary section content before the page's closing tag). Add:

```tsx
import { MarketComments } from '@/components/MarketComments'

// ... in the return, after the existing market detail sections:
<MarketComments marketId={market.id} />
```

If `MarketPage.tsx` is large (it likely is), place the import alphabetically with other `@/components/*` imports and the render call at the end of the inner container / grid that holds the rest of the page body.

- [ ] **Step 3: Start dev server, manually verify**

```bash
pnpm dev
```

Open a market page, confirm the comments section renders. With wallet disconnected: "Connect wallet to post" button shown. Connect + sign → form appears. Post a comment → appears instantly (optimistic or server-round-trip). Open a second browser tab → comment appears there within ~2s (realtime).

- [ ] **Step 4: Run unit tests**

```bash
pnpm test:run
```

Expected: no regressions.

- [ ] **Step 5: Commit**

```bash
git add src/components/MarketComments.tsx src/routes/pages/MarketPage.tsx
git commit -m "feat(market): comments section with realtime + edit indicator"
```

---

## Task 19: Wire path-draw broadcast into the drawing flow

**Files:**
- Modify: one of `src/components/LevXChart.tsx` or `src/components/DrawingLayer.tsx` (whichever owns the drag handlers) — find via grep

- [ ] **Step 1: Locate the drag/draw event handler**

```bash
grep -rn "pointermove\|onPointerMove\|onPointerUp\|drawingStore" src/components src/lib/drawing src/routes/pages | head -40
```

Identify the single file where a user's drag interaction updates `drawingStore` checkpoint values. Likely `src/components/DrawingLayer.tsx`.

- [ ] **Step 2: Add imports + wallet context in that file**

At the top of the chosen file (replace `DrawingLayer.tsx` below if it was a different file):

```ts
import { useDrawBroadcast, usePublishDrawFrame } from '@/lib/supabase/hooks'
import { useWalletStore } from '@/stores/walletStore'
```

Inside the component, where `marketId` is available (pass as a prop from `MarketPage` if it is not already):

```ts
const selfWallet = useWalletStore((s) => s.publicKey?.toBase58() ?? null)
const publish = usePublishDrawFrame(marketId, selfWallet)
const { liveDraws } = useDrawBroadcast(marketId, selfWallet)
```

- [ ] **Step 3: Call `publish` on drag events**

In the pointer-move handler (wherever it currently calls `drawingStore.setCheckpoint` or similar), immediately after updating local state, add:

```ts
publish({
  wallet: selfWallet!,
  points: currentPoints,                 // the array being drawn — map to { time, value }[]
  timestamp: Date.now(),
})
```

On `pointerup` (or the drawing-complete handler), send a final frame with `done: true`:

```ts
publish({ wallet: selfWallet!, points: currentPoints, timestamp: Date.now(), done: true })
```

The guard `if (!selfWallet) return` is already inside `usePublishDrawFrame`, so no-op when disconnected.

- [ ] **Step 4: Render ghost lines for `liveDraws`**

In the SVG chart overlay, after the primary path line render, map over `Object.values(liveDraws)` and render a thin, semi-transparent polyline per entry:

```tsx
{Object.values(liveDraws).map((frame) => (
  <polyline
    key={frame.wallet}
    points={frame.points.map((p) => `${xScale(p.time)},${yScale(p.value)}`).join(' ')}
    fill="none"
    stroke="currentColor"
    strokeOpacity="0.25"
    strokeWidth="1.5"
    strokeDasharray="3 3"
    pointerEvents="none"
  />
))}
```

Use the chart's existing `xScale`/`yScale` — if those names differ, match the names already in the file.

- [ ] **Step 5: Manual smoke test — two browsers**

Start `pnpm dev`. Open the same market in two browser tabs, each with a different connected wallet (or one connected, one disconnected — disconnected won't subscribe, per the private-channel policy). Drag to draw a path in tab A → tab B shows a ghost polyline updating ~10 Hz.

- [ ] **Step 6: Run tests**

```bash
pnpm test:run
```

Expected: no regressions.

- [ ] **Step 7: Commit**

```bash
git add src/components/DrawingLayer.tsx   # or whichever file was modified
git commit -m "feat(drawing): broadcast in-progress draws and render remote ghost lines"
```

---

## Task 20: `isConnected` gates on Positions + Portfolio pages

**Files:**
- Modify: `src/routes/pages/PositionsPage.tsx`
- Modify: `src/routes/pages/PortfolioPage.tsx`

- [ ] **Step 1: Read each page to understand its current layout**

Read both pages:
```bash
# Read them to see how they currently render; do not assume shape.
```
(Use the Read tool on each path.)

- [ ] **Step 2: Gate `PositionsPage` with an empty state**

At the top of the render path of `PositionsPage`, before any data-fetching hooks fire (or wrap them with `enabled: connected`), insert:

```tsx
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { useWalletStore } from '@/stores/walletStore'
import { cn } from '@/lib/cn'

// Near the top of the component body:
const connected = useWalletStore((s) => s.connected)
const { setVisible } = useWalletModal()

if (!connected) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-4 py-24')}>
      <p className="text-ink-muted">Connect your wallet to view your positions.</p>
      <button
        type="button"
        onClick={() => setVisible(true)}
        className={cn(
          'inline-flex items-center justify-center rounded-full px-6 py-3',
          'bg-ink text-surface font-mono font-bold uppercase tracking-wide text-caption',
        )}
      >
        Connect Wallet
      </button>
    </div>
  )
}
```

Place this gate BEFORE any `useUserPosition` / `useUserPositions` call so the hook is only invoked when there's a wallet. If that causes conditional-hook-call lint errors, instead leave the hook where it is and pass `enabled: connected` to its query.

- [ ] **Step 3: Repeat for `PortfolioPage`**

Same structure with copy "Connect your wallet to view your portfolio."

- [ ] **Step 4: Run dev server, click both pages with wallet disconnected**

```bash
pnpm dev
```

Navigate to `/positions` and `/portfolio` without connecting a wallet → each shows the empty state + "Connect Wallet" button. Click the button → wallet modal opens. Connect → pages hydrate with data.

- [ ] **Step 5: Run tests**

```bash
pnpm test:run
```

Expected: any page tests for PositionsPage / PortfolioPage may need updating for the new gated empty state. If existing tests rely on connected state, add a setup step that pre-sets `useWalletStore.setState({ connected: true, publicKey: ... })` — look at `src/stores/__tests__/walletStore.test.ts` for the pattern. Fix any failures before committing.

- [ ] **Step 6: Commit**

```bash
git add src/routes/pages/PositionsPage.tsx src/routes/pages/PortfolioPage.tsx src/routes/pages/__tests__/
git commit -m "feat(pages): gate positions and portfolio behind wallet connection"
```

---

## Task 21: CI scripts + `supabase/README.md`

**Files:**
- Modify: `package.json`
- Create: `supabase/README.md`

- [ ] **Step 1: Finalize test scripts in `package.json`**

Ensure the `scripts` block includes (merge with existing, don't clobber):

```json
"test:run":    "vitest run",
"test:rls":    "vitest run --config vitest.rls.config.ts",
"test:edge":   "cd supabase/functions/verify-wallet && deno test --allow-env --allow-net",
"test:all":    "pnpm test:run && pnpm test:rls && pnpm test:edge"
```

- [ ] **Step 2: Create `supabase/README.md`**

```markdown
# LevX Supabase

Off-chain layer: comments, path-draw broadcasts, wallet-based auth.
See `docs/superpowers/specs/2026-04-17-supabase-fe-integration-design.md` for the full design.

## Local development

```bash
supabase start               # Postgres + Realtime + Edge Runtime on localhost
supabase db reset            # apply migrations from scratch
supabase functions serve verify-wallet --env-file .env.functions.local
```

FE points at `http://127.0.0.1:54321` via `.env.local`.

## Tests

```bash
pnpm test:run    # FE unit + hook tests
pnpm test:rls    # RLS tests (needs `supabase start` running)
pnpm test:edge   # Edge Function tests (needs `supabase functions serve` running)
pnpm test:all    # everything
```

## Deploying to a hosted Supabase project

```bash
supabase link --project-ref <your-ref>
supabase db push
supabase functions deploy verify-wallet
supabase secrets set APP_ORIGIN=https://levx.app
```

`SUPABASE_JWT_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by the hosted runtime. Do NOT set them manually.

## Manual smoke checklist (pre-release)

1. Connect wallet → sign → comment posts → appears in a second browser tab in <2s.
2. Disconnect (extension) → reconnect → sign prompt re-appears.
3. Switch wallets in extension → ghost path from old wallet stops; new wallet's appears.
4. Wait 24h on a stale tab → comment fails → "Re-authenticate" toast → succeeds.
5. Two browsers in same market → drag a path → second browser sees ghost line.
6. Hammer comment button 5× → first succeeds, next four show cooldown toast.
```

- [ ] **Step 3: Run `pnpm test:all` end-to-end**

With `supabase start` and `supabase functions serve verify-wallet` both running:

```bash
pnpm test:all
```

Expected: FE tests + RLS tests + Edge tests all green.

- [ ] **Step 4: Commit**

```bash
git add package.json supabase/README.md
git commit -m "chore(supabase): CI test scripts and dev README"
```

---

## Self-Review Checklist (completed)

**Spec coverage:**
- §2 Scope: every in-scope item has at least one task. ✓
- §3 Architecture: `client.ts` (Task 10), `auth.ts` (Tasks 11-12), provider (Task 14). ✓
- §4 Module Layout: all files referenced in tasks. ✓
- §5 Data Flow: cold (Task 14 tests), warm (Task 14 tests), symmetric disconnect (Task 14), post comment (Task 15), realtime subscribe (Task 15), publish frame (Task 16), subscribe broadcast (Task 16), expiry (covered by `getActiveJWT` margin in Task 11; re-auth UX in Task 18 error mapping). ✓
- §6 Schema/RLS/triggers: Task 2 writes them; Tasks 4-5 test them. ✓
- §7 Edge Function: Tasks 6-8. ✓
- §8 Testing Tiers 1-4: Tier 1 (Tasks 11, 13), Tier 2 (Tasks 14-16), Tier 3 (Tasks 7-8), Tier 4 (Tasks 4-5), Tier 5 (Task 21 README), Tier 6 (Task 21 README). ✓

**Placeholder scan:** No TBDs, TODOs, or "implement later" hedges. A couple of "find the file via grep" instructions in Task 19 where the exact file depends on current code — this is deliberate, not a placeholder.

**Type consistency:** `Comment`, `JWTRecord`, `DrawFrame`, `AuthStatus` are all defined once in `types.ts` (Task 10) and reused downstream. `acquireChannel` / `releaseChannel` names match between tests and implementation. `__setActiveWallet` test hook name matches between auth test and impl.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-17-supabase-fe-integration.md`.
