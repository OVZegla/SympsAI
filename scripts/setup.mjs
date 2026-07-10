/**
 * npm run setup — installation en une commande.
 *
 * 1. Vérifie Docker.
 * 2. Démarre la stack Supabase locale (Postgres + Auth + Storage, volumes
 *    persistants) et applique migrations + seed.
 * 3. Écrit .env.local avec les identifiants locaux.
 * 4. Crée le premier compte administrateur.
 * 5. Télécharge les modèles Ollama (embeddings + LLM local, gratuits).
 *
 * Sûr à relancer : ne réinitialise la base QUE lors de la première
 * installation (jamais quand des données existent déjà).
 */
import { existsSync } from "node:fs";
import path from "node:path";
import {
  SUPABASE,
  ROOT,
  run,
  runCapture,
  log,
  warn,
  fail,
  hasCommand,
  dockerRunning,
  supabaseStatusEnv,
  writeEnvLocal,
  ensureOllama,
} from "./lib.mjs";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@symps.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "symps-admin";
const PULL_VISION = process.argv.includes("--vision");

async function createAdminUser({ url, service }) {
  const headers = {
    apikey: service,
    Authorization: `Bearer ${service}`,
    "Content-Type": "application/json",
  };

  // 1. Create the auth user (idempotent).
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Admin", role: "admin" },
    }),
  });
  let userId = null;
  if (res.ok) {
    userId = (await res.json().catch(() => ({}))).id ?? null;
    log(`Compte admin créé : ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  } else {
    const body = await res.text().catch(() => "");
    if (/already|exists|registered/i.test(body) || res.status === 422) {
      log(`Compte admin déjà présent (${ADMIN_EMAIL}).`);
    } else {
      warn(`Création du compte admin impossible (HTTP ${res.status}) : ${body.slice(0, 200)}`);
      return;
    }
  }

  // 2. Resolve the user id (needed to create the profile) if not just created.
  if (!userId) {
    const list = await fetch(`${url}/auth/v1/admin/users?per_page=500`, { headers }).catch(() => null);
    if (list?.ok) {
      const json = await list.json().catch(() => ({}));
      userId = (json.users ?? []).find((u) => u.email === ADMIN_EMAIL)?.id ?? null;
    }
  }
  if (!userId) {
    warn("Impossible de récupérer l'identifiant du compte admin — profil non créé.");
    return;
  }

  // 3. Resolve the organization id (seed uses a fixed UUID, but query to be safe).
  let orgId = "00000000-0000-0000-0000-000000000001";
  const orgRes = await fetch(`${url}/rest/v1/organizations?select=id&limit=1`, { headers }).catch(() => null);
  if (orgRes?.ok) {
    const orgs = await orgRes.json().catch(() => []);
    if (orgs[0]?.id) orgId = orgs[0].id;
  }

  // 4. Create/repair the profile deterministically (no trigger dependency).
  const profRes = await fetch(`${url}/rest/v1/profiles`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      id: userId,
      organization_id: orgId,
      email: ADMIN_EMAIL,
      full_name: "Admin",
      role: "admin",
    }),
  }).catch(() => null);
  if (profRes?.ok) {
    log("Profil admin rattaché (rôle admin).");
  } else {
    warn(`Profil admin non créé : ${profRes ? await profRes.text().catch(() => "") : "réseau"}`);
  }
}

async function main() {
  log("Installation de Symp's AI…");

  // 1. Docker
  if (!hasCommand("docker")) {
    fail("Docker est requis. Installe Docker Desktop : https://docs.docker.com/get-docker/");
  }
  if (!dockerRunning()) {
    fail("Docker est installé mais ne tourne pas. Démarre Docker Desktop puis relance `npm run setup`.");
  }

  // 2. Supabase local stack (idempotent: `start` on an already-running stack is a no-op).
  // "First install" is keyed on .env.local (written at the END of setup), NOT on
  // whether the stack is up — so a retry after a failed install still does a
  // clean `db reset` rather than a partial `migration up`.
  const firstInstall = !existsSync(path.join(ROOT, ".env.local"));
  const alreadyRunning = supabaseStatusEnv() !== null;
  log(alreadyRunning ? "Base locale déjà démarrée." : "Démarrage de la base locale (premier lancement : quelques minutes)…");
  if (!alreadyRunning) {
    const started = run(SUPABASE[0], [...SUPABASE.slice(1), "start"]);
    if (started.status !== 0) fail("Échec du démarrage de Supabase local.");
  }

  // Apply migrations (idempotent). On a brand-new database, also run the seed
  // via db reset — never on an existing one (data preservation).
  if (firstInstall) {
    log("Application du schéma + données de départ…");
    const reset = run(SUPABASE[0], [...SUPABASE.slice(1), "db", "reset"]);
    if (reset.status !== 0) fail("Échec de l'initialisation de la base.");
  } else {
    log("Application des migrations en attente…");
    const up = runCapture(SUPABASE[0], [...SUPABASE.slice(1), "migration", "up"]);
    if (up.status !== 0) warn("`migration up` a échoué — vérifie `npx supabase migration up`.");
  }

  // 3. Credentials → .env.local
  const creds = supabaseStatusEnv();
  if (!creds) fail("Impossible de lire les identifiants Supabase locaux.");
  writeEnvLocal(creds);

  // 4. First admin account
  await createAdminUser(creds);

  // 5. Ollama models (free local AI)
  if (await ensureOllama()) {
    const models = ["embeddinggemma", "qwen2.5", ...(PULL_VISION ? ["llama3.2-vision"] : [])];
    for (const model of models) {
      log(`Téléchargement du modèle ${model}…`);
      const pull = run("ollama", ["pull", model]);
      if (pull.status !== 0) warn(`Échec du téléchargement de ${model} (relance : ollama pull ${model}).`);
    }
    if (!PULL_VISION) {
      log("Analyse d'images : optionnelle — `npm run setup -- --vision` pour télécharger llama3.2-vision (~8 Go).");
    }
  } else {
    warn("Ollama introuvable — installe-le (https://ollama.com/download) pour l'assistant IA local.");
    warn("Sans Ollama : incidents, machines, clients et recherche par mots-clés fonctionnent quand même.");
  }

  console.log("");
  log("✅ Installation terminée.");
  log(`   Connexion : ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}  (change le mot de passe !)`);
  log("   Lancer l'application : npm start");
}

main().catch((err) => fail(err?.message || String(err)));
