/**
 * Compute the next incident number from the most recent one.
 * Pure and unit-tested (tests/incident-number.test.ts) so the numbering rule is
 * verifiable independently of the database.
 *
 * Format: INC-0001, INC-0002, … (spec §11 incident_number, §20 examples).
 */
export function computeNextIncidentNumber(lastNumber: string | null): string {
  const lastNum = lastNumber ? parseInt(lastNumber.replace(/\D/g, ""), 10) : 0;
  const next = Number.isFinite(lastNum) && lastNum > 0 ? lastNum + 1 : 1;
  return `INC-${String(next).padStart(4, "0")}`;
}
