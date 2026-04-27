#!/usr/bin/env tsx
/**
 * ingest-industry-data.ts — Ingest an industry-data Excel into cohort_companies
 *
 * Usage:
 *   npm run ingest:industry -- \
 *     --file PRD/industry-data/nace-4941-silnicni-nakladni-doprava-2026-02.xlsx \
 *     --year 2024 \
 *     --nace-division 49
 *
 * --year: override the Rok column value (optional; defaults to per-row value)
 * --nace-division: expected NACE division; aborts if any row diverges
 *
 * Data contract: docs/data/cohort-ingestion.md §4–§6.
 * Run AFTER applying migration 0007_cohort_data.sql.
 * Then run seed:synth-quintiles to fill coverage gaps with DE-authored synth rows.
 *
 * Privacy: no firm names are written to the DB. IČO is anonymised industry data
 * ingested under existing data agreements (OQ-003).
 */

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { createClient } from "@supabase/supabase-js";

// ── Args ──────────────────────────────────────────────────────────────────────

// If no --file is passed, auto-detect the only Excel in PRD/industry-data/.
// If no --nace-division is passed, default to "49" (the v0.3 demo NACE).
const DEFAULT_INDUSTRY_DIR = path.resolve(process.cwd(), "..", "PRD", "industry-data");

function autoDetectFile(): string | null {
  if (!fs.existsSync(DEFAULT_INDUSTRY_DIR)) return null;
  const xlsxFiles = fs
    .readdirSync(DEFAULT_INDUSTRY_DIR)
    .filter((f) => f.endsWith(".xlsx"));
  if (xlsxFiles.length === 0) return null;
  if (xlsxFiles.length > 1) {
    console.warn(
      `[ingest] Multiple .xlsx files in ${DEFAULT_INDUSTRY_DIR}; picking ${xlsxFiles[0]}. ` +
      `Pass --file explicitly to override.`
    );
  }
  return path.join(DEFAULT_INDUSTRY_DIR, xlsxFiles[0]);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };
  const fileArg = get("--file");
  const yearArg = get("--year");
  const naceDivisionArg = get("--nace-division") ?? "49";
  const file = fileArg ?? autoDetectFile();
  if (!file) {
    throw new Error(
      `--file is required and no .xlsx auto-detected in PRD/industry-data/. ` +
      `Drop the file there or pass --file explicitly.`
    );
  }
  if (!/^\d{2}$/.test(naceDivisionArg))
    throw new Error("--nace-division must be a 2-digit string");
  return {
    file: path.resolve(file),
    yearOverride: yearArg ? parseInt(yearArg, 10) : null,
    naceDivision: naceDivisionArg,
  };
}

// ── City → region lookup ──────────────────────────────────────────────────────

const CITY_REGION_MAP_PATH = path.resolve(
  __dirname,
  "..",
  "lib",
  "cz-city-region-map.json"
);

function loadCityRegionMap(): Record<string, string> {
  const raw = JSON.parse(fs.readFileSync(CITY_REGION_MAP_PATH, "utf-8"));
  // Exclude _meta key
  const map: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k !== "_meta") map[k] = v as string;
  }
  return map;
}

function lookupRegion(city: string | null, map: Record<string, string>): string | null {
  if (!city) return null;
  // Strip trailing district suffix: "Praha 4" → "Praha"
  const base = city.replace(/\s+\d+$/, "").trim();
  return map[base] ?? map[city] ?? null;
}

// ── Employee count → size_band ────────────────────────────────────────────────
// cohort-ingestion.md §4.3

function employeeCountToSizeBand(count: number | null): "S1" | "S2" | "S3" | null {
  if (count === null) return null;
  if (count <= 24) return "S1";
  if (count <= 49) return "S2";
  return "S3";
}

