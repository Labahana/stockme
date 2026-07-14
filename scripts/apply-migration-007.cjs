/**
 * Apply free-tier follow-through SQL via Supabase Management API.
 * Requires SUPABASE_ACCESS_TOKEN (https://supabase.com/dashboard/account/tokens)
 * and NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_PROJECT_REF).
 *
 * Run: node --env-file=.env.local scripts/apply-migration-007.cjs
 */
const fs = require("fs");
const path = require("path");

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const ref =
    process.env.SUPABASE_PROJECT_REF?.trim() ||
    url.replace(/^https:\/\//, "").split(".")[0];

  if (!token) {
    console.error(
      "Missing SUPABASE_ACCESS_TOKEN. Create one at https://supabase.com/dashboard/account/tokens\n" +
        "Then either: set it in .env.local and re-run, or paste the SQL from\n" +
        "supabase/migrations/007_free_tier_followthrough.sql into the SQL Editor.",
    );
    process.exit(2);
  }
  if (!ref) {
    console.error("Missing project ref (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_PROJECT_REF)");
    process.exit(1);
  }

  const sqlPath = path.join(
    process.cwd(),
    "supabase/migrations/007_free_tier_followthrough.sql",
  );
  const query = fs.readFileSync(sqlPath, "utf8");

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    },
  );

  const body = await res.text();
  if (!res.ok) {
    console.error(`Migration failed (${res.status}): ${body}`);
    process.exit(1);
  }
  console.log("Applied 007_free_tier_followthrough");
  console.log(body.slice(0, 500));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
