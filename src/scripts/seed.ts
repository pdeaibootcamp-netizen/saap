/**
 * seed.ts — Idempotent development seed for Strategy Radar MVP trial
 *
 * Run: npm run seed   (from /src directory)
 *
 * Requires env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * AUTH NOTE: src/lib/auth.ts verifyAdminPassword() does a plain string
 * comparison against ADMIN_PASSWORD_HASH. There is no bcrypt in the
 * auth module at MVP trial. To authenticate as analyst:
 *   - Set ADMIN_PASSWORD_HASH=test in your .env.local
 *   - Or omit ADMIN_PASSWORD_HASH entirely — auth.ts falls back to
 *     accepting the literal string "test" when the env var is absent.
 * No hash is generated here because the auth module does not hash.
 *
 * COHORT NOTE: cohort.ts maintains an in-memory SEED_COHORTS array —
 * there is no cohort_stats DB table at MVP. The cohort entries below
 * are seeded via sector_profiles rows; the in-memory array in cohort.ts
 * is the lookup mechanism used by the brief render pipeline.
 * Rung semantics below are descriptive (for test coverage), not DB-enforced.
 *
 * Rung 0 = valid cell (N ≥ 30, all metrics active)
 * Rung 1–3 = partially populated (some metrics suppressed)
 * Rung 4 = below-floor cell (used for negative-path test; no brief suppressed)
 *
 * D-012: no data deleted. Seed is safe to re-run (upsert on conflict).
 * Privacy: consent event written before sector_profile row per §3.1 write-order.
 */

import { createClient } from "@supabase/supabase-js";

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "[seed] ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ─── Analyst account ─────────────────────────────────────────────────────────

/**
 * Seed the analyst user.
 * Auth model: plain string comparison in verifyAdminPassword().
 * Action: print instructions for .env.local — no DB row written for admin.
 */
function seedAnalyst(): { created: boolean } {
  console.log("\n[seed] Analyst account:");
  console.log("  Username : analyst");
  console.log("  Password : test");
  console.log(
    "  Action   : Set ADMIN_PASSWORD_HASH=test in your .env.local (or omit it)."
  );
  console.log(
    "             src/lib/auth.ts accepts 'test' when ADMIN_PASSWORD_HASH is absent."
  );
  console.log(
    "  Login    : http://localhost:3000/admin  (password: test)"
  );
  // No DB row — admin auth is env-var based per ADR-0001-D.
  return { created: false }; // already "exists" via env var convention
}

// ─── Cohort cells ─────────────────────────────────────────────────────────────

interface CohortCell {
  label: string;
  nace_sector: string;
  size_band: "S1" | "S2" | "S3";
  region: string;
  rung: number; // descriptive: 0=valid, 1-3=partial, 4=below-floor
  n_firms: number;
}

// 5 cells: 2 valid (rung 0), 3 partially populated (rungs 1-3), 1 below floor (rung 4).
// Note: rung 4 is one of the 5 cells (the 3 partial cells include one rung 4).
const COHORT_CELLS: CohortCell[] = [
  // Rung 0 — valid cells (N >= 30, all metrics active)
  {
    label: "Velkoobchod Praha S2",
    nace_sector: "46",
    size_band: "S2",
    region: "Praha",
    rung: 0,
    n_firms: 42,
  },
  {
    label: "Velkoobchod Praha S1",
    nace_sector: "46",
    size_band: "S1",
    region: "Praha",
    rung: 0,
    n_firms: 38,
  },
  // Rung 1 — partial metrics (some ratios suppressed)
  {
    label: "Potravinářství Jihozápad S2",
    nace_sector: "10",
    size_band: "S2",
    region: "Jihozápad",
    rung: 1,
    n_firms: 22,
  },
  // Rung 2 — mostly suppressed
  {
    label: "IT Střední Čechy S3",
    nace_sector: "62",
    size_band: "S3",
    region: "Střední Čechy",
    rung: 2,
    n_firms: 18,
  },
  // Rung 4 — below floor (negative-path test: N < minimum floor)
  {
    label: "Stavebnictví Severozápad S1",
    nace_sector: "41",
    size_band: "S1",
    region: "Severozápad",
    rung: 4,
    n_firms: 7,
  },
];

// ─── Sector profile rows ──────────────────────────────────────────────────────

interface SectorProfileSeed {
  userId: string;
  email: string;
  nace_sector: string;
  size_band: "S1" | "S2" | "S3";
  region: string;
  source: "prepopulated" | "user_entered";
  label: string; // for logging
}

