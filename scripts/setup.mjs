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
import {
  SUPABASE,
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
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (/already|exists|registered/i.test(body) || res.status === 422) {
      log(`Compte admin déjà présent (${ADMIN_EMAIL}).`);
    } else {
      warn(`Création du compte admin impossible (HTTP ${res.status}) : ${body.slice(0, 200)}`);
      return;
    }
  } else {
    log(`Compte admin créé : ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  }
  // Promote to admin (the profile trigger defaults to the metadata role, but
  // enforce it in case the account pre-existed with another role).
  await fetch(`${url}/rest/v1/profiles?email=eq.${encodeURIComponent(ADMIN_EMAIL)}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify({ role: "admin" }),
  }).catch(() => warn("Impossible de forcer le rôle admin (vérifie la table profiles)."));
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
  const alreadyRunning = supabaseStatusEnv() !== null;
  const firstInstall = !alreadyRunning;
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
