/**
 * `npm run dropbox:folder` — change le dossier Dropbox synchronisé, sans
 * refaire toute la liaison. Liste les dossiers du compte et fait choisir par
 * numéro (évite les chemins tapés à côté).
 */
import { createInterface } from "node:readline/promises";
import { log } from "./lib.mjs";
import {
  readEnvLocal,
  writeEnvLocal,
  getEnvValue,
  setEnv,
  accessTokenFromRefresh,
  pickFolder,
} from "./dropbox-lib.mjs";

const env = readEnvLocal();
const appKey = getEnvValue(env, "DROPBOX_APP_KEY");
const appSecret = getEnvValue(env, "DROPBOX_APP_SECRET");
const refreshToken = getEnvValue(env, "DROPBOX_REFRESH_TOKEN");

if (!appKey || !appSecret || !refreshToken) {
  log("❌ Dropbox n'est pas encore lié. Lance d'abord : npm run dropbox:link");
  process.exit(1);
}

log("Connexion à Dropbox…");
let token;
try {
  token = await accessTokenFromRefresh(appKey, appSecret, refreshToken);
} catch (err) {
  log(`❌ ${err.message}`);
  log("Si le problème persiste, relance : npm run dropbox:link");
  process.exit(1);
}

const current = getEnvValue(env, "DROPBOX_FOLDER");
console.log(`\nDossier actuellement configuré : ${current || "(tout le Dropbox)"}`);

const rl = createInterface({ input: process.stdin, output: process.stdout });
const folder = await pickFolder(rl, token);
rl.close();

writeEnvLocal(setEnv(env, "DROPBOX_FOLDER", folder));

log(`✅ Dossier synchronisé : ${folder || "(tout le Dropbox)"}`);
log("Redémarre l'app (Ctrl+C puis npm start), puis clique « Synchroniser depuis Dropbox ».");