// 15 sector_profile rows:
// 3 NACE divisions (46, 10, 62) × 2 size bands × 2 regions = 12,
// plus 3 additional in the 41/Severozápad/rung-4 cell and extras.
// All have stable UUIDs so re-runs are idempotent.
const SECTOR_PROFILE_SEEDS: SectorProfileSeed[] = [
  // NACE 46 (Velkoobchod) — Praha — S1 and S2
  { userId: "00000000-seed-0001-0000-000000000001", email: "user01@example.cz", nace_sector: "46", size_band: "S1", region: "Praha", source: "prepopulated", label: "46/S1/Praha" },
  { userId: "00000000-seed-0001-0000-000000000002", email: "user02@example.cz", nace_sector: "46", size_band: "S1", region: "Praha", source: "prepopulated", label: "46/S1/Praha" },
  { userId: "00000000-seed-0001-0000-000000000003", email: "user03@example.cz", nace_sector: "46", size_band: "S2", region: "Praha", source: "prepopulated", label: "46/S2/Praha" },
  { userId: "00000000-seed-0001-0000-000000000004", email: "user04@example.cz", nace_sector: "46", size_band: "S2", region: "Praha", source: "user_entered", label: "46/S2/Praha" },
  // NACE 46 — Jihozápad — S1 and S2
  { userId: "00000000-seed-0002-0000-000000000001", email: "user05@example.cz", nace_sector: "46", size_band: "S1", region: "Jihozápad", source: "prepopulated", label: "46/S1/Jihozápad" },
  { userId: "00000000-seed-0002-0000-000000000002", email: "user06@example.cz", nace_sector: "46", size_band: "S2", region: "Jihozápad", source: "prepopulated", label: "46/S2/Jihozápad" },
  // NACE 10 (Potravinářství) — Praha — S1 and S2
  { userId: "00000000-seed-0010-0000-000000000001", email: "user07@example.cz", nace_sector: "10", size_band: "S1", region: "Praha", source: "prepopulated", label: "10/S1/Praha" },
  { userId: "00000000-seed-0010-0000-000000000002", email: "user08@example.cz", nace_sector: "10", size_band: "S2", region: "Praha", source: "user_entered", label: "10/S2/Praha" },
  // NACE 10 — Jihozápad — S1 and S2
  { userId: "00000000-seed-0010-0000-000000000003", email: "user09@example.cz", nace_sector: "10", size_band: "S1", region: "Jihozápad", source: "prepopulated", label: "10/S1/Jihozápad" },
  { userId: "00000000-seed-0010-0000-000000000004", email: "user10@example.cz", nace_sector: "10", size_band: "S2", region: "Jihozápad", source: "prepopulated", label: "10/S2/Jihozápad" },
  // NACE 62 (IT) — Praha — S2 and S3
  { userId: "00000000-seed-0062-0000-000000000001", email: "user11@example.cz", nace_sector: "62", size_band: "S2", region: "Praha", source: "user_entered", label: "62/S2/Praha" },
  { userId: "00000000-seed-0062-0000-000000000002", email: "user12@example.cz", nace_sector: "62", size_band: "S3", region: "Praha", source: "prepopulated", label: "62/S3/Praha" },
  // NACE 62 — Střední Čechy — S2 and S3
  { userId: "00000000-seed-0062-0000-000000000003", email: "user13@example.cz", nace_sector: "62", size_band: "S2", region: "Střední Čechy", source: "prepopulated", label: "62/S2/Střední Čechy" },
  { userId: "00000000-seed-0062-0000-000000000004", email: "user14@example.cz", nace_sector: "62", size_band: "S3", region: "Střední Čechy", source: "prepopulated", label: "62/S3/Střední Čechy" },
  // NACE 41 (Stavebnictví) — Severozápad — S1 (rung-4 / below-floor cell)
  { userId: "00000000-seed-0041-0000-000000000001", email: "user15@example.cz", nace_sector: "41", size_band: "S1", region: "Severozápad", source: "prepopulated", label: "41/S1/Severozápad (below-floor)" },
];

// ─── Sample brief benchmark snippet ──────────────────────────────────────────

/**
 * Builds the benchmark_snippet JSONB for the sample brief.
 * Exercises all four D-011 categories:
 *   - Category 1 (ziskovost): both ratios fully populated -> fully valid
 *   - Category 2 (naklady-produktivita): one ratio suppressed (below-floor)
 *   - Category 3 (efektivita-kapitalu): both ratios suppressed (empty category)
 *   - Category 4 (rust-trzni-pozice): both ratios valid
 */
