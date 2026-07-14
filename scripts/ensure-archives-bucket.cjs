/**
 * Ensures the private `archives` Storage bucket exists.
 * Run: node --env-file=.env.local scripts/ensure-archives-bucket.cjs
 */
const { createClient } = require("@supabase/supabase-js");

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw listError;

  const exists = buckets?.some((b) => b.name === "archives" || b.id === "archives");
  if (exists) {
    console.log("archives bucket already exists");
    return;
  }

  const { error } = await supabase.storage.createBucket("archives", {
    public: false,
    fileSizeLimit: 52_428_800,
  });
  if (error) throw error;
  console.log("created archives bucket");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
