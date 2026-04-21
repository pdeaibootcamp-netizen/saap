# v0.2 Identity Bypass — Engineering

*Owner: engineer · Slug: v0-2-identity-bypass · Last updated: 2026-04-21*

## 1. Upstream links

- Build plan: [docs/project/build-plan.md §10](../project/build-plan.md) — v0.2 scope, phase sequencing, and framing discipline.
- Decision log: [D-010](../project/decision-log.md) through [D-017](../project/decision-log.md) — canonical lane identifiers, Supabase/Vercel hosting, Phase 3/4 ratifications.
- Scaffold: [docs/engineering/scaffold.md](scaffold.md) — v0.1 application structure.
- Feature implementation: [docs/engineering/feature-implementation.md](feature-implementation.md) — v0.1 directory map and known gaps.
- ADR-0001: [docs/engineering/adr-0001-tech-stack.md](adr-0001-tech-stack.md)
- ADR-0002: [docs/engineering/adr-0002-brief-storage-and-delivery.md](adr-0002-brief-storage-and-delivery.md)

---

## 2. Context

### v0.1 owner flow and the broken consent gate

In v0.1 (branch `trial-phases-2-4`), the owner identity chain works as follows. A first-time visitor arriving at `/brief/[id]` triggers `resolveUserId()` in `src/lib/auth.ts`, which checks for a George JWT in the `?token=` query parameter and falls back to a Supabase session cookie. If neither is present, `resolveUserId()` returns `null`. The brief page then calls `hasActiveConsent(userId)` in `src/lib/consent.ts`. When `userId` is `null` — which is the case for any cookieless direct visitor — the consent check is skipped and the brief loads without a gate. However, the consent *flow itself* is broken: `POST /api/consent` calls `grantConsent()` and `revokeConsent()` with parameter names (`ip_address`, `user_agent`) that do not match the function signatures in `consent.ts` (`surface`, `channel`, `ip_prefix`). A visitor who clicks "Rozumím a chci pokračovat" on the `/consent` screen sees the error "Nepodařilo se zaznamenat váš souhlas" and goes nowhere. The consent event is never written, so even if the user is subsequently identified, `hasActiveConsent()` returns `false` and the brief page redirects back to `/consent` — an infinite loop. Additionally, the root `page.tsx` is still the scaffold placeholder; there is no owner dashboard. These failures are confirmed in the Phase 4 paper verification and recorded as known gaps EN-001 through EN-004 in `feature-implementation.md`.

### Why v0.2 bypasses rather than fixes

Build plan §10 is explicit: the v0.1 consent POST bug is **not** addressed in v0.2. Fixing the bug would require touching the consent API, which is entangled with the consent copy (pending legal review, OQ-004), the cookie-naming drift (EN-004), and the direct-signup identity stub (OQ-050). Reopening that chain would consume the trial window without advancing the goal of v0.2, which is a customer-testable demo of the **brief and dashboard experience**. The build plan frames the bypass as routing the PoC owner around the currently-non-functional sign-in chain — not as dropping consent as a product concept. The consent architecture (D-007, D-008, D-012), the consent pages, the consent API routes, and the consent DB schema remain on disk and untouched. The bypass is a thin demo-mode layer, implemented entirely in a new file (`src/lib/demo-owner.ts`) plus minimal short-circuit conditions inserted at the specific call sites listed in §4 below. All bypass logic is easily reverted in v0.3 by removing those conditions.

---

## 3. Design — `src/lib/demo-owner.ts` contract

This file is the single source of truth for the PoC demo identity. It has no DB reads and no side effects. It must be a plain TypeScript module with no framework imports.