function bucketToSizeBand(bucket: string | null): "S1" | "S2" | "S3" | null {
  if (!bucket) return null;
  const b = bucket.trim();
  if (["1-5", "6-9", "10-19", "20-24"].includes(b)) return "S1";
  if (b === "25-49") return "S2";
  if (["50-99", "100+"].includes(b)) return "S3";
  // Some sources use "50 a více"
  if (b.startsWith("50") || b.startsWith("100")) return "S3";
  return null;
}

// ── NACE normalisation ────────────────────────────────────────────────────────

// Czech NACE labels seen in industry-data Excels → 4-digit class.
// Extend as new NACEs are ingested. Lower-cased on lookup so variant casing works.
const NACE_LABEL_TO_CLASS: Record<string, string> = {
  "silniční nákladní doprava": "4941",
  "výroba nábytku": "3100",
  // future entries land here as Excels arrive
};

/**
 * Three input shapes are supported:
 *   1. Pure digit string ("4941" or "49") — parsed as before.
 *   2. Czech text label ("Silniční nákladní doprava") — looked up in NACE_LABEL_TO_CLASS.
 *   3. Mixed ("4941 - Silniční nákladní doprava") — digits extracted first.
 *
 * If neither digits nor label match, returns null and the caller treats it as a NACE mismatch.
 */
function normaliseNace(raw: string | null): { naceClass: string; naceDivision: string } | null {
  if (!raw) return null;

  // Try digit extraction first (handles "4941" and "4941 - …" forms).
  const digits = raw.replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length >= 2) {
    const padded = digits.padStart(4, "0").slice(0, 4);
    return { naceClass: padded, naceDivision: padded.slice(0, 2) };
  }

  // Fall back to label lookup (handles plain "Silniční nákladní doprava").
  const labelKey = raw.trim().toLowerCase();
  const cls = NACE_LABEL_TO_CLASS[labelKey];
  if (cls) {
    return { naceClass: cls, naceDivision: cls.slice(0, 2) };
  }

  return null;
}

// ── Plausibility envelopes (cohort-ingestion.md §4.4) ────────────────────────

