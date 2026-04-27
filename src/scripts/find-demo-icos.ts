/**
 * One-off helper: find 4 real IČOs in cohort_companies matching the demo
 * categories (in-tile-prompts.md §9.2):
 *   - DEMO_ICO_MISSING_DATA  — large firm, employee_count AND profit_czk null
 *   - DEMO_ICO_NO_EMPLOYEES  — mid firm,   employee_count null only
 *   - DEMO_ICO_NO_PROFIT     — mid firm,   profit_czk null only
 *   - DEMO_ICO_FULL_DATA     — small firm, all fields present
 *
 * Run: npx tsx src/scripts/find-demo-icos.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env.local manually (no dotenv dep needed for a one-off).
try {
  const env = readFileSync(resolve(__dirname, "../.env.local"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  // ignore
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(url, key, { auth: { persistSession: false } });

async function pick(filter: (q: any) => any, label: string, sizeBand: string) {
  let q = sb
    .from("cohort_companies")
    .select("ico, size_band, employee_count, profit_czk, revenue_czk, net_margin, revenue_per_employee, cz_region")
    .eq("nace_division", "49")
    .eq("size_band", sizeBand)
    .limit(5);
  q = filter(q);
  const { data, error } = await q;
  if (error) {
    console.error(`[${label}]`, error.message);
    return null;
  }
  if (!data || data.length === 0) {
    console.log(`[${label}] no match for size=${sizeBand}`);
    return null;
  }
  return data;
}

async function main() {
  // Need to discover what columns the table actually has — check if `name` exists
  const probe = await sb.from("cohort_companies").select("*").limit(1);
  if (probe.error) {
    console.error("probe error:", probe.error.message);
    process.exit(1);
  }
  console.log("columns:", Object.keys(probe.data?.[0] ?? {}).join(", "));
  console.log("");

  // 1) MISSING_DATA: large firm (S3), both employee_count and profit_czk null
  const missing = await pick(
    (q) => q.is("employee_count", null).is("profit_czk", null),
    "MISSING_DATA",
    "S3",
  );

  // 2) NO_EMPLOYEES: any size, employee_count null but profit_czk present
  const noEmp = await pick(
    (q) => q.is("employee_count", null).not("profit_czk", "is", null),
    "NO_EMPLOYEES",
    "S1",
  );
  const noEmpS3 = await pick(
    (q) => q.is("employee_count", null).not("profit_czk", "is", null),
    "NO_EMPLOYEES (S3 fallback)",
    "S3",
  );

  // 3) NO_PROFIT: mid (S2), profit_czk null but employee_count present
  const noProfit = await pick(
    (q) => q.is("profit_czk", null).not("employee_count", "is", null),
    "NO_PROFIT",
    "S2",
  );

  // 4) FULL_DATA: small (S1), both present, both derived metrics non-null
  const full = await pick(
    (q) =>
      q
        .not("employee_count", "is", null)
        .not("profit_czk", "is", null)
        .not("net_margin", "is", null)
        .not("revenue_per_employee", "is", null),
    "FULL_DATA",
    "S1",
  );

  console.log("\n--- candidates ---");
  console.log("MISSING_DATA  (S3):", missing?.[0] ?? "none");
  console.log("NO_EMPLOYEES  (S1):", noEmp?.[0] ?? "none");
  console.log("NO_EMPLOYEES  (S3 fallback):", noEmpS3?.[0] ?? "none");
  console.log("NO_PROFIT     (S2):", noProfit?.[0] ?? "none");
  console.log("FULL_DATA     (S1):", full?.[0] ?? "none");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
