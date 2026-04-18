# Fix Review Report — PR #4 (`feat/supabase-fe-integration`)

**Range:** `git diff main..feat/supabase-fe-integration` (`e70c72a..ec48dd7`, 20 commits, ~3650 LOC added)
**Mode:** Bug-introduction review — no security audit report supplied.
**Confidence gate:** Findings reported only when ≥80% confident the issue is real.

---

## Executive Summary

The PR is a coherent, well-scoped Supabase integration. Auth (nonce → ed25519 → HS256), Edge Function design, RLS policies, and the React provider/hook layer are all built carefully and the test fix-up commit (`ec48dd7`) is legitimate (no coverage was weakened in a meaningful way; the rules-of-hooks fix in `DrawingLayer` is a real bug catch). I found **no Critical or High severity bugs**, but several Medium/Low issues — chiefly an unmount-time `setTimeout` leak in `usePublishDrawFrame`, double-listener attachment on shared channels, and a React-strict-mode duplicate-sign-prompt edge case in `SupabaseAuthProvider`.

**Verdict: ship-able with the Medium fixes folded in (or accepted as known follow-ups).** None of the findings are merge-blockers.

---

## Bug Introduction Findings

### Critical
_None._

### High
_None._

### Medium

| # | File:Line | Issue | Recommended Fix |
|---|-----------|-------|-----------------|
| M1 | `src/lib/supabase/hooks.ts:130-165` (`usePublishDrawFrame`) | The trailing-edge `setTimeout` stored in `timerRef.current` is never cleared on unmount. If the DrawingLayer unmounts mid-throttle-window (component re-mount, route change, market switch), the timer still fires and invokes `flush()` → `acquireChannel`/`channel.send()`/`releaseChannel` after the component is gone. With the current ref-count discipline this won't crash, but it's a memory/effect leak and a future foot-gun if `flush` ever touches React state. | Add a `useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])` cleanup. Also clear `timerRef.current` inside the cleanup. |
| M2 | `src/lib/supabase/hooks.ts:34-52` (`useComments`) and `:97-125` (`useDrawBroadcast`) | The ref-counted channel registry shares the underlying `RealtimeChannel` across acquires, but each consumer attaches its own `.on(...).subscribe()` listener. If two instances of `useComments(marketId)` (or `useDrawBroadcast`) ever mount for the same `marketId`, the same `postgres_changes`/`broadcast` callback is registered twice on the same channel — every event then runs the handler twice. The dedupe-by-id in `useComments` masks the data effect, but it doubles work and `.subscribe()` is called repeatedly on an already-subscribed channel. Today nothing in the codebase mounts these hooks twice for the same id, so no live bug, but the registry contract is incomplete. | Either (a) attach `.on(...).subscribe()` only on first acquire (move it inside `acquireChannel`/return a "freshly created?" boolean), or (b) detach the listener in the cleanup with `channel.off(...)`/`channel.unsubscribe()` reference-counted alongside the channel. Add a regression test: two `renderHook(() => useComments('btc'))` should produce a single handler invocation per emit. |
| M3 | `src/lib/supabase/provider.tsx:70-93` (effect) + `:45-61` (`authenticate`) | In React 18 strict mode the mount-effect runs twice. On a fresh wallet connect with no cached JWT, both runs hit the `void authenticate()` branch. The first call sets `status='pending'` and starts the nonce → sign flow; the second call (synchronously, before the first resolves) does the same thing → **two `signMessage` popups** in dev / strict mode and two nonces consumed. There's no in-flight guard. | Add an in-flight ref: `if (status === 'pending' || authInFlightRef.current) return`. Set `authInFlightRef.current = true` at the top of `authenticate`, clear it in a `finally`. The cached-JWT path is already idempotent so only the cold path needs the guard. |
| M4 | `src/lib/supabase/hooks.ts:138-149` (`flush` in `usePublishDrawFrame`) | `flush()` calls `acquireChannel` then immediately `releaseChannel` after queueing `channel.send(...)`. This is safe **only because** `useDrawBroadcast` is mounted on the same component holding a separate ref-count on the same channel. If a consumer ever publishes without subscribing (e.g., a future "broadcast-only ping" caller), the channel will be created → `send()` queued → channel removed before its `.subscribe()` handshake completes → broadcast silently dropped. | Either (a) document the invariant ("publisher MUST also subscribe — channel must exist"), or (b) hold the channel for the lifetime of `usePublishDrawFrame` via its own `useEffect` acquire/release pair, mirroring `useDrawBroadcast`. |