```typescript
// Exported constants

export const DEMO_OWNER_USER_ID: string
// A fixed UUID in the 00000000-5eed-* pattern used by the v0.1 seed script.
// Exact value: "00000000-5eed-0000-0000-000000000001"
// This ID will never appear in the real consent_events or sector_profiles tables
// (it is never written to the DB by the bypass). It is recognised only in memory
// by isDemoOwner().

export const DEMO_OWNER_PROFILE: SectorProfile
// A SectorProfile constant — same shape as the type exported from src/lib/profiles.ts.
// Field values:
//   user_id:          DEMO_OWNER_USER_ID
//   nace_sector:      "31"   (furniture manufacturing — matches the v0.2 brief seed)
//   size_band:        "S2"   (25–49 employees — mid-range within the valid persona)
//   region:           "Praha"
//   source:           "prepopulated"
//   consent_event_id: "00000000-5eed-0000-0000-c0n5en7e0001"  (a dummy UUID; never written to DB)
//   created_at:       "2026-04-21T00:00:00.000Z"
//   updated_at:       "2026-04-21T00:00:00.000Z"
//   id:               "00000000-5eed-0000-0000-000000000001"

// Exported functions

export function isDemoOwner(userId: string): boolean
// Returns true iff userId === DEMO_OWNER_USER_ID.
// Single string comparison; no async, no DB, no throws.

export async function getDemoOwnerProfile(): Promise<SectorProfile>
// Returns a resolved Promise wrapping DEMO_OWNER_PROFILE.
// No DB read. The async signature matches getProfileByUserId() so callers can
// substitute it with a conditional without changing their await pattern.
```

The `SectorProfile` type is imported from `src/lib/profiles.ts` — `demo-owner.ts` does not redefine it.

---

## 4. Short-circuit list

Every call site that would otherwise gate or redirect the demo owner is listed here with the exact condition to insert. No other files are touched.

### 4.1 `src/app/brief/[id]/page.tsx` — lines 280–293: consent-active check

**Current code (abridged):**
```
if (userId) {
  let consentActive = false;
  try {
    consentActive = await hasActiveConsent(userId);
  } catch {
    if (!isPdf) { redirect(`/consent?...`); }
  }
  if (!consentActive && !isPdf) {
    redirect(`/consent?...`);
  }
}
```

**Condition to insert** at the top of the `if (userId)` block, before the `hasActiveConsent` call:

```
if (isDemoOwner(userId)) {
  // v0.2 bypass: demo owner always has consent; skip DB check.
} else {
  // existing consent check unchanged
}
```

Alternatively, treat `isDemoOwner(userId)` as an early-exit that sets `consentActive = true` and skips the try/catch block entirely.

**Also**: `resolveUserId()` currently returns `null` for cookieless visitors (because both the George JWT and the Supabase session stub return `null`). With the cookie strategy from §5, `resolveUserId()` will receive the `sr_user_id=DEMO_OWNER_USER_ID` cookie and return `DEMO_OWNER_USER_ID`. The consent block is then entered and `isDemoOwner` short-circuits it. This is the correct flow.

### 4.2 `src/lib/consent.ts` — `hasActiveConsent()` function

**Current signature:**
```
export async function hasActiveConsent(userId: string): Promise<boolean>
```

**Condition to insert** at the top of the function body:

```
if (isDemoOwner(userId)) return true;
```

This is a defence-in-depth guard. Because the brief page wraps `hasActiveConsent` in the `isDemoOwner` check (§4.1), this line is not reached in the normal demo path. But any other call site that calls `hasActiveConsent` without an outer check will still work correctly.

Import required: `import { isDemoOwner } from "./demo-owner";`

### 4.3 `src/lib/auth.ts` — `resolveUserId()` function

**Current behaviour:** returns `null` for any cookieless visitor (both code paths — George JWT and Supabase session stub — produce `null`).

**No change needed to `resolveUserId()` itself.** The cookie strategy in §5 means the demo owner will always have `sr_user_id=DEMO_OWNER_USER_ID` set on their browser. `resolveUserId()` in `src/lib/auth.ts` currently reads the George JWT from query params and falls back to a Supabase session. It does **not** read the `sr_user_id` cookie — that cookie is read in `src/app/api/profile/route.ts` and `src/app/settings/soukromi/page.tsx` directly.

This means `resolveUserId()` as called from the brief page will still return `null` for a cookieless visitor even with the cookie set, because `resolveUserId()` in `auth.ts` does not read `sr_user_id`. The brief page therefore needs one additional change: before calling `resolveUserId(urlSearchParams)`, check the `sr_user_id` cookie and, if its value equals `DEMO_OWNER_USER_ID`, short-circuit the whole auth + consent chain to serve the demo profile immediately.

Concretely, at the top of the `BriefPage` server component, before the existing `resolveUserId` call:

