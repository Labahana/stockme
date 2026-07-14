/**
 * Ensures CRON_SECRET exists in .env.local and attempts to push to Vercel.
 * Run: node scripts/setup-cron-secret.cjs
 */
const { randomBytes } = require("crypto");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const envPath = path.join(process.cwd(), ".env.local");
let local = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
const existing = /^CRON_SECRET=(.*)$/m.exec(local);
let secret = existing?.[1]?.trim();

if (!secret) {
  secret = randomBytes(32).toString("hex");
  fs.appendFileSync(
    envPath,
    `\n# Free-tier cron auth (Vercel Cron Bearer token)\nCRON_SECRET=${secret}\n`,
  );
  console.log("Appended CRON_SECRET to .env.local");
} else {
  console.log("CRON_SECRET already set in .env.local");
}

try {
  execSync("npx vercel --version", { stdio: "pipe" });
} catch {
  console.log("Install Vercel CLI and run: npx vercel env add CRON_SECRET production");
  process.exit(0);
}

for (const env of ["production", "preview", "development"]) {
  try {
    execSync(`npx vercel env rm CRON_SECRET ${env} -y`, { stdio: "pipe" });
  } catch {
    // ignore missing
  }
  try {
    execSync(`npx vercel env add CRON_SECRET ${env}`, {
      input: `${secret}\n`,
      stdio: ["pipe", "pipe", "pipe"],
    });
    console.log(`Set CRON_SECRET on Vercel (${env})`);
  } catch (err) {
    console.log(`Could not set Vercel ${env}: set CRON_SECRET in the Vercel dashboard`);
  }
}
