## Fix Review Report

**Source:** `main` (`3c1bea9`)
**Target:** `landing-upgrade` (`e698374`)
**PR:** https://github.com/Spizzerp/levx-fe/pull/12
**Report:** none provided — reviewed as general bug / security-anti-pattern scan
**Date:** 2026-04-24

---

## Executive summary

Analyzed **42 commits** (~8,100 insertions, 66 files) covering the landing-page rebuild plus the Supabase waitlist backend. No external audit report was supplied, so the review focused on bugs/security issues **introduced** on this branch.

- External audit findings addressed: N/A (no report)
- New bug / security concerns found: **9** (2 high, 6 medium, 1 low)
- Most exploitable issue: unrate-limited public `submit-waitlist` edge function.
- Most user-visible runtime bug: double-submit race in `WaitlistForm`.

High-confidence findings were verified against the working tree (not just accepted from the reviewer agents).

---

## Findings

| # | File | Severity | Status | Issue |
|---|------|----------|--------|-------|
| F1 | `src/routes/pages/SpreadLogoReveal.tsx:76-83` | High | Not addressed | Inner timer not cancelled → `setState` / `onHidden` fires after unmount |
| F2 | `src/ui/WaitlistForm.tsx:59-93` | High | Not addressed | Double-submit race: state guard is checked before `setStatus` re-renders the disabled button |
| F3 | `supabase/functions/submit-waitlist/index.ts` | Medium | Not addressed | No rate limiting on public endpoint |
| F4 | `supabase/functions/submit-waitlist/index.ts:117-127` | Medium | Not addressed | `invited` → `pending` status downgrade on re-submit |
| F5 | `supabase/migrations/0002_users.sql:61-72` | Medium | Not addressed | `touch_user_updated_at` missing `SET search_path = public` (inconsistent with 0004) |
| F6 | `src/routes/pages/LandingPage.tsx:841,1052` | Medium | Not addressed | `scrollXformActiveRef` gate blocks initial `cardScale` measurement on a scroll-restored reload |
| F7 | `src/ui/WaitlistForm.tsx:67,82` | Medium | Not addressed | `@`-only X username passes validation, submits empty string after prefix strip |
| F8 | `src/routes/pages/__tests__/LandingPage.test.tsx:43-48` | Medium | Not addressed | Test asserts `navigate({to:'/markets'})` but CTA now opens the waitlist modal — stale contract |
| F9 | `src/routes/pages/HeroCalloutCard.tsx:24` | Low | Not addressed | `pointer-events-auto` at `MIN_OPACITY` (0.12) creates near-invisible interactive surfaces |

All findings are net-new (no external audit to reconcile against).

---

## Detailed findings

### F1 — SpreadLogoReveal nested timer leak *(High)*

`src/routes/pages/SpreadLogoReveal.tsx:76-83`

```ts
const handoffTimer = window.setTimeout(() => {
  completedRef.current = true
  onComplete()
  setHandingOff(true)
  window.setTimeout(() => {           // ← not captured, not cleared
    onHidden?.()
    setMounted(false)
  }, FADE_MS)
}, SPREAD_RESOLVE_MS + HOLD_MS)

return () => {
  window.clearTimeout(handoffTimer)   // only cancels the outer
}
```

If the component unmounts during the `FADE_MS` (1.5 s) fade window — e.g., user navigates away from `/` — the inner timer fires on an unmounted component. `onHidden?.()` propagates to `LandingPage.setIntroOverlayHidden(true)`, a state setter on a mount path that may already be torn down.

**Fix:**

```ts
const innerTimerRef = useRef<number | null>(null)
// ...
innerTimerRef.current = window.setTimeout(() => { ... }, FADE_MS)
// ...
return () => {
  window.clearTimeout(handoffTimer)
  if (innerTimerRef.current !== null) window.clearTimeout(innerTimerRef.current)
}
```

### F2 — WaitlistForm double-submit race *(High)*

`src/ui/WaitlistForm.tsx:59-93`

