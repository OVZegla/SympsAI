/**
 * Shared helpers for the setup/start/stop scripts. Node-only (no app imports),
 * cross-platform (Windows/macOS/Linux).
 */
import { spawnSync, spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const IS_WIN = process.platform === "win32";

/** The pinned Supabase CLI, run via npx (no global install needed). */
export const SUPABASE = ["npx", "--yes", "supabase@2"];

export function run(cmd, args, options = {}) {
  return spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: options.quiet ? "pipe" : "inherit",
    shell: IS_WIN,
    encoding: "utf8",
    ...options,
  });
}

export function runCapture(cmd, args) {
  return spawnSync(cmd, args, { cwd: ROOT, stdio: "pipe", shell: IS_WIN, encoding: "utf8" });
}

export function log(msg) {
  console.log(`\x1b[36m[symps]\x1b[0m ${msg}`);
}
export function warn(msg) {
  console.log(`\x1b[33m[symps]\x1b[0m ${msg}`);
}
export function fail(msg) {
  console.error(`\x1b[31m[symps]\x1b[0m ${msg}`);
  process.exit(1);
}

export function hasCommand(cmd) {
  const probe = IS_WIN ? runCapture("where", [cmd]) : runCapture("which", [cmd]);
  return probe.status === 0;
}

export function dockerRunning() {
  return runCapture("docker", ["info"]).status === 0;
}

/** `supabase status -o env`, parsed; null when the stack is not running. */
export function supabaseStatusEnv() {
  const res = runCapture(SUPABASE[0], [...SUPABASE.slice(1), "status", "-o", "env"]);
  if (res.status !== 0) return null;
  const env = {};
  for (const line of (res.stdout || "").split("\n")) {
    const m = /^([A-Z_]+)="?([^"]*)"?\s*$/.exec(line.trim());
    if (m) env[m[1]] = m[2];
  }
  const url = env.API_URL || env.SUPABASE_URL;
  const anon = env.ANON_KEY || env.SUPABASE_ANON_KEY;
  const service = env.SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  return url && anon && service ? { url, anon, service } : null;
}

/** Merge Supabase credentials into .env.local, preserving any other lines. */
export function writeEnvLocal({ url, anon, service }) {
  const envPath = path.join(ROOT, ".env.local");
  const managed = {
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
    SUPABASE_SERVICE_ROLE_KEY: service,
  };
  let lines = [];
  if (existsSync(envPath)) {
    lines = readFileSync(envPath, "utf8")
      .split("\n")
      .filter((line) => !Object.keys(managed).some((k) => line.startsWith(`${k}=`)));
    while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  }
  for (const [k, v] of Object.entries(managed)) lines.push(`${k}=${v}`);
  writeFileSync(envPath, lines.join("\n") + "\n");
  log(`.env.local mis à jour (Supabase local).`);
}

export async function ollamaReachable(baseUrl = "http://127.0.0.1:11434") {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${baseUrl}/api/tags`, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

/** Try to start `ollama serve` detached (desktop installs usually auto-run). */
export async function ensureOllama() {
  if (await ollamaReachable()) return true;
  if (!hasCommand("ollama")) return false;
  try {
    const child = spawn("ollama", ["serve"], {
      detached: true,
      stdio: "ignore",
      shell: IS_WIN,
    });
    child.unref();
  } catch {
    return false;
  }
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await ollamaReachable()) return true;
  }
  return false;
}

export function openBrowser(url) {
  const opener =
    process.platform === "darwin" ? ["open", [url]]
    : IS_WIN ? ["cmd", ["/c", "start", "", url]]
    : ["xdg-open", [url]];
  try {
    spawn(opener[0], opener[1], { detached: true, stdio: "ignore", shell: IS_WIN }).unref();
  } catch {
    // Non-fatal: the URL is printed anyway.
  }
}
