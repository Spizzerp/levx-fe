# Supabase FE Integration — Design

**Date:** 2026-04-17
**Status:** Approved (awaiting implementation plan)
**Scope:** FE-side Supabase integration + Supabase project (schema, RLS, Edge Function). Railway services (Pipeline, Keeper) deferred to a separate spec.

---

## 1. Overview

Phase 3 of the LevX rollout introduces Supabase as an off-chain layer providing three capabilities the chain and Pyth do not:

1. **Comments** — Postgres table with realtime subscriptions; users post per-market comments visible to everyone.
2. **Realtime path-draw broadcast** — ephemeral ghost-line preview of one user's path-draw to other connected viewers of the same market. No persistence.
3. **Wallet-based auth** — Solana wallet signs a server-issued nonce; a Supabase Edge Function verifies the signature and issues a JWT with a `wallet` claim. RLS uses `auth.jwt() ->> 'wallet'` for row-level enforcement.

All money flow, market state, paths, scoring, and settlement remain on-chain. Losing Supabase availability does not affect funds or protocol correctness — chain reads, market discovery, market detail, and wager flows continue working in fail-open mode.

This spec covers the FE integration in `levx-fe` plus the Supabase project (`supabase/` directory at repo root, managed by Supabase CLI). It does not cover the Railway-hosted Pipeline (FastAPI + GPU) or Keeper (Node.js) services — those write directly to chain and are independent of FE code.

---

## 2. Scope

**In scope:**
- `src/lib/supabase/` FE module: client, auth, provider, hooks, channels, types
- `<SupabaseAuthProvider>` integration in `src/main.tsx`
- New `MarketComments` sub-component on `MarketPage`
- Path-draw broadcast wiring in the existing drawing component (`src/lib/drawing/`)
- `isConnected` gating on Positions, Portfolio pages and the wager button
- `supabase/` directory: migrations (comments, auth_nonces, comment_rate_limit, RLS policies, rate-limit trigger, immutable-column trigger, Realtime Authorization policies), `verify-wallet` Edge Function, `config.toml`
- Env var additions: `APP_SUPABASE_URL`, `APP_SUPABASE_ANON_KEY`
- Test suite: Tier 1 unit, Tier 2 hooks, Tier 3 Edge Function, Tier 4 RLS

**Out of scope (separate spec(s)):**
- Pipeline service (Python FastAPI, RunPod GPU, AI path generation)
- Keeper service (Node.js settlement bot)
- Railway deploys
- User profiles, avatars, follows, notifications
- Comment threading, reactions
- Edit history visible to others
- Playwright end-to-end automation (deferred to post-MVP)

---

## 3. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         levx-fe (Vite/React)                     │
│                                                                  │
│   Wallet Adapter ──► SupabaseAuthProvider ──► useSupabaseAuth() │
│                              │                                   │
│                              ▼                                   │
│                  src/lib/supabase/{client,auth,hooks,channels}   │
│                              │                                   │
│              ┌───────────────┼───────────────────┐               │
│              ▼               ▼                   ▼               │
│        useComments()   useDrawBroadcast()   verify-wallet RPC    │
└──────────────┬───────────────┬───────────────────┬───────────────┘
               │               │                   │
               ▼               ▼                   ▼
       supabase-js (REST/Postgrest)    supabase-js Realtime    Edge Function
               │                              │                   │
               ▼                              ▼                   ▼
   ┌───────────────────────┐    ┌───────────────────────┐    ┌─────────┐
   │  comments table (RLS) │    │  Realtime Broadcast   │    │ verify- │
   │  auth_nonces table    │    │  channel per market   │    │ wallet  │
   └───────────────────────┘    └───────────────────────┘    └─────────┘
                          Supabase Project (managed)