### Low

| # | File:Line | Issue | Recommended Fix |
|---|-----------|-------|-----------------|
| L1 | `supabase/functions/verify-wallet/index.ts:60-67` (`handleNonce`) | The opportunistic expired-nonce sweep `await admin.from('auth_nonces').delete().lt(...)` runs inline. If the table cleanup errors transiently (network blip), it bubbles into the outer `try` → 500 to the caller, even though nonce issuance itself would have succeeded. | Wrap the sweep in its own try/catch and log-but-ignore failures; only let real insertion failures surface as 5xx. |
| L2 | `supabase/functions/verify-wallet/index.ts:46-58` (router) | `OPTIONS` is handled, but the router doesn't check the request method on `/nonce` and `/verify`. A `GET /functions/v1/verify-wallet/nonce` would invoke `handleNonce()` (a delete-then-insert against `auth_nonces`), needlessly burning DB writes from anything that probes the URL. | Reject non-`POST` early: `if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)`. |
| L3 | `src/lib/supabase/provider.tsx:39-43` (`signMessage` callback) | The `useCallback` deps are `[adapter, signOverride]`. `adapter` is the object returned by `useWallet()` — the wallet-adapter library returns a fresh object reference on most renders, defeating the memo. `authenticate` (which depends on `signMessage`) therefore changes identity each render, which changes the effect deps and re-runs the connect-effect any time the parent re-renders. The `prevWalletRef === wallet` short-circuit prevents user-visible damage but it's wasteful. | Either pull only `adapter.signMessage` (a more stable function ref) into the dep array, or wrap with a ref pattern: keep `adapter` in a ref updated in a layout effect, read inside `signMessage` without listing it. |
| L4 | `src/lib/supabase/auth.ts:14-29` (`cacheJWT` / `loadCachedJWT`) | No `try/catch` around `localStorage.setItem`. In private-mode Safari and over-quota scenarios `setItem` throws — every successful auth would then throw and flip `setStatus('error')` even though the JWT is valid in memory. (`loadCachedJWT` already catches `JSON.parse`, but `getItem` itself can throw under rare CSP setups.) | Wrap `setItem` and `getItem` in try/catch; treat write failure as best-effort (still set in-memory state to authenticated). |
| L5 | `src/lib/supabase/hooks.ts:88-89` | `THROTTLE_MS = 100` and the doc comment in `DrawingLayer` claims "~10 Hz". 100ms is exactly 10 Hz, but the leading+trailing pattern can fire **2 sends inside a single 100 ms window** (leading on burst start, trailing immediately after at `wait = THROTTLE_MS - elapsed`). Worst-case rate is therefore ~20 Hz briefly, not the documented "10 Hz". Not load-dangerous (broadcast is cheap) but the doc in `DrawingLayer.tsx:299` is misleading. | Either tighten the algorithm to strict 10 Hz (track one outstanding timer per window) or update the doc to "~10–20 Hz with leading + trailing edge". |

### Informational

