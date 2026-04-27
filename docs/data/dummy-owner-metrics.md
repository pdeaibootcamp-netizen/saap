# Dummy Owner Metrics — v0.2 PoC Demo

*Owner: data-engineer · Slug: dummy-owner-metrics · Last updated: 2026-04-21*

## 1. Purpose + privacy callout

This spec defines the 8 synthetic per-metric raw values that populate the dashboard tiles for the single dummy furniture-SME owner on the v0.2 PoC demo path ([build-plan.md](../project/build-plan.md) §10). The owner has NACE `31` (Manufacture of furniture), size band `S2` (25–49 employees), region `Praha`. The tiles layer a **raw value** (e.g., "Hrubá marže 23,4 %") on top of the cohort percentile + quartile returned by the existing `getBenchmarkSnapshot(naceSector)` in [src/lib/cohort.ts](../../src/lib/cohort.ts) — the percentile math is unchanged.

**Privacy callout — explicit, load-bearing.** Every raw value, every cohort N, and every derived percentile in this spec is **synthetic**. The dummy owner is not a real ČS client. No row defined here:

- enters `user_db` as a `user_contributed` lane row,
- enters the `cohort_stats` pipeline,
- flows to `rm_lead_db` or any RM-visible surface,
- appears in any consent event or consent ledger row,
- is referenced by any `consent_event_id` FK.

The dummy owner is a PoC demo fixture only — it exists to exercise the dashboard UI during customer testing. The recommended delivery mechanism (§6, Option (a)) is an in-memory constant keyed by `user_id`; no DB row, no RLS policy, no lane semantics attached. If a future reader is tempted to treat these values as production `user_contributed` data, they must not — the fixture is clearly segregated in `src/lib/owner-metrics.ts` and carries a file-level privacy banner. This spec does not touch `consent_events`, `sector_profiles`, or any v0.1 production-data table.

## 2. Upstream links

- Product: [docs/product/dashboard-v0-2.md](../product/dashboard-v0-2.md) (PM, parallel)
- Design: [docs/design/dashboard-v0-2/tile-states.md](../design/dashboard-v0-2/tile-states.md) (PD, parallel — owns tile empty-state copy)
- Build plan: [build-plan.md](../project/build-plan.md) §10 (v0.2 scope), §10.4 Phase 2.1 Track A
- Decisions: [D-010](../project/decision-log.md) canonical lane identifiers; [D-013](../project/decision-log.md) Supabase Postgres + Vercel; [D-015](../project/decision-log.md) frozen 8 metrics + Czech quartile labels
- Companion: [cohort-math.md](cohort-math.md) §3 floor, §4 degradation ladder, §5 the 8 ratios; [privacy-architecture.md](privacy-architecture.md) §2 four lanes
- Code touched:
  - `src/lib/cohort.ts` — add one entry to `SEED_COHORTS`; extend `getBenchmarkSnapshot('31')` branch (§3 delta)
  - `src/lib/owner-metrics.ts` — new file (§6, §7)

## 3. NACE 31 cohort stub — delta to `src/lib/cohort.ts`

The existing `SEED_COHORTS` array (lines 35–41) lacks NACE 31. Add one entry; the `getBenchmarkSnapshot` function currently returns the same hardcoded stub regardless of `naceSector`, so it must also be extended to branch on NACE 31 and return the values specified in §4.

### 3.1 `SEED_COHORTS` addition

Append after line 40:

```ts
{ cohort_id: "cohort-31-S2-Praha", nace_sector: "31", size_band: "S2", region: "Praha", n_firms: 34 },
```

`n_firms = 34` clears the global floor (N≥30 per [cohort-math.md](cohort-math.md) §3.1) but sits **below** the stricter per-metric floor (N≥50 per cohort-math §3.2) for `working_capital_cycle` and `pricing_power` — which is exactly the signal we want for the below-floor tile (§5).