```

**Three logical surfaces:**

1. **Auth flow.** Wallet connects → provider checks cached JWT → if missing/expired, calls Edge Function (`POST /nonce` → wallet signs returned message → `POST /verify`) → caches JWT in `localStorage` (24h TTL) → exposes auth state via React context.
2. **Comments (persistent).** Postgres table; reads public via anon role; writes gated by RLS matching `auth.jwt() ->> 'wallet'`. Realtime via Postgres CDC subscribes to inserts on `comments` filtered by `market_id`.
3. **Path-draw broadcast (ephemeral).** Supabase Realtime Broadcast channels (no DB), one channel per `market_id`. Subscribe and publish both require auth (private channels) — consistent with the rest of the gating model.

**Boundary discipline:**
- supabase-js is a singleton in `client.ts`. The JWT is supplied via the `accessToken` async callback (current Supabase recommendation; replaces the deprecated `setSession` pattern for external JWTs). The provider manages cache state; the client reads the cache via the callback on every request — no need to push sessions onto the client.
- All Supabase code lives under `src/lib/supabase/`. No other file in `src/` imports `@supabase/supabase-js` directly. Components consume hooks only.
- `supabase/` directory is owned by the Supabase CLI; deploys independently of the FE build.
- Auth provider fails open: Supabase project down or network error → `status='error'`, comments/broadcast unavailable, but markets/positions/wager flows continue to work via on-chain reads.

---

## 4. Module Layout

### FE: `src/lib/supabase/`

```
src/lib/supabase/
├── client.ts              singleton supabase-js; createClient with accessToken callback
├── auth.ts                pure: requestNonce, verifyAndGetJWT, cache CRUD, getActiveJWT
├── provider.tsx           <SupabaseAuthProvider>: wires wallet→auth→cache
├── hooks.ts               useSupabaseAuth, useComments, usePostComment,
│                          useDrawBroadcast, usePublishDrawFrame
├── channels.ts            internal: realtime channel get/cleanup, ref-counted
├── types.ts               Comment, DrawFramePayload, JWTRecord
└── __tests__/             unit + hook tests (mocked supabase-js)
```

### Supabase project: `supabase/` (repo root)

```
supabase/
├── config.toml                      Supabase CLI config (project ref, ports)
├── migrations/
│   └── 0001_init.sql                schema, RLS, indexes, triggers
├── functions/
│   └── verify-wallet/
│       ├── index.ts                 Deno: nonce + verify endpoints, JWT signing
│       ├── deno.json                pinned imports (tweetnacl, bs58, djwt)
│       └── _shared/cors.ts
├── tests/
│   └── rls.test.ts                  Vitest RLS tests against local supabase start
├── seed.sql                         (optional, dev fixtures)
└── README.md                        local dev workflow
```

### App wiring (one-time)

- **`src/main.tsx`**: wrap app `<WalletProvider><SupabaseAuthProvider>{children}</SupabaseAuthProvider></WalletProvider>` (provider must be inside wallet context to subscribe to its state).
- **`src/env/env.config.ts`**: add `APP_SUPABASE_URL`, `APP_SUPABASE_ANON_KEY` (required at runtime; missing values fail the auth provider gracefully — chain features still work).
- **`.env.example`**: uncomment Supabase vars; remove the "Phase 3" comment.

### UI integration points

| Surface | Hook | Gating |
|---|---|---|
| `MarketPage` comments section (new `MarketComments` sub-component) | `useComments`, `usePostComment` | Reads public; post requires `isConnected` |
| Path drawing (in `src/lib/drawing/`) | `usePublishDrawFrame`, `useDrawBroadcast` | Subscribe + publish require `isConnected` |
| `PositionsPage`, `PortfolioPage` | none (Supabase) | `isConnected` gate, empty state otherwise |
| `MarketPage` wager button | none (Supabase) | `isConnected` gate, label flips to "Connect Wallet" |

### Dependencies to add

- FE: `@supabase/supabase-js`
- Edge Function (Deno, declared in import map): `tweetnacl`, `bs58`, `djwt`

### Hook signatures

```ts
useSupabaseAuth(): {
  status: 'idle' | 'pending' | 'authenticated' | 'error'
  jwt: string | null
  wallet: string | null     // base58 pubkey, mirrors wallet adapter
  expiresAt: number | null
  authenticate(): Promise<void>   // manual retry
  signOut(): void                 // clears cache + in-memory state
}

useComments(marketId): UseQueryResult<Comment[]>
usePostComment(marketId): UseMutationResult<Comment, Error, { body: string }>