```
import { cookies } from "next/headers";
import { isDemoOwner, getDemoOwnerProfile } from "@/lib/demo-owner";

// Inside BriefPage:
const cookieStore = cookies();
const rawUserId = cookieStore.get("sr_user_id")?.value ?? null;
const userId = rawUserId ?? (await resolveUserId(urlSearchParams));
// The consent gate at lines 280–293 then short-circuits via isDemoOwner(userId).
```

No change to the `resolveUserId` function itself. The `sr_user_id` cookie is the identity signal; `auth.ts` is not modified.

### 4.4 `src/lib/profiles.ts` — `getProfileByUserId()` — potential null-profile onboarding redirect

At v0.2, the root page (`src/app/page.tsx`) becomes the owner dashboard. When the dashboard renders, it will need the owner's profile (NACE sector, size band, region) to populate the metric tiles. In v0.1 `page.tsx` is a placeholder and does not call `getProfileByUserId()`. In v0.2 it will.

**Condition to insert** in the dashboard page (to be written in Phase 2.2.b), before any call to `getProfileByUserId()`:

```
if (isDemoOwner(userId)) {
  profile = DEMO_OWNER_PROFILE;
} else {
  profile = await getProfileByUserId(userId);
  if (!profile) {
    redirect("/onboarding");
  }
}
```

`getProfileByUserId()` itself is **not modified.** The short-circuit lives in the calling page only.

### 4.5 No middleware exists

`src/middleware.ts` does not exist in this codebase. There is no route-level redirect to intercept. No action required here.

### 4.6 No change to `src/app/page.tsx` consent/onboarding redirect

The current `page.tsx` is a scaffold placeholder with no redirect logic. It is replaced wholesale in Phase 2.2.a with the dashboard shell. The new dashboard page will contain the `isDemoOwner` short-circuit at §4.4 from the start; there is no pre-existing redirect logic to patch.

---

## 5. Cookie/session handling

**Decision: set `sr_user_id=DEMO_OWNER_USER_ID` as an HTTP cookie on first visit to `/`.**

The root page (`/`) is a Next.js server component. On render, it checks for `sr_user_id` in the request cookies. If absent, it responds with a `Set-Cookie: sr_user_id=00000000-5eed-0000-0000-000000000001; Path=/; SameSite=Lax` header alongside the HTML. All subsequent requests — including navigations to `/brief/[id]` — will carry this cookie, so `isDemoOwner()` returns `true` at every gate.

The alternative — treating every visitor as the demo owner without any cookie — would require threading the demo-owner identity through every server component and API route as a boolean context, or hardcoding checks against `null`/`undefined` userId values throughout the codebase. The cookie approach is narrower: it uses the same `sr_user_id` signal that the rest of the codebase already reads (see `src/app/api/profile/route.ts` line 61, `src/app/settings/soukromi/page.tsx` line 30, `src/app/api/consent/revoke/route.ts` line 26), requires touching only one new file plus the cookie-setting logic in the root page, and leaves all existing code paths structurally unchanged. No cookie means the brief page's `resolveUserId` returns `null`, the consent block is bypassed (because `userId` is falsy), but the dashboard cannot identify the visitor as the demo owner to populate tiles — so a cookie is necessary regardless.

---

## 6. What stays on disk but unreached

The following files remain on disk. They are not deleted, not modified, and not reachable via the demo owner's path. They continue to work if visited directly in the browser.

| Path | Status in v0.2 |
|---|---|
| `src/app/consent/page.tsx` | On disk. The demo owner never reaches `/consent`; the consent gate in the brief page is short-circuited. Navigating to `/consent` directly still renders the page normally. |
| `src/app/api/consent/route.ts` | On disk and unchanged. The known `grantConsent` / `revokeConsent` parameter bug (EN-001) is **not fixed** in v0.2. |
| `src/app/api/consent/revoke/route.ts` | On disk and unchanged. |
| `src/app/onboarding/page.tsx` | On disk. The demo owner never reaches `/onboarding`; the dashboard short-circuits `getProfileByUserId()`. Navigating to `/onboarding` directly still renders the form. |
| `src/app/api/profile/route.ts` | On disk and unchanged. |
| `src/app/settings/soukromi/page.tsx` | On disk and unchanged. Not reachable from the demo owner's path (no link in the v0.2 dashboard or brief page to soukromi — the v0.1 brief page footer link to revocation is removed in Phase 2.2.d). |
| `src/app/settings/soukromi/odvolano/page.tsx` | On disk and unchanged. |