### 3.2 `getBenchmarkSnapshot('31')` branch — full return shape

`getBenchmarkSnapshot` must branch on `naceSector === '31'` and return the object below. Order and structure match the existing NACE-46 stub (cohort.ts lines 75–190) so the consumer contract is unchanged. The `confidence_state`, `quartile_label`, `percentile`, `verdict_text`, `rung_footnote`, and `is_email_teaser_snippet` fields match the `BenchmarkMetric` interface in `src/lib/briefs.ts` lines 49–58.

```ts
// Returned when naceSector === "31"
return {
  cohort_id: "cohort-31-S2-Praha",
  resolved_at: new Date().toISOString(),
  categories: [
    {
      category_id: "ziskovost",
      category_label: "Ziskovost",
      metrics: [
        {
          metric_id: "gross_margin",
          metric_label: "Hrubá marže",
          quartile_label: "třetí čtvrtina",
          percentile: 68,
          verdict_text:
            "Vaše hrubá marže vás řadí do třetí čtvrtiny výrobců nábytku ve vašem oboru — 68. percentil.",
          confidence_state: "valid",
          rung_footnote: null,
          is_email_teaser_snippet: true,
        },
        {
          metric_id: "ebitda_margin",
          metric_label: "EBITDA marže",
          quartile_label: "druhá čtvrtina",
          percentile: 41,
          verdict_text:
            "Vaše EBITDA marže vás řadí do druhé čtvrtiny výrobců nábytku ve vašem oboru — 41. percentil.",
          confidence_state: "valid",
          rung_footnote: null,
          is_email_teaser_snippet: false,
        },
      ],
    },
    {
      category_id: "naklady-produktivita",
      category_label: "Náklady a produktivita",
      metrics: [
        {
          metric_id: "labor_cost_ratio",
          metric_label: "Podíl mzdových nákladů",
          quartile_label: "třetí čtvrtina",
          percentile: 62,
          verdict_text:
            "Váš podíl mzdových nákladů vás řadí do třetí čtvrtiny výrobců nábytku ve vašem oboru — 62. percentil.",
          confidence_state: "valid",
          rung_footnote: null,
          is_email_teaser_snippet: false,
        },
        {
          metric_id: "revenue_per_employee",
          metric_label: "Tržby na zaměstnance",
          quartile_label: "druhá čtvrtina",
          percentile: 47,
          verdict_text:
            "Vaše tržby na zaměstnance vás řadí do druhé čtvrtiny výrobců nábytku ve vašem oboru — 47. percentil.",
          confidence_state: "valid",
          rung_footnote: null,
          is_email_teaser_snippet: false,
        },
      ],
    },
    {
      category_id: "efektivita-kapitalu",
      category_label: "Efektivita kapitálu",
      metrics: [
        {
          metric_id: "working_capital_cycle",
          metric_label: "Obratový cyklus",
          quartile_label: null,
          percentile: null,
          verdict_text: null,
          confidence_state: "below-floor",
          rung_footnote:
            "Tato hodnota není k dispozici — počet firem v kohortě je zatím příliš nízký pro spolehlivé srovnání.",
          is_email_teaser_snippet: false,
        },
        {
          metric_id: "roce",
          metric_label: "ROCE",
          quartile_label: "horní čtvrtina",
          percentile: 76,
          verdict_text:
            "Váš ROCE vás řadí do horní čtvrtiny výrobců nábytku ve vašem oboru — 76. percentil.",
          confidence_state: "valid",
          rung_footnote: null,
          is_email_teaser_snippet: false,
        },
      ],
    },
    {
      category_id: "rust-trzni-pozice",
      category_label: "Růst a tržní pozice",
      metrics: [
        {
          metric_id: "revenue_growth",
          metric_label: "Růst tržeb",
          quartile_label: "druhá čtvrtina",
          percentile: 38,
          verdict_text:
            "Váš růst tržeb vás řadí do druhé čtvrtiny výrobců nábytku ve vašem oboru — 38. percentil.",
          confidence_state: "valid",
          rung_footnote: null,
          is_email_teaser_snippet: false,
        },
        {
          metric_id: "pricing_power",
          metric_label: "Cenová síla",
          quartile_label: "třetí čtvrtina",
          percentile: 59,
          verdict_text:
            "Vaše cenová síla vás řadí do třetí čtvrtiny výrobců nábytku ve vašem oboru — 59. percentil.",
          confidence_state: "valid",
          rung_footnote: null,
          is_email_teaser_snippet: false,
        },
      ],
    },
  ],
};
```