useDrawBroadcast(marketId): { liveDraws: Record<string /*wallet*/, DrawFrame> }
usePublishDrawFrame(marketId): (frame: DrawFrame) => void  // throttled to ~10 Hz
```

---

## 5. Data Flow

### 5.1 Auth — cold start (no cached JWT or expired)

```
User           Wallet Adapter      Provider              Edge Fn          Supabase DB
 │ click "Connect"  │                  │                    │                 │
 │─────────────────▶│ wallet popup     │                    │                 │
 │ approves         │                  │                    │                 │
 │                  │── publicKey ────▶│                    │                 │
 │                  │                  │ check cache: miss  │                 │
 │                  │                  │ status='pending'   │                 │
 │                  │                  │── POST /nonce ────▶│                 │
 │                  │                  │                    │── INSERT ──────▶│
 │                  │                  │◀── {nonce,         │                 │
 │                  │                  │     message} ──────│                 │
 │                  │ signMessage popup│                    │                 │
 │ approves         │                  │                    │                 │
 │                  │── signature ────▶│                    │                 │
 │                  │                  │── POST /verify ───▶│                 │
 │                  │                  │                    │ atomic DELETE   │
 │                  │                  │                    │ where exp>now ─▶│
 │                  │                  │   verify ed25519   │                 │
 │                  │                  │   sign JWT         │                 │
 │                  │                  │◀── {jwt, exp} ─────│                 │
 │                  │                  │ cache to localStorage                │
 │                  │                  │ status='authenticated'               │
```

**Failure modes:**
- User rejects sig → `status='error'`, expose `authenticate()` retry.
- Nonce expired → request new nonce + retry once, then error.
- Edge Function 5xx → toast + retry button. Chain reads keep working.

### 5.2 Auth — warm start (cached JWT valid)

```
Wallet Adapter ── publicKey ──▶ Provider
                                 │ check localStorage[levx_jwt:{pubkey}]
                                 │ exp > now + 60s → restore
                                 │ status='authenticated' (no popup)
```

The 60s margin avoids handing out a JWT that expires mid-flight.

### 5.3 Wallet change / disconnect (symmetric purge)

| Trigger | Cache action | State |
|---|---|---|
| Adapter `disconnect` (extension or programmatic) | **purge** `localStorage[levx_jwt:{pubkey}]` | clear in-memory JWT, `status='idle'` |
| Adapter `publicKey` change (wallet switch) | **purge old wallet's cache**, check new wallet's cache | restore-or-prompt for new pubkey |
| Site "Disconnect" button | purge cache | `status='idle'`, then `adapter.disconnect()` |

Every reconnect = one sign-popup. The 24h cache only spans page reloads / SPA navigations within an active session, not disconnect cycles.

### 5.4 Post comment (mutation w/ optimistic update)

```
User         usePostComment       TanStack Query    supabase-js     Postgres
 │ submit body    │                    │                 │              │
 │───────────────▶│ optimistic prepend │                 │              │
 │                │───────────────────▶│ {id:'temp', …}  │              │
 │                │                    │                 │              │
 │                │ accessToken() → JWT                  │              │
 │                │── from('comments').insert ──────────▶│              │
 │                │                    │                 │── RLS check ▶│
 │                │                    │                 │   rate-limit │
 │                │                    │                 │   trigger    │
 │                │                    │                 │◀─ {row} ─────│
 │                │◀────────── new row ─────────────────│              │
 │                │ replace temp w/ real (match by client request id)
 │                │ on RLS reject / rate-limit: revert + toast          │
```

Realtime echo: the realtime subscription (5.5) also fires an INSERT for the same row. Dedupe by `id` — if it's already in the cache, skip.

### 5.5 Comments realtime subscribe

```
useComments(mid) mounts
  ├─ TanStack Query: GET /rest/v1/comments?market_id=eq.{mid}&order=created_at.desc&limit=50
  └─ channels.getCommentsChannel(mid):
       supabase.channel(`comments:${mid}`)
         .on('postgres_changes', {
           event: 'INSERT', schema: 'public', table: 'comments',
           filter: `market_id=eq.${mid}`
         }, (payload) => prependToCache(payload.new))
         .subscribe()

useComments(mid) unmounts
  └─ ref count -= 1 → if 0, supabase.removeChannel(channel)
