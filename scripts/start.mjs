/**
 * npm start — tout se met en route tout seul.
 *
 * 1. Démarre la base locale si besoin (les données persistent entre les
 *    sessions : volumes Docker).
 * 2. Applique les migrations en attente.
 * 3. Démarre Ollama si besoin (IA locale).
 * 4. Lance l'application et ouvre le navigateur.
 *
 * Quitter (Ctrl+C) arrête l'application ; la base continue en arrière-plan et
 * tout est sauvegardé. `npm run stop` arrête aussi la base (données conservées).
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  SUPABASE,
  run,
  runCapture,
  log,
  warn,
  fail,
  supabaseStatusEnv,
  writeEnvLocal,
  ensureOllama,
  openBrowser,
  ROOT,
} from "./lib.mjs";

const APP_URL = "http://localhost:3000";

async function main() {
  // 0. First run? Run the full setup automatically (DB + schema + admin +
  //    AI models) so a single `npm start` — or a double-click on the
  //    launcher — is enough from a fresh clone.
  if (!existsSync(path.join(ROOT, ".env.local"))) {
    log("Première utilisation détectée — installation automatique…");
    const setup = run("node", [path.join(ROOT, "scripts", "setup.mjs")]);
    if (setup.status !== 0) fail("L'installation automatique a échoué (voir messages ci-dessus).");
  }

  // 1. Database (persistent across restarts)
  let creds = supabaseStatusEnv();
  if (!creds) {
    log("Démarrage de la base locale…");
    const started = run(SUPABASE[0], [...SUPABASE.slice(1), "start"]);
    if (started.status !== 0) {
      fail("Base locale indisponible. Lance `npm run setup` (première installation) ou vérifie Docker.");
    }
    creds = supabaseStatusEnv();
  }
  if (!creds) fail("Impossible de lire les identifiants Supabase. Lance `npm run setup`.");
  writeEnvLocal(creds);

  // 2. Pending migrations (idempotent, fast)
  runCapture(SUPABASE[0], [...SUPABASE.slice(1), "migration", "up"]);

  // 3. Local AI
  if (await ensureOllama()) {
    log("Ollama : OK (IA locale prête).");
  } else {
    warn("Ollama indisponible — l'assistant IA et la recherche sémantique seront inactifs.");
  }

  // 4. App + browser
  log(`Démarrage de l'application… (${APP_URL})`);
  const isWin = process.platform === "win32";
  const app = spawn("npx", ["--yes", "next", "dev"], {
    cwd: ROOT,
    stdio: ["inherit", "pipe", "inherit"],
    shell: isWin,
  });

  let opened = false;
  app.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    process.stdout.write(text);
    if (!opened && /ready|started server|local:/i.test(text)) {
      opened = true;
      openBrowser(APP_URL);
      log("Navigateur ouvert. Ctrl+C pour quitter — tout est sauvegardé automatiquement.");
    }
  });

  const stop = () => {
    app.kill("SIGINT");
    log("Application arrêtée. Données sauvegardées (base toujours active : `npm run stop` pour l'arrêter).");
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  app.on("exit", (code) => process.exit(code ?? 0));
}

main().catch((err) => fail(err?.message || String(err)));
