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
import postgres from "postgres";

// ── Args ──────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };
  const file = get("--file");
  const yearArg = get("--year");
  const naceDivision = get("--nace-division");
  if (!file) throw new Error("--file is required");
  if (!naceDivision || !/^\d{2}$/.test(naceDivision))
    throw new Error("--nace-division must be a 2-digit string");
  return {
    file: path.resolve(file),
    yearOverride: yearArg ? parseInt(yearArg, 10) : null,
    naceDivision,
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

function normaliseNace(raw: string | null): { naceClass: string; naceDivision: string } | null {
  if (!raw) return null;
  const stripped = raw.replace(/\D/g, "").replace(/^0+/, "");
  if (stripped.length < 2) return null;
  const padded = stripped.padStart(4, "0").slice(0, 4);
  return { naceClass: padded, naceDivision: padded.slice(0, 2) };
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
  let netMarginCount = 0;
  let revenuePerEmployeeCount = 0;
  let regionMapped = 0;
  let regionUnmapped = 0;
  const sizeBandCounts: Record<string, number> = { S1: 0, S2: 0, S3: 0 };
  const unmappedCities: string[] = [];
  const errorLog: string[] = [];

  // DB connection
  const dbUrl =
    process.env.DATABASE_URL_USER ||
    process.env.DATABASE_URL ||
    "postgres://placeholder:placeholder@127.0.0.1:5432/placeholder";
  const sql = postgres(dbUrl, { max: 5, idle_timeout: 30, connect_timeout: 15 });

  try {
    // Process rows in a single transaction for atomicity (cohort-ingestion.md §5.3)
    await sql.begin(async (tx) => {
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
        const year = yearOverride ?? (Number(row["Rok"]) || 2024);

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

        // ── Upsert ────────────────────────────────────────────────────────────
        sizeBandCounts[sizeBand]++;

        await tx`
          INSERT INTO cohort_companies (
            ico, year, nace_class, nace_division, cz_region, size_band,
            revenue_czk, profit_czk, employee_count,
            net_margin, revenue_per_employee,
            source_file, ingested_at
          ) VALUES (
            ${icoRaw}, ${year}, ${nace.naceClass}, ${nace.naceDivision},
            ${region as string | null}::cz_region, ${sizeBand}::size_band,
            ${revenueCzk}, ${profitCzk}, ${employeeCount},
            ${netMargin}, ${revenuePerEmployee},
            ${path.basename(file)}, now()
          )
          ON CONFLICT (ico, year) DO UPDATE SET
            nace_class            = EXCLUDED.nace_class,
            nace_division         = EXCLUDED.nace_division,
            cz_region             = EXCLUDED.cz_region,
            size_band             = EXCLUDED.size_band,
            revenue_czk           = EXCLUDED.revenue_czk,
            profit_czk            = EXCLUDED.profit_czk,
            employee_count        = EXCLUDED.employee_count,
            net_margin            = EXCLUDED.net_margin,
            revenue_per_employee  = EXCLUDED.revenue_per_employee,
            source_file           = EXCLUDED.source_file,
            ingested_at           = now()
        `;

        ingested++;
      }
    });
  } finally {
    await sql.end();
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
  const skippedTotal = skippedMalformedIco + skippedNoEmployee + skippedNaceMismatch;
  console.log(`\n[ingest] ── Summary ─────────────────────────────────────────`);
  console.log(`Ingested ${ingested} rows out of ${rows.length} source rows.`);
  console.log(`Skipped: ${skippedTotal} (${skippedMalformedIco} malformed IČO, ${skippedNoEmployee} missing employee fields, ${skippedNaceMismatch} NACE mismatch).`);
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