```

Multiple comment widgets on the same market reuse one socket. Pagination ("load older") is a manual fetch — out of MVP scope but the `limit(50)` + offset is in the schema-friendly query.

### 5.6 Publish path-draw frame

```
User drags        usePublishDrawFrame                  Realtime
on chart          (throttled 10 Hz, leading+trailing)
 │ pointermove ────▶│
 │ pointermove ────▶│ throttle gate
 │ pointermove ────▶│
                    │ ── channel.send({              ──▶ realtime.messages
                    │      type:'broadcast',              RLS: authenticated only
                    │      event:'draw_frame',            INSERT WITH CHECK true
                    │      payload:{wallet, points,
                    │               timestamp}
                    │    })
 │ pointerup ──────▶│ flush trailing frame + final {points, done:true}
```

### 5.7 Subscribe to path-draw broadcasts

```
useDrawBroadcast(mid) mounts
  └─ channels.getBroadcastChannel(mid):
       supabase.channel(`path-draw:${mid}`, { config: { private: true } })
         .on('broadcast', { event: 'draw_frame' }, ({payload}) => {
           // last frame per wallet wins; auto-expire at 5s of no updates
           setLiveDraws(prev => ({ ...prev, [payload.wallet]: payload }))
         })
         .subscribe()

  Returns: { liveDraws: Record<wallet, DrawFrame> }
  Excludes own wallet (we don't render our own draw as a ghost)
```

**Security note:** path-draw channel is **private** — must be authenticated to subscribe AND publish. Unconnected users don't see ghost paths. The payload `wallet` is FE-supplied and not cryptographically bound to the JWT in transit; we accept that authenticated users could publish a payload tagged with someone else's wallet. Ephemeral, visual-only, no money — acceptable. If this ever becomes a real concern, we add a server-side gateway.

### 5.8 JWT expiry mid-session

```
supabase-js calls accessToken() ─▶ getActiveJWT() ─▶ exp < now → return null
   ▼
Request fires without Authorization header
   ▼
RLS rejects (e.g., comment INSERT fails)
   ▼
Hook surfaces { error: AuthExpiredError }
   ▼
UI catches → toast "Session expired" + button "Re-authenticate"
   ▼
Button → useSupabaseAuth().authenticate() → re-runs §5.1
```

We deliberately do NOT auto-refresh because `signMessage` requires a user gesture (browsers reject programmatic popups). Re-prompt is explicit.

---

## 6. Schema, RLS, and Rate Limiting

Single migration: `supabase/migrations/0001_init.sql`.

### 6.1 Tables

```sql
create extension if not exists "pgcrypto";

-- Single-use nonces issued by verify-wallet/nonce, consumed by /verify. 5-min TTL.
create table public.auth_nonces (
  nonce       text        primary key,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
create index auth_nonces_expires_at_idx on public.auth_nonces (expires_at);

create table public.comments (
  id          uuid        primary key default gen_random_uuid(),
  market_id   text        not null,
  wallet      text        not null,
  body        text        not null check (length(body) between 1 and 2000),
  created_at  timestamptz not null default now(),
  edited_at   timestamptz                                       -- null = never edited
);
create index comments_market_id_created_at_idx
  on public.comments (market_id, created_at desc);
create index comments_wallet_idx
  on public.comments (wallet);

-- One row per wallet — last_comment_at for the cooldown check.
create table public.comment_rate_limit (
  wallet           text        primary key,
  last_comment_at  timestamptz not null
);
```

### 6.2 RLS — `auth_nonces`

```sql
alter table public.auth_nonces enable row level security;
-- No policies → all client access denied. Only service-role (Edge Function) reaches it.
```

### 6.3 RLS — `comments`

```sql
alter table public.comments enable row level security;

-- Public read.
create policy "comments select public"
  on public.comments for select
  to anon, authenticated
  using (true);

-- Insert: must be authenticated, wallet claim must match the row.
create policy "comments insert own wallet"
  on public.comments for insert
  to authenticated
  with check ( (auth.jwt() ->> 'wallet') = wallet );

-- Update: own only. Trigger (6.5) locks immutable columns.
create policy "comments update own"
  on public.comments for update
  to authenticated
  using      ( (auth.jwt() ->> 'wallet') = wallet )
  with check ( (auth.jwt() ->> 'wallet') = wallet );

-- Delete own only.
create policy "comments delete own"
  on public.comments for delete
  to authenticated
  using ( (auth.jwt() ->> 'wallet') = wallet );
```

### 6.4 Rate limit — Postgres trigger (option B from brainstorm)

Per-wallet limits: **1 comment per 10s**, **30 per hour**. Tunable via constants at the top of the function.

```sql
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
```

The FE catches `P0001` (with hint substring matching) and surfaces user-friendly toasts.

### 6.5 Immutable-column trigger (edits)

```sql
create or replace function public.lock_comment_immutables()
returns trigger language plpgsql as $$
begin
  if new.id         is distinct from old.id
  or new.market_id  is distinct from old.market_id
  or new.wallet     is distinct from old.wallet
  or new.created_at is distinct from old.created_at then
    raise exception 'immutable_column_modified' using errcode = '42501';
  end if;
  new.edited_at := now();   -- server-stamped, ignore client value
  return new;
end;
$$;

create trigger comments_lock_immutables
  before update on public.comments
  for each row execute function public.lock_comment_immutables();
```

Edits are unbounded (no time window), no rate limit. UI shows "(edited)" suffix when `edited_at IS NOT NULL`.

### 6.6 Realtime Authorization — `realtime.messages`

Per Supabase docs, RLS on `realtime.messages` controls private-channel access. Topic patterns:
- `comments:{marketId}` — postgres_changes (covered by table RLS)
- `path-draw:{marketId}` — broadcast, needs explicit policies

```sql
create policy "path-draw subscribe authenticated"
  on realtime.messages for select
  to authenticated
  using ( (select realtime.topic()) like 'path-draw:%' );

create policy "path-draw publish authenticated"
  on realtime.messages for insert
  to authenticated
  with check ( (select realtime.topic()) like 'path-draw:%' );
```

No anon policies → anon clients can't subscribe to or publish on path-draw channels.

### 6.7 Nonce cleanup

Opportunistic cleanup inside the `POST /nonce` Edge Function (no `pg_cron` dependency):
```sql
delete from public.auth_nonces where expires_at < now();
```
Runs at most once per nonce request.

### 6.8 Indexes — sanity check

- `comments (market_id, created_at desc)` — primary list query
- `comments (wallet)` — per-wallet hourly count in rate-limit trigger
- `auth_nonces (expires_at)` — cleanup sweeps
- `auth_nonces` PK on `nonce` — verify lookup

No N+1 patterns or full table scans on hot paths.

---

## 7. Edge Function: `verify-wallet`

Single Deno function with two routes, deployed via `supabase functions deploy verify-wallet`.

### 7.1 Files

```
supabase/functions/verify-wallet/
├── index.ts          router + handlers
├── deno.json         pinned imports (tweetnacl, bs58, djwt)
└── _shared/
    └── cors.ts       CORS headers (allow APP_ORIGIN env var)
```

### 7.2 Request/response shapes

**`POST /functions/v1/verify-wallet/nonce`**
```jsonc
// Request: empty body
// Response 200:
{
  "nonce":     "ZGVhZGJlZWY...",
  "message":   "Sign to verify ownership of your wallet for LevX.\n\nNonce: ZGVhZGJlZWY...\n\nThis is not a transaction and will not move funds.",
  "expiresAt": "2026-04-17T18:23:00Z"
}
```

The Edge Function returns the full signable `message` string. The FE signs it verbatim — no client-side template construction, no risk of FE/server template drift.

**`POST /functions/v1/verify-wallet/verify`**
```jsonc
// Request:
{ "pubkey": "9xQe...", "nonce": "ZGVhZGJlZWY...", "signature": "<base58 sig>" }
// Response 200:
{ "jwt": "eyJ...", "expiresAt": "2026-04-18T17:18:00Z" }
// Response 4xx:
{ "error": "invalid_signature" | "nonce_used_or_expired" | "malformed" }
```

### 7.3 Implementation outline (~80 LOC, Deno)

```ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4"
import * as nacl from "https://esm.sh/tweetnacl@1.0.3"
import bs58 from "https://esm.sh/bs58@5.0.0"
import { create as signJWT, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts"
import { corsHeaders } from "./_shared/cors.ts"

const SUPABASE_URL              = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const SUPABASE_JWT_SECRET       = Deno.env.get("SUPABASE_JWT_SECRET")!  // HS256
const NONCE_TTL_SECONDS         = 5 * 60
const JWT_TTL_SECONDS           = 24 * 60 * 60

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

const jwtKey = await crypto.subtle.importKey(
  "raw", new TextEncoder().encode(SUPABASE_JWT_SECRET),
  { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]
)

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders })
  const url = new URL(req.url)
  try {
    if (url.pathname.endsWith("/nonce"))  return await handleNonce()
    if (url.pathname.endsWith("/verify")) return await handleVerify(req)
    return json({ error: "not_found" }, 404)
  } catch (e) {
    console.error(e)
    return json({ error: "internal" }, 500)
  }
})