### 3.3 Note on `pricing_power` and the stricter per-metric floor

Per [cohort-math.md](cohort-math.md) §3.2, `pricing_power` normally carries a stricter N≥50 floor. At n_firms=34 it would suppress under strict interpretation. For the PoC demo we surface it as `valid` — this is a deliberate simplification consistent with the v0.1 stub posture ("percentile values are pre-seeded fiction for trial"; cohort.ts lines 8–9). We pick `working_capital_cycle` as the single below-floor tile instead (§5). Flagged for future hardening when the real cohort pipeline lands — tracked as OQ-054 in [open-questions.md](../project/open-questions.md).

## 4. Per-owner metric table

Raw values for the dummy furniture SME (NACE 31, S2, Praha). Czech number formatting: decimal comma (`,`), thin-space thousands separator (U+202F, shown as ` ` here). All monetary values in CZK; percentages and days as labeled.

| metric_id | metric_label | category_id | raw_value | raw_value_display | unit_note | expected_percentile_from_cohort | expected_quartile_label | confidence_state |
|---|---|---|---|---|---|---|---|---|
| `gross_margin` | Hrubá marže | `ziskovost` | 0.234 | `23,4 %` | ratio as percentage | 68 | `třetí čtvrtina` | `valid` |
| `ebitda_margin` | EBITDA marže | `ziskovost` | 0.082 | `8,2 %` | ratio as percentage | 41 | `druhá čtvrtina` | `valid` |
| `labor_cost_ratio` | Podíl mzdových nákladů | `naklady-produktivita` | 0.298 | `29,8 %` | ratio as percentage | 62 | `třetí čtvrtina` | `valid` |
| `revenue_per_employee` | Tržby na zaměstnance | `naklady-produktivita` | 2_450_000 | `2 450 000 Kč` | CZK per FTE per year | 47 | `druhá čtvrtina` | `valid` |
| `working_capital_cycle` | Obratový cyklus | `efektivita-kapitalu` | 62 | `62 dní` | days (DSO+DIO−DPO) | — | — | `below-floor` |
| `roce` | ROCE | `efektivita-kapitalu` | 0.143 | `14,3 %` | ratio as percentage | 76 | `horní čtvrtina` | `valid` |
| `revenue_growth` | Růst tržeb | `rust-trzni-pozice` | 0.031 | `+3,1 %` | YoY growth vs prior period | 38 | `druhá čtvrtina` | `valid` |
| `pricing_power` | Cenová síla | `rust-trzni-pozice` | 0.008 | `+0,8 p. b.` | change in gross margin, in percentage points | 59 | `třetí čtvrtina` | `valid` |

The `expected_percentile_from_cohort` and `expected_quartile_label` columns must equal what `getBenchmarkSnapshot('31')` returns per §3.2 — this is the cross-check the engineer runs in §8.

## 5. Plausibility note per metric

One-sentence justification each, calibrated to a mid-market Praha furniture SME (NACE 31 / S2 / 25–49 FTE). Values are synthetic but chosen to be internally consistent with the quartile placement so the tile reads plausibly to a ČS analyst glancing at the demo.