`handleSubmit` sets `status = 'submitting'` via React state, then immediately calls `onSubmit`. The button's `disabled={submitting}` only re-renders on the *next* commit. A fast Enter/double-click during the validation window re-enters `handleSubmit` with the previous (`'idle'`) status and dispatches a second `onSubmit`, yielding duplicate Supabase writes.

**Fix:** gate with a synchronous ref:

```ts
const submittingRef = useRef(false)
const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault()
  if (submittingRef.current) return
  submittingRef.current = true
  try { /* existing body */ } finally { submittingRef.current = false }
}
```

### F3 — submit-waitlist: no rate limiting *(Medium)*

`supabase/functions/submit-waitlist/index.ts`, `supabase/functions/submit-waitlist/_shared/cors.ts`

Endpoint is public, accepts POST from any origin, performs 3 sequential DB queries per request, no throttle, no IP check, no token bucket. A trivial script can flood `waitlist_entries` or run up Supabase costs.

**Fix options (any one is acceptable):**
- **Edge-level:** Cloudflare / Supabase platform rate limit, documented in the function header so a reader can tell it isn't silently missing.
- **In-function:** per-IP counter backed by a `request_log` table with `created_at` + `ip_hash`; reject if >N/min.

### F4 — `invited` status can be downgraded to `pending` *(Medium)*

`supabase/functions/submit-waitlist/index.ts:117-127` — verified in working tree:

```ts
const nextStatus = matchingUser ? 'joined' : 'pending'
if (existingId) {
  if (existingStatus === 'joined') return json({ ok: true, deduped: true }, 200)
  await admin.from('waitlist_entries')
    .update({ ...payload, status: nextStatus })  // overwrites 'invited' with 'pending'
    .eq('id', existingId)
  ...
}
```

Short-circuit only protects `'joined'`. An `'invited'` row re-submitted by a wallet that isn't linked to a `users` row gets `nextStatus = 'pending'` and silently downgrades.

**Fix:**

```ts
const preservedStatus =
  existingStatus === 'invited' || existingStatus === 'joined'
    ? existingStatus
    : nextStatus
await admin.from('waitlist_entries')
  .update({ ...payload, status: preservedStatus })
  .eq('id', existingId)
```

### F5 — `touch_user_updated_at` missing `SET search_path` *(Medium)*

`supabase/migrations/0002_users.sql:61-72` — verified (no `set search_path` clause).

Migration `0004_waitlist_entries_touch_search_path.sql` explicitly hardens the sibling trigger on `waitlist_entries`, but `touch_user_updated_at` on `users` wasn't patched. Inconsistent hardening invites future search-path injection if the schema search path is ever altered.

**Fix:** add migration `0005_users_touch_search_path.sql` mirroring 0004:

```sql
create or replace function public.touch_user_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- existing body
end;
$$;
```

### F6 — cardScale stuck at sentinel on scroll-restored reloads *(Medium)*

`src/routes/pages/LandingPage.tsx:841,1052` — this gate was added in `e698374`.

Flow:
1. Browser restores `scrollY > 0` on back-navigation.
2. `handleScroll()` runs on mount → `scrollXformActiveRef.current = true` immediately.
3. The card's `compute()` ResizeObserver fires and bails on the gate.
4. `cardScale` stays at the `0.55` sentinel; on laptops the card overflows the hero and tour boxes misalign.

**Fix:** permit one "prime" run when `cardScale` is still the sentinel:

```ts
const cardHasMeasuredRef = useRef(false)
const compute = () => {
  if (cardHasMeasuredRef.current && scrollXformActiveRef.current) return
  // ... existing body ...
  cardHasMeasuredRef.current = true
}
```

### F7 — `@`-only X username submits empty string *(Medium)*

`src/ui/WaitlistForm.tsx:67,82` — verified.

```ts
if (!xUsername.trim()) { ... }                      // "@" passes (non-empty after trim)
// ...
const cleanedX = xUsername.trim().replace(/^@/, '') // → ""
await onSubmit?.({ xUsername: cleanedX, ... })      // submits ""
```