async function handleNonce() {
  // Opportunistic cleanup.
  await admin.from("auth_nonces").delete().lt("expires_at", new Date().toISOString())

  const nonce = bs58.encode(crypto.getRandomValues(new Uint8Array(32)))
  const expiresAt = new Date(Date.now() + NONCE_TTL_SECONDS * 1000).toISOString()
  const { error } = await admin.from("auth_nonces").insert({ nonce, expires_at: expiresAt })
  if (error) throw error

  return json({ nonce, message: buildMessage(nonce), expiresAt })
}

async function handleVerify(req: Request) {
  const { pubkey, nonce, signature } = await req.json()
  if (typeof pubkey !== "string" || typeof nonce !== "string" || typeof signature !== "string") {
    return json({ error: "malformed" }, 400)
  }

  // Atomic single-query consume — eliminates the select+delete race.
  const { data: deleted, error: delErr } = await admin
    .from("auth_nonces").delete().eq("nonce", nonce)
    .gt("expires_at", new Date().toISOString())
    .select("nonce").maybeSingle()
  if (delErr || !deleted) return json({ error: "nonce_used_or_expired" }, 400)

  const messageBytes = new TextEncoder().encode(buildMessage(nonce))
  const sigBytes     = bs58.decode(signature)
  const pubkeyBytes  = bs58.decode(pubkey)

  if (sigBytes.length !== 64 || pubkeyBytes.length !== 32) {
    return json({ error: "malformed" }, 400)
  }

  const ok = nacl.sign.detached.verify(messageBytes, sigBytes, pubkeyBytes)
  if (!ok) return json({ error: "invalid_signature" }, 401)

  const jwt = await signJWT(
    { alg: "HS256", typ: "JWT" },
    {
      iss:    "supabase",
      sub:    pubkey,
      role:   "authenticated",
      aud:    "authenticated",
      wallet: pubkey,                    // custom claim used by RLS
      iat:    getNumericDate(0),
      exp:    getNumericDate(JWT_TTL_SECONDS),
    },
    jwtKey
  )
  const expiresAt = new Date(Date.now() + JWT_TTL_SECONDS * 1000).toISOString()
  return json({ jwt, expiresAt })
}