| # | File:Line | Note |
|---|-----------|------|
| I1 | `src/lib/supabase/hooks.ts:151-164` | Eager-on-connect auth is a deliberate UX choice (auto-sign on connect). Worth flagging for product: this triggers a wallet popup the moment a user connects, before they've taken any action that requires auth. Many apps defer until the first authenticated action. Not a bug, but PMs should sign off. |
| I2 | `src/components/DrawingLayer.tsx:301-310` | The `eslint-disable-next-line react-hooks/exhaustive-deps` is justified: `capturedPoints` is rebuilt every render but its identity is captured by `broadcastSig` (concatenated values) + `length`. Adding `capturedPoints` itself to deps would trigger the effect every render. Keep the comment; consider hoisting `broadcastSig` computation to `useMemo` so it's at least stable per render-group. |
| I3 | `supabase/migrations/0001_init.sql:67-70` | The `service_role` bypass in `enforce_comment_rate_limit` is correctly gated: anon/authenticated cannot reach the trigger without first satisfying the insert RLS policy (which requires `authenticated`). Only the Edge Function (or a server-side admin job) ever reaches the trigger as `service_role`. The bypass is appropriate. |
| I4 | `supabase/tests/helpers.ts:6-9` | The committed `LOCAL_ANON_KEY` / `LOCAL_SERVICE_ROLE` / `LOCAL_JWT_SECRET` are the published Supabase CLI defaults — they only unlock the local Docker stack and are inert against any deployed project. Confirmed not referenced from any production-bound code path. |
| I5 | `src/lib/supabase/__mocks__/supabase-js.ts` registered globally via `src/test/setup.ts` | This auto-mocks `@supabase/supabase-js` for **every** Vitest file, not just supabase tests. Means the real client is never exercised in FE tests — true behaviour is verified only in `supabase/tests/rls.test.ts` (Postgres) and `verify-wallet/index.test.ts` (Deno). Acceptable given the explicit two-tier strategy described in `supabase/README.md`, but worth keeping in mind if a future test wants real client behaviour. |

---

## Per-Commit Notes

Only commits with findings are listed.

- **`5d36ca1` — `SupabaseAuthProvider + useSupabaseAuth hook`**: Source of M3 (strict-mode double-authenticate) and L3 (`adapter` dep instability). The provider design is otherwise clean — symmetric purge on disconnect/swap is correctly implemented and verified by `useSupabaseAuth.test.tsx:94-103`.
- **`b004aef` — `useDrawBroadcast subscribe + throttled publish helper`**: Source of M1 (timer leak), M4 (publish-without-subscribe brittleness), and L5 (throttle rate doc). The mock-driven test (`useDrawBroadcast.test.tsx:48-58`) verifies leading+trailing behaviour but doesn't exercise unmount during throttle.
- **`4dbee59` — `ref-counted realtime channel registry`**: Source of M2. The registry deduplicates the channel object but not the listeners attached to it — the contract needs to be either tightened (move `.on()` inside acquire) or documented (caller responsibility to register listeners exactly once).
- **`27a167d` — `client, types, and auth module`**: Source of L4 (no `localStorage` write/read try/catch). All other code paths in this commit look correct, including the 60s expiry-margin check.
- **`1817fa8` — `verify-wallet/verify with atomic nonce consume`**: Source of L1 and L2. The atomic delete-with-returning approach is correct (verified by the parallel double-spend Deno test, `index.test.ts:90-104`); only the periphery (sweep error handling, method gating) is loose.
- **`54ajbe8` — `broadcast in-progress draws and render remote ghost lines`**: This commit added the broadcast `useEffect` that `ec48dd7` later moved before the early return. The fix in `ec48dd7` is correct — verified by reading both diff hunks side-by-side. The `eslint-disable` is justified (see I2).
- **`ec48dd7` — `fix all pre-existing failures + DrawingLayer rules-of-hooks bug`**: I scrutinised every test rewrite the prompt called out:
  - `selectMarketParams` no-op: legitimate. Markets moved on-chain; the duration/interval pickers were genuinely removed. Keeping the function as a marker of "set up params before draw" is reasonable.
  - `MarketStateBadge` rewrite: did **not** weaken coverage. The badge no longer renders prose; the rewrite asserts the visible label AND adds a separate assertion that the `STATE_PROSE` map is exhaustive. Net coverage neutral-to-slightly-positive.
  - `walletStore` race-condition test rewrite: the **previous** assertion (`connected === false` after sync mirror) was wrong — `walletStore.ts:75-82` intentionally mirrors connection synchronously, before the genesis check. The rewrite correctly tests the actual cancellation invariant (`wrongNetwork` not getting flipped post-unmount with a bogus genesis hash). Strictly stronger.
  - `vi.mock('@/lib/supabase/hooks')` in `MarketPage.test.tsx`: acceptable. The page-level test was never the place to verify Supabase wiring; `useSupabaseAuth.test.tsx`, `useComments.test.tsx`, and `usePostComment.test.tsx` cover that. The mock is the minimum surface MarketComments needs to render.
  - `DrawingLayer` hook reorder: confirmed real bug fix. The original placement (broadcast `useEffect` after `if (!isActive) return null`) would have crashed the first idle→active transition with "Rendered more hooks than during the previous render". The new ordering with body-level `isActive` guard is correct.

