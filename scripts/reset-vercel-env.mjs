/**
 * Reset Vercel env vars from .env.local (Production + Preview + Development).
 * Usage: node scripts/reset-vercel-env.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const TEAM_ID = "team_DWQlH17f8SpI619lg5jjXtwF";
const PROJECT_ID = "prj_v5c1oeH5HblCM31zvAJKJXuhJPNn";
const TARGETS = ["production", "preview", "development"];

function loadToken() {
  const paths = [
    join(homedir(), "AppData", "Roaming", "xdg.data", "com.vercel.cli", "auth.json"),
    join(homedir(), ".config", "com.vercel.cli", "auth.json"),
  ];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    const auth = JSON.parse(readFileSync(p, "utf8"));
    if (auth.token) return auth.token;
  }
  throw new Error("Vercel auth.json not found — run: npx vercel login");
}

function parseEnvLocal() {
  const raw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
  const vars = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (value) vars[key] = value;
  }
  return vars;
}

async function api(token, path, options = {}) {
  const url = `https://api.vercel.com${path}${path.includes("?") ? "&" : "?"}teamId=${TEAM_ID}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return body;
}

async function main() {
  const token = loadToken();
  const desired = parseEnvLocal();

  console.log("Fetching existing env vars…");
  const { envs = [] } = await api(token, `/v9/projects/${PROJECT_ID}/env`);

  if (envs.length) {
    console.log(`Removing ${envs.length} existing var(s)…`);
    for (const env of envs) {
      await api(token, `/v9/projects/${PROJECT_ID}/env/${env.id}`, { method: "DELETE" });
      console.log(`  removed ${env.key}`);
    }
  } else {
    console.log("No existing env vars.");
  }

  console.log(`Adding ${Object.keys(desired).length} var(s)…`);
  for (const [key, value] of Object.entries(desired)) {
    await api(token, `/v10/projects/${PROJECT_ID}/env`, {
      method: "POST",
      body: JSON.stringify({
        key,
        value,
        type: key.startsWith("NEXT_PUBLIC_") ? "plain" : "encrypted",
        target: TARGETS,
      }),
    });
    console.log(`  added ${key}`);
  }

  console.log("\nDone. Redeploy in Vercel for NEXT_PUBLIC_* to take effect.");
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
