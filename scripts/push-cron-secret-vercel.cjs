/**
 * Push CRON_SECRET from .env.local to Vercel via API.
 * Requires VERCEL_TOKEN (https://vercel.com/account/tokens).
 * Optional: VERCEL_PROJECT_ID or VERCEL_PROJECT_NAME, VERCEL_TEAM_ID / VERCEL_ORG_ID
 *
 * Run: node --env-file=.env.local scripts/push-cron-secret-vercel.cjs
 */
const fs = require("fs");
const path = require("path");

function readLocalCronSecret() {
  const envPath = path.join(process.cwd(), ".env.local");
  const local = fs.readFileSync(envPath, "utf8");
  const match = /^CRON_SECRET=(.*)$/m.exec(local);
  return match?.[1]?.trim() || "";
}

async function main() {
  const token = process.env.VERCEL_TOKEN?.trim();
  const secret = process.env.CRON_SECRET?.trim() || readLocalCronSecret();
  if (!token) {
    console.error(
      "Missing VERCEL_TOKEN. Create one at https://vercel.com/account/tokens\n" +
        "Or set CRON_SECRET manually in Vercel → Project → Settings → Environment Variables.",
    );
    process.exit(2);
  }
  if (!secret) {
    console.error("Missing CRON_SECRET in env / .env.local");
    process.exit(1);
  }

  const teamId =
    process.env.VERCEL_TEAM_ID?.trim() || process.env.VERCEL_ORG_ID?.trim();
  const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";

  let projectId = process.env.VERCEL_PROJECT_ID?.trim();
  if (!projectId) {
    const name = process.env.VERCEL_PROJECT_NAME?.trim() || "stocky";
    const listRes = await fetch(`https://api.vercel.com/v9/projects${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const list = await listRes.json();
    if (!listRes.ok) {
      console.error("List projects failed:", JSON.stringify(list));
      process.exit(1);
    }
    const project = (list.projects || []).find(
      (p) => p.name === name || p.name === "stockme",
    );
    if (!project) {
      console.error(
        `Project "${name}" not found. Set VERCEL_PROJECT_ID or VERCEL_PROJECT_NAME.`,
      );
      process.exit(1);
    }
    projectId = project.id;
    console.log(`Using project ${project.name} (${projectId})`);
  }

  // Remove existing CRON_SECRET envs (all targets)
  const getRes = await fetch(
    `https://api.vercel.com/v9/projects/${projectId}/env${qs}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const envs = await getRes.json();
  for (const env of envs.envs || []) {
    if (env.key !== "CRON_SECRET") continue;
    await fetch(
      `https://api.vercel.com/v9/projects/${projectId}/env/${env.id}${qs}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    console.log(`Removed old CRON_SECRET (${(env.target || []).join(",")})`);
  }

  const createRes = await fetch(
    `https://api.vercel.com/v10/projects/${projectId}/env${qs}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        key: "CRON_SECRET",
        value: secret,
        type: "encrypted",
        target: ["production", "preview", "development"],
      }),
    },
  );
  const created = await createRes.json();
  if (!createRes.ok) {
    console.error("Failed to set CRON_SECRET:", JSON.stringify(created));
    process.exit(1);
  }
  console.log("CRON_SECRET set on Vercel (production, preview, development)");
  console.log("Redeploy for the cron job to pick up the new secret.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
