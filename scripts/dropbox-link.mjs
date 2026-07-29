/**
 * `npm run dropbox:link` — assistant de liaison du compte Dropbox (une seule
 * fois). Guide la création d'une app Dropbox, fait l'autorisation OAuth et
 * stocke un REFRESH token (longue durée) dans .env.local, côté serveur
 * uniquement. Aucune appli Dropbox à installer : l'app fouille le cloud via
 * l'API.
 */
import { createInterface } from "node:readline/promises";
import { log } from "./lib.mjs";
import {
  readEnvLocal,
  writeEnvLocal,
  setEnv,
  pickFolder,
} from "./dropbox-lib.mjs";

const rl = createInterface({ input: process.stdin, output: process.stdout });

console.log(`
┌────────────────────────────────────────────────────────────────┐
│  Liaison du compte Dropbox à Symp's AI                         │
└────────────────────────────────────────────────────────────────┘

Étape 1 — Crée une app Dropbox (2 minutes, une seule fois) :
  1. Ouvre  https://www.dropbox.com/developers/apps  (connecté à TON compte)
  2. « Create app » → choisis « Scoped access »
  3. Accès : « Full Dropbox » (ou « App folder » si tu préfères un dossier dédié)
  4. Donne un nom, ex. « SympsAI »
  5. Onglet « Permissions » : coche  files.metadata.read  et  files.content.read
     puis clique « Submit » en bas.
  6. Onglet « Settings » : tu y trouves  App key  et  App secret .
`);

const appKey = (await rl.question("App key : ")).trim();
const appSecret = (await rl.question("App secret : ")).trim();
if (!appKey || !appSecret) {
  log("❌ App key/secret requis. Relance quand tu les as.");
  process.exit(1);
}

console.log(`
Étape 2 — Autorise l'app sur ton compte :
  Ouvre ce lien dans ton navigateur, clique « Autoriser », puis copie le code affiché :

  https://www.dropbox.com/oauth2/authorize?client_id=${appKey}&response_type=code&token_access_type=offline
`);

const code = (await rl.question("Code d'autorisation : ")).trim();
if (!code) {
  log("❌ Code requis.");
  process.exit(1);
}

log("Échange du code contre un jeton longue durée…");
const res = await fetch("https://api.dropbox.com/oauth2/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: appKey,
    client_secret: appSecret,
  }),
});
if (!res.ok) {
  log(`❌ Dropbox a refusé (${res.status}) : ${await res.text()}`);
  log("Vérifie le code (il n'est valable que quelques minutes) et relance.");
  process.exit(1);
}
const json = await res.json();
if (!json.refresh_token) {
  log("❌ Pas de refresh token reçu — vérifie que le lien contenait bien token_access_type=offline.");
  process.exit(1);
}

// Étape 3 — choix du dossier dans une liste (pas de chemin à taper).
console.log("\nÉtape 3 — Choisis le dossier à synchroniser :");
const folder = await pickFolder(rl, json.access_token);
rl.close();

let env = readEnvLocal();
env = setEnv(env, "DROPBOX_APP_KEY", appKey);
env = setEnv(env, "DROPBOX_APP_SECRET", appSecret);
env = setEnv(env, "DROPBOX_REFRESH_TOKEN", json.refresh_token);
env = setEnv(env, "DROPBOX_FOLDER", folder);
writeEnvLocal(env);

log(
  `✅ Dropbox lié ! Dossier synchronisé : ${folder || "(tout le Dropbox)"} — ` +
    "configuration enregistrée dans .env.local (côté serveur uniquement).",
);
log("Redémarre l'app (Ctrl+C puis npm start), va sur Documents 📄 → « Synchroniser depuis Dropbox ».");