function derivedMetrics(revenueCzk: number | null, profitCzk: number | null, employeeCount: number | null) {
  let netMargin: number | null = null;
  let revenuePerEmployee: number | null = null;

  if (revenueCzk !== null && profitCzk !== null && Math.abs(revenueCzk) > 1000) {
    const nm = (profitCzk / revenueCzk) * 100;
    if (nm >= -50 && nm <= 60) netMargin = Math.round(nm * 10000) / 10000;
  }

  if (revenueCzk !== null && employeeCount !== null && employeeCount > 0) {
    const rpe = revenueCzk / employeeCount / 1000; // thousands CZK per FTE
    if (rpe >= 100 && rpe <= 100_000) revenuePerEmployee = Math.round(rpe * 100) / 100;
  }

  return { netMargin, revenuePerEmployee };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { file, yearOverride, naceDivision: expectedDivision } = parseArgs();

  if (!fs.existsSync(file)) {
    throw new Error(`Excel file not found: ${file}`);
  }

  console.log(`[ingest] Reading Excel: ${file}`);

  // Dynamic import of xlsx (added to src/package.json deps)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require("xlsx");
  const workbook = XLSX.readFile(file);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: Record<string, string | number | null>[] = XLSX.utils.sheet_to_json(sheet, {
    defval: null,
  });

  console.log(`[ingest] Source rows: ${rows.length}`);

  const cityMap = loadCityRegionMap();

  // Counters
  let ingested = 0;
  let skippedMalformedIco = 0;
  let skippedNoEmployee = 0;
  let skippedNaceMismatch = 0;
  let skippedStaleYear = 0;
  let netMarginCount = 0;
  let revenuePerEmployeeCount = 0;
  let regionMapped = 0;
  let regionUnmapped = 0;
  const sizeBandCounts: Record<string, number> = { S1: 0, S2: 0, S3: 0 };
  const unmappedCities: string[] = [];
  const errorLog: string[] = [];

  // DB connection — use Supabase REST client (HTTPS) instead of postgres
  // TCP library, because the developer's network blocks outbound 5432/6543
  // (well-established issue from v0.1).
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "[ingest] NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be " +
      "set in .env.local — the ingest writes via the Supabase REST client (not " +
      "the postgres TCP library)."
    );
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Build the rows to upsert in memory first; then batch-upsert to Supabase.
  type RowToUpsert = {
    ico: string;
    year: number;
    nace_class: string;
    nace_division: string;
    cz_region: string | null;
    size_band: "S1" | "S2" | "S3";
    revenue_czk: number | null;
    profit_czk: number | null;
    employee_count: number | null;
    net_margin: number | null;
    revenue_per_employee: number | null;
    source_file: string;
  };
  const rowsToUpsert: RowToUpsert[] = [];

  for (const row of rows) {
    // ── IČO ───────────────────────────────────────────────────────────────
    const icoRaw = String(row["IČO"] ?? row["ICO"] ?? "").trim().replace(/\s/g, "").padStart(8, "0");
    if (!/^\d{8}$/.test(icoRaw)) {
      skippedMalformedIco++;
      errorLog.push(`Malformed IČO: ${JSON.stringify(row["IČO"])}`);
      continue;
    }

    // ── NACE ──────────────────────────────────────────────────────────────
    const naceRaw = String(row["Hlavní NACE"] ?? row["Hlavni NACE"] ?? "").trim();
    const nace = normaliseNace(naceRaw);
    if (!nace || nace.naceDivision !== expectedDivision) {
      skippedNaceMismatch++;
      errorLog.push(`NACE mismatch: ${naceRaw} (expected division ${expectedDivision})`);
      continue;
    }

    // ── Year ──────────────────────────────────────────────────────────────
    // Excel cells like "2024 (odhad)" become NaN; empty cells become 0.
    // Both fall back to the override or 2024 (current).
    const yearParsed = Number(row["Rok"]);
    const year = yearOverride ?? (Number.isFinite(yearParsed) && yearParsed > 0 ? yearParsed : 2024);
    // DB CHECK constraint requires year BETWEEN 2015 AND 2030.
    // A handful of firms have only old reports (2009–2014) — too stale for the
    // current-cohort percentile compute; skip them with a clear log entry.
    if (year < 2015 || year > 2030) {
      skippedStaleYear++;
      errorLog.push(`Stale year ${year} (out of 2015–2030 window): IČO=${icoRaw}`);
      continue;
    }

    // ── Revenue / profit ─────────────────────────────────────────────────
    const revenueCzk = row["Obrat"] != null ? Number(row["Obrat"]) : null;
    const profitCzk = row["Hospodářský výsledek"] != null ? Number(row["Hospodářský výsledek"]) : null;

    // ── Employee count → size band ────────────────────────────────────────
    const exactCount = row["Počet zaměstnanců"] != null ? Number(row["Počet zaměstnanců"]) : null;
    const bucket = row["Kategorie počtu zaměstnanců CZ"] != null
      ? String(row["Kategorie počtu zaměstnanců CZ"])
      : null;

    let employeeCount: number | null = null;
    let sizeBand: "S1" | "S2" | "S3" | null = null;

    if (exactCount !== null && !isNaN(exactCount)) {
      employeeCount = Math.round(exactCount);
      sizeBand = employeeCountToSizeBand(employeeCount);
    } else {
      sizeBand = bucketToSizeBand(bucket);
    }

    if (sizeBand === null) {
      skippedNoEmployee++;
      errorLog.push(`Missing employee data: IČO=${icoRaw}`);
      continue;
    }

    // ── Region ───────────────────────────────────────────────────────────
    const cityRaw = row["Obec sídla"] != null ? String(row["Obec sídla"]).trim() : null;
    const region = lookupRegion(cityRaw, cityMap);
    if (region) {
      regionMapped++;
    } else {
      regionUnmapped++;
      if (cityRaw && !unmappedCities.includes(cityRaw)) {
        unmappedCities.push(cityRaw);
      }
    }

    // ── Derived metrics ───────────────────────────────────────────────────
    const { netMargin, revenuePerEmployee } = derivedMetrics(revenueCzk, profitCzk, employeeCount);
    if (netMargin !== null) netMarginCount++;
    if (revenuePerEmployee !== null) revenuePerEmployeeCount++;

    sizeBandCounts[sizeBand]++;

    rowsToUpsert.push({
      ico: icoRaw,
      year,
      nace_class: nace.naceClass,
      nace_division: nace.naceDivision,
      cz_region: region,
      size_band: sizeBand,
      revenue_czk: revenueCzk,
      profit_czk: profitCzk,
      employee_count: employeeCount,
      net_margin: netMargin,
      revenue_per_employee: revenuePerEmployee,
      source_file: path.basename(file),
    });
    ingested++;
  }

  // ── Batch upsert via Supabase REST (HTTPS) ──────────────────────────────
  // Supabase upsert handles ON CONFLICT (ico, year) DO UPDATE via onConflict + ignoreDuplicates: false.
  console.log(`[ingest] Upserting ${rowsToUpsert.length} rows in batches of 500…`);
  const BATCH_SIZE = 500;
  for (let i = 0; i < rowsToUpsert.length; i += BATCH_SIZE) {
    const batch = rowsToUpsert.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("cohort_companies")
      .upsert(batch, { onConflict: "ico,year", ignoreDuplicates: false });
    if (error) {
      throw new Error(
        `[ingest] Supabase upsert failed at batch starting row ${i}: ${error.message}`
      );
    }
    console.log(`  upserted ${Math.min(i + BATCH_SIZE, rowsToUpsert.length)} / ${rowsToUpsert.length}`);
  }

  // ── Write unmapped cities log ─────────────────────────────────────────────
  const logPath = path.resolve(process.cwd(), "cz-city-region-map.unmapped.log");
  fs.writeFileSync(logPath, unmappedCities.sort().join("\n"));

  // ── Write error log ───────────────────────────────────────────────────────
  if (errorLog.length > 0) {
    const errPath = path.resolve(process.cwd(), "ingest.errors.log");
    fs.writeFileSync(errPath, errorLog.join("\n"));
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const skippedTotal = skippedMalformedIco + skippedNoEmployee + skippedNaceMismatch + skippedStaleYear;
  console.log(`\n[ingest] ── Summary ─────────────────────────────────────────`);
  console.log(`Ingested ${ingested} rows out of ${rows.length} source rows.`);
  console.log(`Skipped: ${skippedTotal} (${skippedMalformedIco} malformed IČO, ${skippedNoEmployee} missing employee fields, ${skippedNaceMismatch} NACE mismatch, ${skippedStaleYear} stale year < 2015).`);
  console.log(`Coverage:`);
  console.log(`  net_margin           computed for ${netMarginCount} rows (${pct(netMarginCount, ingested)} %)`);
  console.log(`  revenue_per_employee computed for ${revenuePerEmployeeCount} rows (${pct(revenuePerEmployeeCount, ingested)} %)`);
  console.log(`Region coverage: ${regionMapped} rows mapped (${pct(regionMapped, ingested)} %), ${regionUnmapped} unmapped (logged to ${logPath}).`);
  console.log(`Size-band distribution: S1 = ${sizeBandCounts.S1}, S2 = ${sizeBandCounts.S2}, S3 = ${sizeBandCounts.S3}.`);
  if (errorLog.length > 0) {
    console.log(`Errors logged to: ingest.errors.log (${errorLog.length} entries)`);
  }
}

function pct(n: number, total: number): string {
  if (total === 0) return "0";
  return Math.round((n / total) * 100).toString();
}

main().catch((err) => {
  console.error("[ingest] FATAL:", err);
  process.exit(1);
});