function buildSampleBenchmarkSnippet() {
  return {
    cohort_id: "cohort-46-S2-Praha",
    resolved_at: "2026-04-01T08:00:00.000Z",
    categories: [
      // Category 1: fully populated — both ratios valid
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
              "Vaše hrubá marže vás řadí do třetí čtvrtiny kohorty ve vašem oboru — 68. percentil.",
            confidence_state: "valid",
            rung_footnote: null,
            is_email_teaser_snippet: true,
          },
          {
            metric_id: "ebitda_margin",
            metric_label: "EBITDA marže",
            quartile_label: "druhá čtvrtina",
            percentile: 44,
            verdict_text:
              "Vaše EBITDA marže vás řadí do druhé čtvrtiny kohorty ve vašem oboru — 44. percentil.",
            confidence_state: "valid",
            rung_footnote: null,
            is_email_teaser_snippet: false,
          },
        ],
      },
      // Category 2: one ratio suppressed (below-floor for that metric)
      {
        category_id: "naklady-produktivita",
        category_label: "Náklady a produktivita",
        metrics: [
          {
            metric_id: "labor_cost_ratio",
            metric_label: "Podíl mzdových nákladů",
            quartile_label: null,
            percentile: null,
            verdict_text: null,
            confidence_state: "below-floor",
            rung_footnote:
              "Tato hodnota není k dispozici — počet firem v kohortě je zatím příliš nízký pro spolehlivé srovnání.",
            is_email_teaser_snippet: false,
          },
          {
            metric_id: "revenue_per_employee",
            metric_label: "Tržby na zaměstnance",
            quartile_label: "třetí čtvrtina",
            percentile: 57,
            verdict_text:
              "Vaše tržby na zaměstnance vás řadí do třetí čtvrtiny kohorty ve vašem oboru — 57. percentil.",
            confidence_state: "valid",
            rung_footnote: null,
            is_email_teaser_snippet: false,
          },
        ],
      },
      // Category 3: both ratios suppressed — exercises empty-category empty-state copy
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
            quartile_label: null,
            percentile: null,
            verdict_text: null,
            confidence_state: "below-floor",
            rung_footnote:
              "Tato hodnota není k dispozici — počet firem v kohortě je zatím příliš nízký pro spolehlivé srovnání.",
            is_email_teaser_snippet: false,
          },
        ],
      },
      // Category 4: both ratios valid
      {
        category_id: "rust-trzni-pozice",
        category_label: "Růst a tržní pozice",
        metrics: [
          {
            metric_id: "revenue_growth",
            metric_label: "Růst tržeb",
            quartile_label: "horní čtvrtina",
            percentile: 78,
            verdict_text:
              "Váš růst tržeb vás řadí do horní čtvrtiny firem ve vašem oboru — 78. percentil.",
            confidence_state: "valid",
            rung_footnote: null,
            is_email_teaser_snippet: false,
          },
          {
            metric_id: "pricing_power",
            metric_label: "Cenová síla",
            quartile_label: "druhá čtvrtina",
            percentile: 52,
            verdict_text:
              "Vaše cenová síla vás řadí do druhé čtvrtiny firem ve vašem oboru — 52. percentil.",
            confidence_state: "valid",
            rung_footnote: null,
            is_email_teaser_snippet: false,
          },
        ],
      },
    ],
  };
}

// ─── Sample brief content sections ────────────────────────────────────────────