- **Gross margin 23,4 %** — Czech furniture manufacturing typically sits in the 18–28 % gross-margin band; 23,4 % is mid-high, consistent with the third-quartile placement.
- **EBITDA margin 8,2 %** — A ~15 pp compression from gross to EBITDA (to labor, SG&A, depreciation on machinery) is normal in discrete manufacturing; 8,2 % lands mid-pack, matching 41st percentile.
- **Labor cost ratio 29,8 %** — Higher-than-median labor share reflects a Praha location (higher wages than rural Moravia) on mid-automation production; third-quartile 62 fits a "labor-heavy but not extreme" reading.
- **Tržby na zaměstnance 2 450 000 Kč** — For 35 FTE implying ~86 M Kč annual revenue (S2 band mid-range), productivity is mid-pack for furniture manufacturing; second-quartile 47 is consistent.
- **Obratový cyklus 62 dní** — 60–70 days is typical for furniture (finished-goods inventory + 30-day customer terms); the raw value is plausible, the below-floor state is a cohort artifact not a value problem.
- **ROCE 14,3 %** — Strong capital efficiency for a mid-scale furniture operation; fourth-quartile 76 reads as "well-run on the capital side," internally consistent with strong gross margin + moderate leverage.
- **Růst tržeb +3,1 %** — Low-single-digit growth in a soft 2026 furniture market is below the cohort median (second quartile 38); plausible for a Praha SME in a segment facing subdued discretionary spend.
- **Cenová síla +0,8 p. b.** — Gross margin expanded 0,8 pp YoY while the cohort median expanded less; third-quartile 59 says "defended pricing better than most peers" — plausible given the gross margin level.

## 6. Schema + access — recommended delivery mechanism

**Recommendation: Option (a) — in-memory constant in `src/lib/owner-metrics.ts`.**

The dummy owner is a single fixture on the PoC demo path; there is no ingest pipeline, no consent event, no RLS policy, and no operational need for DB persistence. A typed constant keyed by `user_id` delivers the 8 values in one file the engineer can ship in minutes, and the file's sole reason to exist — synthetic demo data — is obvious to any future reader. Option (b) (new `owner_metrics` table with RLS tying rows to `user_contributed`) is the right shape for v0.3+ when real user-contributed financials begin to arrive and the `user_db` lane policies from [privacy-architecture.md](privacy-architecture.md) §2 start carrying weight; building that table now would mint a `user_contributed`-lane row that is not actually user-contributed, which muddies the lane semantics exactly when the demo stress-tests them.

File-level banner in `src/lib/owner-metrics.ts` must read (reinforces §1):

```
/**
 * owner-metrics.ts — Synthetic PoC demo fixture
 *
 * SYNTHETIC DATA. NOT A REAL ČS CLIENT. Not user_contributed lane.
 * Not in cohort_stats. Not consent-backed. Exists only on the v0.2 PoC
 * dashboard demo path. See docs/data/dummy-owner-metrics.md.
 *
 * v0.3+ path: replace with an owner_metrics table in user_db,
 * RLS-scoped to user_id, carrying a consent_event_id FK.
 */
```

## 7. Interface contract for engineer

Copy-paste-ready TypeScript. Goes in `src/lib/owner-metrics.ts`.

```ts
/**
 * Per-owner raw metric value for the dashboard tile layer.
 * See docs/data/dummy-owner-metrics.md §2 for the full field semantics.
 */
export interface OwnerMetric {
  metric_id: string;            // matches BenchmarkMetric.metric_id (briefs.ts L50)
  metric_label: string;         // frozen Czech label per D-011/D-015
  category_id: string;          // one of the four D-011 category IDs
  raw_value: number;            // unformatted numeric value; ratios as decimals (0.234), percentages as decimals
  raw_value_display: string;    // Czech-formatted, render-ready (e.g. "23,4 %", "62 dní", "2 450 000 Kč")
  unit_note: string;            // short human note about unit/interpretation
}

/**
 * Return the 8 owner metrics for the given user. At v0.2 this is an
 * in-memory lookup against a single synthetic furniture-SME fixture.
 *
 * Returns an empty array if the user has no fixture (e.g., any user_id
 * other than the demo dummy). Async signature is forward-compatible with
 * the v0.3+ DB-backed implementation (see §6).
 */
export async function getOwnerMetrics(userId: string): Promise<OwnerMetric[]>;
```

