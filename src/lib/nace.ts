/**
 * nace.ts — Shared NACE division list
 *
 * Single source of truth for the 21-sector NACE list used in:
 *   - /onboarding (sector selection)
 *   - /admin/publications/new (upload UI NACE picker)
 *
 * Values match the NACE 2-digit division codes used in briefs.nace_sector
 * and analysis_jobs.nace_division (docs/engineering/n8n-integration.md §4).
 *
 * PM owns this list. Changes require a decision-log entry if sectors are
 * added or removed (brief audience changes). Name corrections are editorial.
 */

export interface NaceSector {
  code: string; // 2-digit NACE division code, e.g. "49"
  name: string; // Czech label
}

export const NACE_SECTORS: NaceSector[] = [
  { code: "10", name: "Výroba potravinářských výrobků" },
  { code: "11", name: "Výroba nápojů" },
  { code: "13", name: "Výroba textilií" },
  { code: "14", name: "Výroba oděvů" },
  { code: "16", name: "Zpracování dřeva a výroba dřevěných výrobků" },
  { code: "17", name: "Výroba papíru a výrobků z papíru" },
  { code: "20", name: "Výroba chemických látek" },
  { code: "22", name: "Výroba pryžových a plastových výrobků" },
  { code: "25", name: "Výroba kovových konstrukcí" },
  { code: "28", name: "Výroba strojů a zařízení" },
  { code: "41", name: "Výstavba budov" },
  { code: "43", name: "Specializované stavební činnosti" },
  { code: "45", name: "Velkoobchod a maloobchod s motorovými vozidly" },
  { code: "46", name: "Velkoobchod (kromě motorových vozidel)" },
  { code: "47", name: "Maloobchod (kromě motorových vozidel)" },
  { code: "55", name: "Ubytování" },
  { code: "56", name: "Stravování a pohostinství" },
  { code: "62", name: "Činnosti v oblasti informačních technologií" },
  { code: "63", name: "Informační služby" },
  { code: "71", name: "Architektonické a inženýrské činnosti" },
  { code: "74", name: "Ostatní odborné, vědecké a technické činnosti" },
];