function buildSampleBriefContentSections() {
  return [
    {
      section_id: "sector-context",
      heading: "Situace v sektoru",
      body: "Velkoobchodní sektor (NACE 46) zaznamenal v prvním čtvrtletí 2026 mírný pokles poptávky ze strany maloobchodních odběratelů, zejména v kategorii spotřebního zboží. Průměrné dodací lhůty se zkrátily o 8 % oproti předchozímu roku, což svědčí o normalizaci dodavatelských řetězců po předchozích výkyvech. Inflační tlaky v logistice zůstávají zvýšené — náklady na přepravu meziročně vzrostly o 12 %. Podniky střední velikosti (25–49 zaměstnanců) vykazují lepší odolnost než menší firmy díky větší diverzifikaci odběratelské základny.",
      order: 1,
    },
    {
      section_id: "observations",
      heading: "Klíčová pozorování",
      body: JSON.stringify([
        // Sector-level observation 1
        {
          headline: "Marže pod tlakem napříč sektorem",
          body: "Průměrná hrubá marže firem v NACE 46 klesla v posledních 12 měsících o 1,4 procentního bodu. Hlavními příčinami jsou rostoucí vstupní ceny a nižší vyjednávací síla vůči zahraničním dodavatelům. Firmy, které diverzifikovaly dodavatele do více zemí, si udržely marže na vyšší úrovni.",
          time_horizon: "Do 3 měsíců",
          is_email_teaser: true,
        },
        // Sector-level observation 2
        {
          headline: "Digitalizace objednávkových procesů přináší úspory",
          body: "Podniky, které přešly na plně digitální zpracování objednávek, vykázaly o 7 % nižší provozní náklady na objednávku. Adopce EDI systémů a automatizovaných fakturačních řešení se v sektoru meziročně zdvojnásobila.",
          time_horizon: "Do 12 měsíců",
          is_email_teaser: false,
        },
        // Owner-relative observation
        {
          headline: "Vaše pozice v kohortě",
          body: "Vaše hrubá marže vás řadí do třetí čtvrtiny firem ve vašem oboru. To znamená, že zhruba třetina srovnatelných podniků vykazuje vyšší marže — prostor pro zlepšení existuje, ale nejste mezi nejslabšími. Vaše tržby na zaměstnance jsou nadprůměrné (57. percentil), což naznačuje dobrou produktivitu.",
          time_horizon: "Okamžitě",
          is_email_teaser: false,
        },
      ]),
      order: 2,
    },
    {
      section_id: "actions",
      heading: "Doporučené kroky",
      body: JSON.stringify([
        {
          action_text:
            "Zkontrolujte smlouvy s klíčovými dodavateli a identifikujte, kde lze sjednat množstevní slevy nebo delší platební lhůty. I malé úpravy podmínek mohou zlepšit cash flow o několik týdnů.",
          time_horizon: "Okamžitě",
          category: "naklady-produktivita",
        },
        {
          action_text:
            "Zvažte pilotní nasazení elektronické fakturace (e-faktura) pro top 5 odběratelů. Podniky, které to zavedly, ušetřily průměrně 2–3 hodiny administrativy týdně na fakturu.",
          time_horizon: "Do 3 měsíců",
          category: "naklady-produktivita",
        },
        {
          action_text:
            "Připravte střednědobý plán diverzifikace dodavatelů pro produktové kategorie s nejvyšší závislostí na jediném zdroji. Cílem je snížit riziko výpadku dodávek a posílit vyjednávací pozici.",
          time_horizon: "Do 12 měsíců",
          category: "rust-trzni-pozice",
        },
      ]),
      order: 3,
    },
  ];
}

// ─── Seed functions ───────────────────────────────────────────────────────────

interface SeedSummary {
  consentEventsCreated: number;
  consentEventsExisted: number;
  sectorProfilesCreated: number;
  sectorProfilesExisted: number;
  prepopulatedSeedCreated: number;
  prepopulatedSeedExisted: number;
  briefsCreated: number;
  briefsExisted: number;
}

async function seedConsentAndProfiles(summary: SeedSummary): Promise<void> {
  for (const profile of SECTOR_PROFILE_SEEDS) {
    // Step 1: Write consent event first (§3.1 write-order constraint).
    // Check if a grant event already exists for this user_id.
    const { data: existingConsent, error: existingConsentError } = await supabase
      .from("consent_events")
      .select("consent_event_id")
      .eq("user_id", profile.userId)
      .eq("event_type", "grant")
      .order("ts", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingConsentError) {
      console.error(`[seed] Error checking consent for ${profile.label}:`, existingConsentError);
      continue;
    }

    let consentEventId: string;

    if (existingConsent) {
      consentEventId = existingConsent.consent_event_id;
      summary.consentEventsExisted++;
    } else {
      const { data: newConsent, error: consentError } = await supabase
        .from("consent_events")
        .insert({
          user_id: profile.userId,
          event_type: "grant",
          consent_copy_version: "v1.0-2026-04",
          lanes_covered: ["brief", "user_contributed", "rm_visible", "credit_risk"],
          surface: "onboarding-screen",
          channel: "rm-referred-george-embed",
          prior_event_id: null,
          captured_text_hash: "placeholder-hash-v1.0-2026-04",
          ip_prefix: null,
        })
        .select("consent_event_id")
        .single();

      if (consentError || !newConsent) {
        console.error(`[seed] Error inserting consent for ${profile.label}:`, consentError);
        continue;
      }
      consentEventId = newConsent.consent_event_id;
      summary.consentEventsCreated++;
    }

    // Step 2: Upsert sector_profile row (consent event exists — FK constraint satisfied).
    const { data: existingProfile } = await supabase
      .from("sector_profiles")
      .select("id")
      .eq("user_id", profile.userId)
      .maybeSingle();

    if (existingProfile) {
      summary.sectorProfilesExisted++;
    } else {
      const { error: profileError } = await supabase.from("sector_profiles").insert({
        user_id: profile.userId,
        nace_sector: profile.nace_sector,
        size_band: profile.size_band,
        region: profile.region,
        source: profile.source,
        consent_event_id: consentEventId,
        email: profile.email,
      });

      if (profileError) {
        console.error(`[seed] Error inserting sector_profile for ${profile.label}:`, profileError);
        continue;
      }
      summary.sectorProfilesCreated++;
    }

    // Step 3: Upsert prepopulated_seed row for profiles with source=prepopulated.
    if (profile.source === "prepopulated") {
      const { data: existingSeed } = await supabase
        .from("prepopulated_seed")
        .select("id")
        .eq("user_id", profile.userId)
        .maybeSingle();

      if (existingSeed) {
        summary.prepopulatedSeedExisted++;
      } else {
        const { error: seedError } = await supabase.from("prepopulated_seed").insert({
          user_id: profile.userId,
          nace_sector: profile.nace_sector,
          size_band: profile.size_band,
          region: profile.region,
          email: profile.email,
          source: "cs_seed",
        });

        if (seedError) {
          console.error(`[seed] Error inserting prepopulated_seed for ${profile.label}:`, seedError);
        } else {
          summary.prepopulatedSeedCreated++;
        }
      }
    }
  }
}