function buildMessage(nonce: string): string {
  return `Sign to verify ownership of your wallet for LevX.\n\nNonce: ${nonce}\n\nThis is not a transaction and will not move funds.`
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  })
}
```

### 7.4 `_shared/cors.ts`

```ts
const ORIGIN = Deno.env.get("APP_ORIGIN") ?? "*"  // set per environment
export const corsHeaders = {
  "Access-Control-Allow-Origin":  ORIGIN,
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
```

Production: `supabase secrets set APP_ORIGIN=https://levx.app`. Never `*` in prod.

### 7.5 Required secrets (set via `supabase secrets set`, never in repo)

| Var | Purpose | Where set |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | admin client for nonce CRUD | auto-injected by Supabase runtime |
| `SUPABASE_JWT_SECRET` | sign issued JWTs | `supabase secrets set --env-file .env.functions` |
| `APP_ORIGIN` | CORS allowlist | same |

### 7.6 Critical correctness invariants

1. **`buildMessage()` is the canonical signed payload.** It lives only in the Edge Function and is returned to the FE in `/nonce`. The FE never constructs it.
2. **Nonce consumption is atomic** via a single `delete ... where exp > now() returning` query. No double-spend race.
3. **`role` and `aud` claims must be `authenticated`.** Supabase routes RLS based on these.
4. **Reject signatures of wrong length.** Defends against version drift in `nacl.sign.detached.verify`.

---

## 8. Testing

Six tiers (Tier 5 manual, Tier 6 dev-only). Coverage target: every flow from §5 has at least one test that exercises it.

### 8.1 Tier 1 — Unit tests (Vitest)

`src/lib/supabase/__tests__/`

| File | Covers |
|---|---|
| `auth.test.ts` | Cache CRUD per pubkey; expiry math (60s margin); cache purge on wallet change/disconnect; cache-key isolation across pubkeys |
| `channels.test.ts` | Ref counting: 3 mounts → 1 socket; partial unmount → still 1; final unmount → `removeChannel`; race-safe under rapid mount/unmount |
| `throttle.test.ts` | `usePublishDrawFrame` throttle behavior: leading + trailing edges, mid-burst coalescing, final `pointerup` flush |

### 8.2 Tier 2 — Hook tests (Vitest + RTL, mocked supabase-js)

`src/lib/supabase/__mocks__/supabase-js.ts` — manual mock matching the surface we use (`from`, `channel`, `accessToken`).

| Test | Asserts |
|---|---|
| `useSupabaseAuth — cold path` | wallet connect → `pending` → mock Edge Fn returns JWT → `authenticated`; cache populated |
| `useSupabaseAuth — warm path` | valid cached JWT on mount → restored silently, `authenticated`, no fetch |
| `useSupabaseAuth — expired cache` | expired JWT in cache → cleared, falls through to cold path |
| `useSupabaseAuth — user rejects sig` | `signMessage` throws → `error` state, `authenticate()` retries |
| `useSupabaseAuth — wallet change` | adapter pubkey changes → old cache purged, new wallet runs warm/cold |
| `useComments — fetch + realtime echo dedupe` | TanStack Query data + simulated realtime INSERT for same id → cache has one row |
| `usePostComment — optimistic + revert on RLS error` | mock returns `42501` → optimistic row removed, error toast |
| `usePostComment — rate limit error mapping` | mock returns `P0001` with rate-limit hint → friendly toast text |
| `useDrawBroadcast — last-frame-per-wallet` | three frames from wallet A → only latest in `liveDraws['A']`; own wallet excluded |
| `useDrawBroadcast — stale expiry` | no updates from wallet A for 5s → `liveDraws['A']` removed |

### 8.3 Tier 3 — Edge Function tests (Deno test runner)

`supabase/functions/verify-wallet/index.test.ts`, run via `deno test --allow-env --allow-net`:

```
nonce: returns format
verify: rejects malformed body
verify: rejects unknown nonce
verify: rejects expired nonce
verify: rejects bad signature
verify: rejects double-spend (race) — two parallel verifies, exactly one wins
verify: returns valid JWT for good sig
verify: JWT contains role/aud/wallet
```

Fixtures: a fixed test keypair (committed, labeled `TEST_ONLY`); a sign helper producing real ed25519 sigs over the message; test JWT secret in env.

### 8.4 Tier 4 — RLS / DB tests (Vitest hitting local `supabase start`)

`supabase/tests/rls.test.ts`. Two clients: anon and a fake-authenticated client (manually-signed JWT with a test wallet claim).

| Test | Expected |
|---|---|
| anon insert into `comments` | rejected by RLS |
| auth'd insert with wallet claim ≠ row's wallet | rejected by RLS |
| auth'd insert with matching wallet | accepted |
| auth'd insert violating 10s cooldown | `P0001 rate_limit_cooldown` |
| auth'd insert at hourly cap (seed 30 prior rows) | `P0001 rate_limit_hourly` |
| anon select `comments` | returns all rows |
| auth'd update changing `wallet` | `42501 immutable_column_modified` |
| auth'd update changing `body` only | accepted, `edited_at` set, `created_at` unchanged |
| auth'd delete others' comment | 0 rows affected |
| auth'd delete own comment | 1 row affected |
| anon subscribe to `path-draw:1` | denied (Realtime RLS) |
| auth'd subscribe + publish to `path-draw:1` | allowed |

Highest-value tests in the suite — RLS bugs are silent security failures.

### 8.5 Tier 5 — Manual smoke checklist (in `supabase/README.md`)

1. Connect wallet → sign → comment posts → appears in second browser tab in <2s.
2. Disconnect (extension) → reconnect → sign prompt re-appears.
3. Switch wallets in extension → ghost path from old wallet stops, new wallet's appears.
4. Wait 24h on a stale tab → comment fails → "Re-authenticate" toast → succeeds.
5. Two browsers in same market → drag a path → second browser sees ghost line.
6. Hammer comment button 5x → first succeeds, next 4 show cooldown toast.

### 8.6 Tier 6 — Local dev workflow (`supabase/README.md`)

```
supabase start           # Postgres + Realtime + Edge Functions on localhost
supabase db reset        # apply migrations from scratch
supabase functions serve verify-wallet --env-file .env.functions.local
```

FE points at `http://127.0.0.1:54321` via `.env.local`. Edge Function gets a local JWT secret from `.env.functions.local` (gitignored).

### 8.7 CI integration

Add to `package.json`:
```jsonc
"test:rls":   "vitest run supabase/tests",
"test:edge":  "cd supabase/functions/verify-wallet && deno test --allow-env --allow-net",
"test:all":   "pnpm test:run && pnpm test:rls && pnpm test:edge"
```

GitHub Actions: matrix jobs for FE tests (existing), RLS tests (start supabase, run), Edge tests (deno setup, run). RLS + Edge run on PR + main, not pre-commit.

### 8.8 What is not tested

- Real Solana wallet integration (mocked at adapter boundary; covered manually).
- Real Supabase JWT secret behavior (uses test secret in CI; trust Supabase's own validation in prod).
- Network partition / regional failover.
- End-to-end Playwright (deferred to post-MVP; revisit once flows stabilize).

---

## 9. Security Summary

| Surface | Protection | Acknowledged limit |
|---|---|---|
| Auth replay | server-issued single-use nonces, 5-min TTL, atomic consume | none |
| Phishing message | explicit human-readable text in wallet popup; "not a transaction" disclaimer | user must read it |
| JWT forgery | HS256 with `SUPABASE_JWT_SECRET` known only to Edge Fn + Supabase | none |
| JWT theft via XSS | strict CSP, no untrusted HTML, no `eval` | localStorage is exfiltratable; mitigated by 24h TTL and "no funds at stake" — wager always re-prompts wallet |
| Spoofed comment wallet | RLS `INSERT WITH CHECK (auth.jwt() ->> 'wallet' = wallet)` | none |
| Comment spam | per-wallet 10s cooldown + 30/hr cap (Postgres trigger) | none |
| Edited comment tampering | immutable-column trigger; `edited_at` server-stamped | none |
| Spoofed broadcast wallet | private channel requires auth to publish | payload `wallet` is FE-supplied; authenticated user could publish as another wallet — accepted (ephemeral, visual, no money) |
| Service role / JWT secret leak | never in FE, never in repo, only in Supabase secrets | follow secrets discipline |
| CORS abuse | `APP_ORIGIN` allowlist in production (no `*`) | none |

---

## 10. Open questions / known limitations

- **Multi-region Supabase failover** not addressed; assumed single-region for MVP.
- **Comment moderation** (delete by admin, soft-delete, profanity filter) not in scope. Add post-MVP if needed.
- **Notifications** (email/push when someone replies) not in scope.
- **Search** of comments not indexed for full-text. Add if needed.
- **Backups** — relying on Supabase's daily backups for MVP. Revisit if comment volume justifies more.
- **Rate-limit values** (10s cooldown, 30/hr cap) chosen by judgment, not data. Tune based on observed usage.
- **JWT TTL** of 24h chosen as a balance between UX (fewer prompts) and revocation latency (theft window). Tighten to 8h if real abuse appears.

---

## 11. Out-of-scope follow-up specs

- **Pipeline service** (Python FastAPI + RunPod GPU + AI path generation, Railway deploy).
- **Keeper service** (Node.js settlement bot, polling-loop wrapper, Railway deploy).
- **`levx-backend` repo** scaffolding (when pipeline + keeper grow large enough to warrant moving Supabase out of `levx-fe`).
- **User profiles** (avatars, usernames, follows) — Supabase tables + new FE pages.
- **Notifications** (in-app + email).
- **Playwright end-to-end** automation suite (post-MVP, after mock wallet adapter is built).