**Analyst side (`/admin/*`) is entirely untouched.** The bypass is scoped to owner-facing routes only. Analyst login, brief CRUD, and publish pipeline continue to operate as in v0.1. The analyst can author and publish the NACE 31 furniture brief that the demo owner's dashboard and brief page will display.

---

## 7. Verification

After Phase 2.2.a lands (identity bypass + dashboard scaffold), the engineer runs the following checks before declaring the phase complete.

1. **Incognito root visit.** Open `http://localhost:3000/` in an incognito/private window (no prior cookies). Confirm the page renders the dashboard shell without any redirect to `/onboarding` or `/consent`. Confirm the browser sets an `sr_user_id` cookie with value `00000000-5eed-0000-0000-000000000001` (visible in DevTools > Application > Cookies).

2. **Brief page without bounce.** In the same incognito session, navigate to `http://localhost:3000/brief/<id>` where `<id>` is a seeded published brief for NACE 31. Confirm the page renders the brief content without redirecting to `/consent`. Confirm no network request to `/api/consent` is made (check DevTools > Network).

3. **Analyst flow unaffected.** Navigate to `http://localhost:3000/admin/login`. Enter password `test`. Confirm the analyst dashboard loads and brief CRUD is functional. This confirms the bypass has not disturbed the admin route group.

4. **Consent page still loads directly.** Navigate to `http://localhost:3000/consent` in the same incognito session. Confirm the consent declaration page renders (the four lane rows, the "Rozumím a chci pokračovat" button). It will still fail on submit (EN-001 is not fixed), but the page must load without a 404 or crash.

5. **Build passes.** From the project root: `cd src && npm run build`. Confirm the command exits 0 with no TypeScript errors and no new warnings introduced by the bypass code. TypeScript must resolve the `SectorProfile` import in `demo-owner.ts` without errors.

---

## 8. Removal plan

When v0.3 reintroduces real identity (the George JWT path becomes functional, or the direct-signup Supabase session stub is replaced by a working implementation per OQ-050), the bypass is lifted by reverting exactly the following:

1. **Delete `src/lib/demo-owner.ts`** — this removes `DEMO_OWNER_USER_ID`, `DEMO_OWNER_PROFILE`, `isDemoOwner()`, and `getDemoOwnerProfile()`.
2. **`src/app/brief/[id]/page.tsx` lines ~280–293** — remove the `isDemoOwner(userId)` short-circuit that skips the consent DB check. Restore the unmodified try/catch + redirect block.
3. **`src/lib/consent.ts` `hasActiveConsent()`** — remove the `if (isDemoOwner(userId)) return true;` early return.
4. **`src/app/page.tsx` (dashboard)** — remove the `sr_user_id` cookie-setting logic and the `isDemoOwner` short-circuit that substitutes `DEMO_OWNER_PROFILE` for a real `getProfileByUserId()` call. Restore the real profile lookup and the `/onboarding` redirect for `null` profiles.

There are no schema changes, no DB rows, and no API changes to revert. The v0.1 consent pages, consent API routes, onboarding page, and profile API are unchanged throughout v0.2 and require no action at revert time.

---

## 9. Non-goals (explicit)

Specialists working on v0.2 must not interpret this document as an invitation to:

- Debug or fix the v0.1 consent POST parameter mismatch in `src/app/api/consent/route.ts` (EN-001). That bug is deferred; it is not in v0.2 scope.
- Redesign the consent UX, copy, or four-lane structure (D-007, D-008). The consent screen is on disk and untouched.
- Delete or move `src/app/consent/page.tsx`, `src/app/onboarding/page.tsx`, or any file under `src/app/settings/soukromi/`.
- Alter the consent DB schema (`consent_events` table, `current_consent_status` view, migrations 0004 or 0005).
- Touch any file under `src/app/admin/` or `src/app/api/admin/`. The analyst back-office is out of scope.

---

## 10. Open questions

None — this document is complete and unblocked. If a dependent specialist encounters a gap, they log it in `docs/project/open-questions.md` per standard protocol.

---

## Changelog

- 2026-04-21 — initial draft — engineer. Covers v0.2 Phase 2.1 Track C: identity bypass ADR for PoC demo owner. No `src/` changes in this artifact; implementation lands in Phase 2.2.a.