The dummy owner's `userId` is a stable PoC UUID — engineer picks it in `docs/engineering/v0-2-identity-bypass.md` and must keep the same constant used there.

### 7.1 How tile component composes the two sources

The tile component (engineer + designer deliverable, not this spec) composes the tile display as:

1. `const ownerMetrics = await getOwnerMetrics(userId);` — 8 raw values.
2. `const snapshot = getBenchmarkSnapshot('31');` — percentile/quartile/confidence_state per metric.
3. Join on `metric_id`. For each metric_id:
   - Show `raw_value_display` from `OwnerMetric`.
   - If `BenchmarkMetric.confidence_state === 'valid'`: show `quartile_label` and `percentile` alongside.
   - If `BenchmarkMetric.confidence_state === 'below-floor'`: show raw value only, plus the designer-supplied empty-state copy for the comparative strip. **Never fall back to a silent percentile** (cohort-math.md §4 contract).

## 8. Acceptance criteria

The engineer runs these four checks after implementing the delta (§3) and the new file (§7):

1. **All 8 metrics return.** `getOwnerMetrics(DUMMY_FURNITURE_OWNER_ID)` returns an array of length 8; the 8 `metric_id` values match exactly: `gross_margin`, `ebitda_margin`, `labor_cost_ratio`, `revenue_per_employee`, `working_capital_cycle`, `roce`, `revenue_growth`, `pricing_power`.
2. **One metric is below-floor.** When the tile component joins `getOwnerMetrics(...)` with `getBenchmarkSnapshot('31')` on `metric_id`, exactly one metric (`working_capital_cycle`) has `confidence_state === 'below-floor'`; the other seven have `confidence_state === 'valid'`.
3. **Quartile labels match the snapshot.** For each of the 7 valid metrics, the `expected_quartile_label` column in §4 matches the `quartile_label` returned by `getBenchmarkSnapshot('31')` — byte-for-byte equal (e.g., `"třetí čtvrtina"`, diacritics intact).
4. **Czech number formatting is correct in `raw_value_display`.** Decimal separator is a comma (`,`), thousands separator is a thin space (U+202F), unit/suffix is preceded by a regular space (`23,4 %`, not `23,4%`; `62 dní`; `2 450 000 Kč`). Growth metrics carry an explicit sign (`+3,1 %`, `+0,8 p. b.`). Spot-check against §4 row values.

## 9. Open questions

Cross-referenced with [docs/project/open-questions.md](../project/open-questions.md).

| ID | Question | Assumed-for-now | Blocks |
|---|---|---|---|
| OQ-054 | Under the real cohort pipeline, `pricing_power` carries a stricter N≥50 floor ([cohort-math.md](cohort-math.md) §3.2). At the PoC's n_firms=34 it should suppress; we surface it as valid for the demo. Hardening required before v0.3+. | Demo surfaces `pricing_power` as valid per §3.2. | v0.3+ cohort pipeline. |

## Changelog

- 2026-04-21 — initial draft — data-engineer. Defines the 8 synthetic raw values for the dummy furniture-SME owner (NACE 31 / S2 / Praha), the `SEED_COHORTS` delta and `getBenchmarkSnapshot('31')` branch, the in-memory `OwnerMetric` fixture interface, the `working_capital_cycle` below-floor tile, Czech-formatted `raw_value_display` strings, and four acceptance checks. Privacy callout makes explicit that no row here enters `user_contributed`, `cohort_stats`, `rm_lead_db`, or the consent ledger. Flagged OQ-054 for the `pricing_power` strict-floor gap to be hardened at v0.3+.
