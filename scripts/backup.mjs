/**
 * `npm run backup` — sauvegarde horodatée de la base locale (§ observabilité /
 * résilience). Produit un dump des DONNÉES dans backups/ (le schéma se
 * reconstruit avec les migrations). À lancer machine démarrée (Docker actif).
 *
 * Restauration : `npx supabase db reset` (schéma + seed) puis
 * `psql <db-url> -f backups/<fichier>.sql` — ou demander à l'assistant.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { ROOT, SUPABASE, run, log } from "./lib.mjs";

const stamp = new Date()
  .toISOString()
  .replace(/[-:]/g, "")
  .replace("T", "-")
  .slice(0, 13); // YYYYMMDD-HHMM

const dir = path.join(ROOT, "backups");
mkdirSync(dir, { recursive: true });
const file = path.join("backups", `symps-data-${stamp}.sql`);

log(`Sauvegarde des données vers ${file}…`);
const [cmd, ...base] = SUPABASE;
const result = run(cmd, [...base, "db", "dump", "--local", "--data-only", "-f", file]);

if (result.status === 0) {
  log(`✅ Sauvegarde terminée : ${file}`);
  log("Copie ce fichier sur un disque externe ou un cloud de temps en temps.");
} else {
  log("❌ La sauvegarde a échoué. La base locale est-elle démarrée ? (npm start)");
  process.exit(1);
}
