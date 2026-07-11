/**
 * Trigger a production redeploy on Vercel (picks up new env vars).
 * Usage: node scripts/redeploy-vercel.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const TEAM_ID = "team_DWQlH17f8SpI619lg5jjXtwF";
const PROJECT_NAME = "stocky";
const DEPLOYMENT_ID = "dpl_5mG8jEaEMAbbBDeFeW7iukGNywxv";

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

async function main() {
  const token = loadToken();
  const url = `https://api.vercel.com/v13/deployments?teamId=${TEAM_ID}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: PROJECT_NAME,
      deploymentId: DEPLOYMENT_ID,
      target: "production",
    }),
  });

  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Redeploy failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = JSON.parse(body);
  console.log("Redeploy started.");
  console.log("URL:", data.url ? `https://${data.url}` : data.alias?.[0] ?? "(check Vercel dashboard)");
  console.log("Inspector:", `https://vercel.com/tahiryahuzayusuf-6523s-projects/stocky`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
