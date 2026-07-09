/**
 * npm run stop — arrête la base locale. Les données sont CONSERVÉES (volumes
 * Docker) et seront retrouvées au prochain `npm start`.
 */
import { SUPABASE, run, log } from "./lib.mjs";

const res = run(SUPABASE[0], [...SUPABASE.slice(1), "stop"]);
if (res.status === 0) {
  log("Base locale arrêtée. Données conservées — `npm start` pour reprendre.");
} else {
  log("La base locale ne semblait pas démarrée.");
}