async function seedSampleBrief(summary: SeedSummary): Promise<void> {
  // Check if a published brief for NACE 46 already exists.
  const { data: existing } = await supabase
    .from("briefs")
    .select("id")
    .eq("nace_sector", "46")
    .eq("publish_state", "published")
    .maybeSingle();

  if (existing) {
    summary.briefsExisted++;
    return;
  }

  const contentSections = buildSampleBriefContentSections();
  const benchmarkSnippet = buildSampleBenchmarkSnippet();

  const { error } = await supabase.from("briefs").insert({
    nace_sector: "46",
    publish_state: "published",
    author_id: "analyst",
    published_at: new Date("2026-04-01T08:00:00.000Z").toISOString(),
    content_sections: contentSections,
    benchmark_snippet: benchmarkSnippet,
  });

  if (error) {
    console.error("[seed] Error inserting sample brief:", error);
  } else {
    summary.briefsCreated++;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Strategy Radar — development seed ===");
  console.log("Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY\n");

  const summary: SeedSummary = {
    consentEventsCreated: 0,
    consentEventsExisted: 0,
    sectorProfilesCreated: 0,
    sectorProfilesExisted: 0,
    prepopulatedSeedCreated: 0,
    prepopulatedSeedExisted: 0,
    briefsCreated: 0,
    briefsExisted: 0,
  };

  // Analyst
  const analystResult = seedAnalyst();
  void analystResult; // env-var based, always idempotent

  // Consent events + sector_profiles + prepopulated_seed
  console.log(`\n[seed] Seeding ${SECTOR_PROFILE_SEEDS.length} sector profiles...`);
  await seedConsentAndProfiles(summary);

  // Sample brief
  console.log("[seed] Seeding sample brief for NACE 46...");
  await seedSampleBrief(summary);

  // Summary
  console.log("\n=== Seed summary ===");
  console.log(`Analyst:           env-var based (set ADMIN_PASSWORD_HASH=test in .env.local)`);
  console.log(`Cohort cells:      ${COHORT_CELLS.length} defined (in-memory in cohort.ts; descriptive only)`);
  console.log(`  - Rung 0 (valid): ${COHORT_CELLS.filter((c) => c.rung === 0).length}`);
  console.log(`  - Rung 1-3 (partial): ${COHORT_CELLS.filter((c) => c.rung >= 1 && c.rung <= 3).length}`);
  console.log(`  - Rung 4 (below-floor): ${COHORT_CELLS.filter((c) => c.rung === 4).length}`);
  console.log(`Consent events:    created=${summary.consentEventsCreated}, already existed=${summary.consentEventsExisted}`);
  console.log(`Sector profiles:   created=${summary.sectorProfilesCreated}, already existed=${summary.sectorProfilesExisted}`);
  console.log(`Prepopulated seed: created=${summary.prepopulatedSeedCreated}, already existed=${summary.prepopulatedSeedExisted}`);
  console.log(`Briefs:            created=${summary.briefsCreated}, already existed=${summary.briefsExisted}`);
  console.log("\nDone. Safe to re-run — all operations are idempotent.");
}

main().catch((err) => {
  console.error("[seed] Fatal error:", err);
  process.exit(1);
});
