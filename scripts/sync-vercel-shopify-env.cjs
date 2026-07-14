/**
 * Sync Shopify + CRON secrets from .env.local to Vercel project "stocky".
 * Uses Vercel CLI if logged in: npx vercel env add ...
 *
 * Run: node --env-file=.env.local scripts/sync-vercel-shopify-env.cjs
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const PROJECT = "stocky";
const TEAM = "tahiryahuzayusuf-6523s-projects";
const KEYS = [
  "SHOPIFY_API_KEY",
  "SHOPIFY_API_SECRET",
  "NEXT_PUBLIC_SHOPIFY_API_KEY",
  "CRON_SECRET",
];

function readEnvLocal() {
  const t = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
  const out = {};
  for (const key of KEYS) {
    const m = new RegExp(`^${key}=(.*)$`, "m").exec(t);
    if (m?.[1]?.trim()) out[key] = m[1].trim();
  }
  return out;
}

function run(args, input) {
  // Windows: npx is npx.cmd; shell required for PATH resolution
  return execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["--yes", "vercel", ...args],
    {
      input,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
      shell: process.platform === "win32",
    },
  );
}

function main() {
  const values = readEnvLocal();
  const missing = KEYS.filter((k) => !values[k]);
  if (missing.length) {
    console.error("Missing in .env.local:", missing.join(", "));
    process.exit(1);
  }

  for (const env of ["production", "preview", "development"]) {
    for (const key of KEYS) {
      try {
        run(["env", "rm", key, env, "--yes", "--scope", TEAM]);
        console.log(`removed ${key} (${env})`);
      } catch {
        // ignore if missing
      }
      try {
        run(
          ["env", "add", key, env, "--scope", TEAM],
          `${values[key]}\n`,
        );
        console.log(`set ${key} (${env})`);
      } catch (err) {
        console.error(`FAILED ${key} (${env}):`, err.stderr || err.message);
        process.exit(1);
      }
    }
  }
  console.log("Done. Redeploy required for env to take effect.");
}

main();
