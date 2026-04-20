# Sector Profile Configuration — Data

*Owner: data-engineer · Slug: sector-profile-configuration · Last updated: 2026-04-20*

This is a thin addendum, not a new lane or schema. It names the three fields the feature captures, binds them to the existing consent-ledger primitive in [privacy-architecture.md](privacy-architecture.md) §4, and specifies how captured values resolve to a cohort cell per [cohort-math.md](cohort-math.md) §2. No new data lane, no new pipeline, no new retention rule.

## 1. Upstream links

- Product: [docs/product/sector-profile-configuration.md](../product/sector-profile-configuration.md)
- Design: [docs/design/sector-profile-configuration.md](../design/sector-profile-configuration.md)
- PRD sections: §3 (personas), §7.4 (proof of value), §7.5 (privacy as product), §9 (MVP), §10 (cohort segmentation)
- Decisions: [D-001](../project/decision-log.md) hand-assigned cohorts, [D-006](../project/decision-log.md) brief grain = NACE only, [D-007](../project/decision-log.md) single opt-in, [D-010](../project/decision-log.md) canonical lane identifiers, [D-012](../project/decision-log.md) revocation = stop-flow-only, [D-013](../project/decision-log.md) Supabase Postgres, [D-015](../project/decision-log.md) Phase 2 gate
- Foundations: [privacy-architecture.md](privacy-architecture.md) §2–§5, [cohort-math.md](cohort-math.md) §2–§4, §7

## 2. Data model — the three captured fields

Stored in `user_db.sector_profile` (one row per user; append-only edit history via separate `sector_profile_history` table — see §3.3). All three fields are in the **`user_contributed`** lane per [D-010](../project/decision-log.md).

