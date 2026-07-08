/**
 * Eval runner scaffold (spec §50-§52). Loads the case files and, once the
 * retrieval pipeline (Phase 3) and assistant (Phase 4) exist, checks:
 *   - retrieval recall (is the expected doc/incident in the top-K?)
 *   - citation correctness
 *   - first-action quality
 *
 * Today it only loads and reports the cases so the harness is ready. Wire the
 * assertions when Phase 3 lands. Run with: `npm run evals`.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

interface EvalCase {
  id: string;
  description: string;
  machine_model: string;
  problem: string;
  extra_information?: string;
  expected_procedure?: string;
  expected_incident?: string;
  expected_first_action?: string;
}

function loadCases(): EvalCase[] {
  const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "cases");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as EvalCase);
}

function main() {
  const cases = loadCases();
  console.log(`Loaded ${cases.length} eval case(s).`);
  for (const c of cases) {
    console.log(`\n- ${c.id}: ${c.description}`);
    console.log(`  expected procedure: ${c.expected_procedure ?? "—"}`);
    console.log(`  expected incident:  ${c.expected_incident ?? "—"}`);
    // TODO (Phase 3+): run retrieval, assert recall + first-action quality.
  }
  console.log("\nAssertions are enabled once the retrieval pipeline exists (Phase 3).");
}

main();