Other commits (`576a3fd` docs, `22eba26` SQL scaffold, `7d0d22f`/`c2779bc` RLS tests, `4486034` test helpers, `fc4f323` edge stub, `de990c7` nonce, `757b1a4` env, `bbfa1dd` mount, `0980bb8` MarketComments, `4b202f5` README, `2b202f5` test:all script, `ada71d0` schema): no findings.

---

## Acknowledged Tradeoffs (Not Bugs)

1. **FE-supplied `wallet` field in path-draw broadcast payload.** A malicious authenticated user could publish a `draw_frame` whose `payload.wallet` is set to another wallet's pubkey, causing that other wallet's ghost line to render incorrectly on other clients. The design doc accepts this — broadcasts are ephemeral, signing every frame would kill UX, and the abuse surface is "annoy other viewers" with no on-chain or persistent consequence. Confirmed not a missed control; explicitly out of scope.
2. **Eager-on-connect authentication (I1).** Triggers a sign popup on first connect. UX choice, not a bug.
3. **Public read on `comments` (`comments select public`).** Anyone (anon) can read all comments for any market. Intended; mirrors a public forum. No private comments.
4. **Local Supabase CLI default keys committed in `supabase/tests/helpers.ts`.** Published, inert against deployed projects. Convention across Supabase example repos.
5. **`accessToken` on the singleton client snapshots from `getActiveJWT()` per request.** Means there is no proactive refresh — a 24h-stale JWT will result in a one-shot 401 on the first request after expiry, then the user re-signs. Documented in the manual smoke checklist (item 4 in `supabase/README.md`). Acceptable for v1.

---

## Recommendations (Prioritised)

1. **Fix M1** — add `setTimeout` cleanup in `usePublishDrawFrame`. ~6 lines, eliminates a real leak.
2. **Fix M3** — guard `authenticate()` with an in-flight ref so React 18 strict mode (and any other double-render) doesn't fire two sign popups. ~8 lines.
3. **Fix M2** — tighten the channel registry contract: move `.on(...).subscribe()` inside `acquireChannel` (only attach on first acquire), and detach in `releaseChannel` on final release. Add a "two consumers, one event" regression test. Prevents a latent multi-mount bug.
4. **Address M4 / L3 / L4 / L5** as a small follow-up PR — none are blockers, but L4 in particular bites Safari private mode users.
5. **Address L1 / L2** in a separate Edge Function hardening pass (also a good place to add basic IP-level rate limiting on `/nonce` to prevent nonce-table flooding).
6. **Decide on I1 with product** — keep eager auth or move to lazy-on-first-action. If keeping eager, M3 becomes more important.
7. Once the Medium fixes land, no other follow-up needed before merge.