| Field | Type | Source | Datastore | Domain | May train? | RM-visible? | Retention | Notes |
|---|---|---|---|---|---|---|---|---|
| `user_id` | UUID | system | `user_db.sector_profile` | user_contributed | no | no | per [OQ-021](../project/open-questions.md) | FK to `user_db.users`. |
| `consent_event_id` | UUID | system | `user_db.sector_profile` | user_contributed | no | no | same as row | FK to consent ledger (privacy-architecture.md §4.1). NOT NULL. |
| `nace_division` | char(2) enum | user or seed | `user_db.sector_profile` | user_contributed | no | no (MVP) | same as row | 2-digit NACE division code, e.g. `"10"`, `"46"`. Allowed values = the MVP priority NACE division list ([OQ-047](../project/open-questions.md)); selection UI shows the full standard 2-digit set per [cohort-math.md §2.1](cohort-math.md#21-nace-primary-dimension). No 3-digit sub-code at MVP ([OQ-018](../project/open-questions.md)). |
| `size_band` | enum `S1`\|`S2`\|`S3` | user or seed | `user_db.sector_profile` | user_contributed | no | no (MVP) | same as row | Per [cohort-math.md §2.2](cohort-math.md#22-size-bands-recommended): S1=10–24, S2=25–49, S3=50–100. Out-of-persona (<10 or >100) is a UI non-advance; no row written. |
| `region` | enum (8 NUTS 2) | user or seed | `user_db.sector_profile` | user_contributed | no | no (MVP) | same as row | Czech NUTS 2 per [cohort-math.md §2.3](cohort-math.md#23-region-partition-recommended): `praha`, `stredni_cechy`, `jihozapad`, `severozapad`, `severovychod`, `jihovychod`, `stredni_morava`, `moravskoslezsko`. |
| `source` | enum `prepopulated`\|`self_selected` | system | `user_db.sector_profile` | user_contributed | no | no | same as row | Per-field granularity via mirrored `nace_source`, `size_source`, `region_source` columns — a partial-fallback row can be mixed (e.g., NACE self-selected, size + region pre-populated). Drives the "Předvyplněno" label in the ConfirmPanel (design §4.4). |
| `created_at` / `updated_at` | timestamp UTC | system | `user_db.sector_profile` | user_contributed | no | no | same as row | Edits replace the current row; prior values move to `sector_profile_history` (§3.3). |

**Nullability**: at MVP, a `sector_profile` row exists **only** when all three fields are resolved (confirmed by the user or committed via partial-fallback completion). Incomplete capture is held in client state during the onboarding flow; nothing writes until all three are present and consent exists (§3.1). There is no "partially complete profile" persisted state.

**Pre-populatable**: all three fields may arrive from the `user_ingest_prepopulated` seed per [D-001](../project/decision-log.md). Any subset (0 / 1 / 2 / 3 of the three) may be present on the seed; see §4.

## 3. Consent binding + write order

### 3.1 Write-ordering constraint (US-1 AC, non-negotiable #2)

The consent event **must be committed before any `sector_profile` row is written.** In one transaction, or two transactions with the consent write first and the profile write referencing the returned `consent_event_id`. Enforcement is belt-and-braces:

1. Application-level: the confirm / submit handler calls `consent.grant()` first and only then calls `sectorProfile.upsert()` with the returned `consent_event_id`.
2. Database-level: `sector_profile.consent_event_id` is `NOT NULL` with a FK to `consent_events(consent_event_id)`. A profile row cannot exist without a consent row to point at.
3. RLS (Supabase per [D-013](../project/decision-log.md)): writes to `sector_profile` check that the referenced `consent_event_id` belongs to the same `user_id` and is a `grant` event.

No profile write on consent failure — the flow returns to the consent screen's error state (per design §5.1 submit error).

### 3.2 Revocation behavior (D-012 Option A)

On `revoke`, no row in `sector_profile` is deleted or anonymized (per [D-012](../project/decision-log.md) and [privacy-architecture.md §5.1](privacy-architecture.md#51-what-revoke-does-downstream)). Downstream effects:

- `brief_render_delivery` stops selecting the user (reads the latest consent event; a `revoke` filters the user out).
- `cohort_compute_batch` excludes the user at the next run via the same read-time filter. If this drops a cell below floor, the cell degrades at next snapshot per [cohort-math.md §4.1](cohort-math.md#41-degradation-ladder) — expected behavior.
- The `sector_profile` row itself is inert post-revoke; it is neither read nor modified until a new `grant` event reactivates the user.

A subsequent profile edit (US-4) after re-grant writes a new row and pushes the prior to history; the original `consent_event_id` stays referenced by the historic row.

Retention of the inert row under prolonged non-revoked inactivity is governed by [OQ-021](../project/open-questions.md) (open — legal review). No fixed retention is set here.

### 3.3 Edit history (US-4)

`sector_profile_history` mirrors `sector_profile` plus `superseded_at`. Profile edits (US-4) insert a copy of the current row into history with `superseded_at = now()` before the `UPDATE` on `sector_profile`. Each historic row carries its original `consent_event_id` — no re-consent on edit ([D-007](../project/decision-log.md), assumption A-007), but the append-only history preserves which consent event covered each historical value.

## 4. Cohort-membership derivation

Once a `sector_profile` row exists with all three fields resolved, the owner's cohort cell is determined by tuple `(nace_division, size_band, region)` per [cohort-math.md §2](cohort-math.md#2-cohort-grain-and-partition). A row in `cohort_membership` (pre-existing table per [cohort-math.md §7.1](cohort-math.md#71-what-pre-populated-means-concretely-at-mvp)) is keyed by `user_id` and materialized at profile save time. It mirrors the three fields and carries `assignment_origin ∈ {'hand_assigned', 'self_assigned'}`:

- **`hand_assigned`**: D-001 path. The data-engineer + analyst pair set the membership row against the pre-populated seed; the user's later confirmation of the same three fields is idempotent — no change to the membership row. If the user **corrects** a pre-populated field during confirm (design §4.4 edit affordance) or edits post-onboarding (US-4), the `cohort_membership` row is updated to match `sector_profile`; `assignment_origin` flips to `'self_assigned'` for that user.
- **`self_assigned`**: direct-sign-up path and all post-confirmation edits. Written by the application at profile save time.

The `cohort_membership` schema is unchanged by this feature (the table already exists per D-001). This addendum specifies only that the feature's profile save is the write point for the self-assigned row.

## 5. Partial-fallback handling (US-1 AC-3)

The pre-populated seed may arrive with 0, 1, 2, or all 3 of the fields set for a given user. The ingestion contract:

- `user_ingest_prepopulated` (per [privacy-architecture.md §3](privacy-architecture.md#3-pipelines-and-lane-boundaries-at-mvp)) writes a **seed-staging row** (`user_db.prepopulated_seed`) with the three fields as nullable columns + a `source` marker `'cs_seed'`. No row is written to `sector_profile` from ingestion alone — `sector_profile` is owner-confirmed state only.
- At first-session load, the app reads `prepopulated_seed` for the user and hydrates client state with whichever of the three fields are non-null.
- The design flow's `SEED_ROUTE` gate (design §2) routes to the variant (A–F) matching which fields are null in the staging row. Any null field is captured via the corresponding picker.
- On confirm, the app writes one `sector_profile` row with all three fields resolved. `nace_source` / `size_source` / `region_source` reflect whether each field came from the seed or the owner's own selection — for the label-visibility logic in design §4.4 and for audit.
- If the seed is **fully absent** for a user (0 of 3), the flow falls through to the direct-sign-up Selection Form (design §2). No `prepopulated_seed` row exists; `sector_profile.*_source = 'self_selected'` for all three.

The ingestion pipeline is tolerant of partial records by construction — nullable columns, no completeness check at ingest time. Completion is the user's confirmation step.

## 6. Below-floor-still-shipped (US-3)

Cohort membership is recorded **regardless** of whether the resulting `(nace × size × region)` cell currently clears the statistical-validity floor:

- Profile save writes `sector_profile` + `cohort_membership` unconditionally once all three fields are resolved.
- The floor is evaluated at **snapshot time** by `cohort_compute_batch` ([cohort-math.md §3.3](cohort-math.md#33-enforcement-point)), not at profile save time. A user in a sub-floor cell gets placed in the cell and waits; as the cell fills (other owners in the same tuple), it will clear the floor on some future snapshot and the user's embedded snippet becomes active without any re-capture.
- The brief itself delivers regardless (NACE-only grain per [D-006](../project/decision-log.md) / [cohort-math.md §4.1](cohort-math.md#41-degradation-ladder) — the brief never hits rung 4).
- No onboarding-time UI surfaces the cell's current below-floor status (design §5.6; assumption A-017 silent-to-user). The data layer's job is to record the membership and leave the degradation decision to the snapshot producer.

## 7. Open questions

This addendum raises no new open questions. It depends on already-tracked items:

- [OQ-003](../project/open-questions.md) — legal basis for the pre-populated seed (D-001). If resolution requires a new legal basis, the bank-referred pre-population may have to be re-shaped; this addendum assumes the existing assumption (covered by existing ČS agreements) holds.
- [OQ-018](../project/open-questions.md) — 3-digit NACE sub-division overrides. Deferred; the `nace_division` field is `char(2)` at MVP. If resolved in favor of sub-divisions, schema becomes `varchar(3)` with a migration — not urgent.
- [OQ-021](../project/open-questions.md) — retention window for `user_contributed` data independent of revocation. Applies directly to `sector_profile` rows of users who never revoke and never return; no fixed retention is set here pending legal review.
- [OQ-047](../project/open-questions.md) — priority-NACE list. Needed to constrain the `nace_division` allowed-values set for cohort computation; not blocking for profile capture (any 2-digit value is accepted at save; cohort computation handles the membership).
- [OQ-050](../project/open-questions.md) — direct-sign-up auth hand-off. Upstream of when `consent_event_id` becomes available on the direct path; engineer ADR addendum owns the specifics.

## Changelog

- 2026-04-20 — initial addendum — data-engineer. Specifies the three-field `sector_profile` schema (user_contributed lane, consent-event bound), write-order constraint (consent event committed before profile row), D-012 revocation behavior, cohort-membership derivation with hand-assigned vs self-assigned origin, partial-fallback handling via a nullable `prepopulated_seed` staging row, and below-floor-still-shipped semantics (floor evaluated at snapshot time, not at profile save). No new lane, no new pipeline, no new retention rule introduced.