**Fix:** validate post-cleanup:

```ts
const cleanedX = xUsername.trim().replace(/^@/, '')
if (!cleanedX) {
  setError('X (Twitter) username is required.')
  return
}
```

### F8 — Stale `LandingPage.test.tsx` assertion *(Medium)*

`src/routes/pages/__tests__/LandingPage.test.tsx:43-48` — verified.

Asserts `navigateSpy` is called with `{ to: '/markets' }` when the Join Waitlist CTA is clicked, but the current branch wires that CTA to `openWaitlist` which opens `WaitlistModal`. The test either fails or silently masks the missing navigation contract.

**Fix:** change the assertion to check for the modal:

```ts
await userEvent.click(screen.getByRole('button', { name: /join waitlist/i }))
expect(screen.getByRole('dialog')).toBeInTheDocument()
```

### F9 — Invisible-but-interactive hero callouts *(Low)*

`src/routes/pages/HeroCalloutCard.tsx:24`

`pointer-events-auto` toggles at `leaderOpacity > 0.1`, but the baseline `MIN_OPACITY` elsewhere is 0.12 — a narrow band where the card is visually nearly invisible yet still handles pointer events (and reacts via `TiltCard`). Not a hard a11y failure (no focusable children), but worth raising the threshold to ≥ 0.5 so interaction kicks in only once the card is meaningfully visible.

---

## Bug-introduction concerns (not tied to a specific finding above)

- **Phase-threshold drift risk** (`LandingPage.tsx:1032-1054`): numeric thresholds for phases 1..5 are duplicated across the scroll handler, the camera origin math, and the pin-wrapper height. They're consistent today; any future change needs all three to stay in sync — consider extracting to a `PHASES` constant.
- **Effect cleanup audit (pass):** every `addEventListener` / `ResizeObserver` / `setTimeout` in the scanned files pairs with a cleanup, except F1.
- **No service-role key leakage:** service-role keys are confined to Supabase Edge Functions; no client bundle reference.
- **RLS policy set reviewed:** `waitlist_entries` has RLS on with no client-facing policies (all mutations via service-role); `users` policies correctly gate on `auth.jwt() ->> 'wallet'`. No bypass path found.
- **Wallet verify flow:** atomic `DELETE ... RETURNING` for nonce consumption, Ed25519 via nacl, fixed-length checks. Test coverage includes race cases. Clean.

---

## Per-commit spot-check

I didn't expand each of the 42 commits individually; the branch is a cohesive feature with many small polish commits on top of a few structural commits. Anchoring commits worth re-reading before merge:

| Commit | Why |
|--------|-----|
| `d164ff1 feat(waitlist): add Supabase waitlist storage and submit endpoint` | Origin of F3, F4. |
| `a83c2b3 feat(users): add Supabase users schema and RLS tests` | Origin of F5. |
| `bd05d82 feat(landing): Adopt spread intro as sole landing reveal` | Origin of F1. |
| `95a487d feat(waitlist): add early-access modal` | Origin of F2, F7. |
| `e698374 feat(landing): Drop waitlist tour stop, tighten curtain, fix nav clicks` | Origin of F6. |

---

## Recommendations

**Before merging (hard blockers):**
1. Fix F1 — inner timer cancellation.
2. Fix F2 — double-submit ref guard.
3. Fix F4 — preserve `invited` status on re-submit.
4. Fix F8 — update or delete the stale CTA-navigation test.

**Before going public (soft blockers):**
5. Fix F3 — add an in-function rate limit or document the infra-level protection.
6. Fix F5 — add `0005_users_touch_search_path.sql`.
7. Fix F6 — prime the cardScale measurement once.
8. Fix F7 — post-cleanup validation on X username.

**Nice to have:**
9. Fix F9 — raise the `pointer-events-auto` threshold.

---

*Generated by `/fix-review:fix-review` on 2026-04-24. Findings from two parallel `code-reviewer` passes (server + frontend) plus manual verification on the high-confidence ones against the working tree.*
