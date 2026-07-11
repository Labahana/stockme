#!/usr/bin/env node
/**
 * Inventory list performance benchmark for 5k+ SKU shops.
 *
 * Usage:
 *   node scripts/load-test-inventory.mjs <shop_id> <location_id>
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env
 * (or a .env.local loaded via dotenv if you add it).
 *
 * Target: each inventory_list query < 1000ms at 5,000+ variants.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnvFile(name) {
  const path = resolve(process.cwd(), name);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const shopId = process.argv[2];
const locationId = process.argv[3];

if (!shopId || !locationId) {
  console.error("Usage: node scripts/load-test-inventory.mjs <shop_id> <location_id>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);
const TARGET_MS = 1000;
const results = [];

async function bench(label, fn) {
  const start = performance.now();
  const result = await fn();
  const ms = Math.round(performance.now() - start);
  const pass = ms < TARGET_MS;
  results.push({ label, ms, pass });
  console.log(`${pass ? "PASS" : "SLOW"} ${label}: ${ms}ms`, result);
  return ms;
}

const { count: variantCount } = await supabase
  .from("variants")
  .select("*", { count: "exact", head: true })
  .eq("shop_id", shopId);

console.log(`\nShop ${shopId}`);
console.log(`Variants: ${variantCount ?? 0}`);
console.log(`Target: < ${TARGET_MS}ms per query\n`);

if ((variantCount ?? 0) < 1000) {
  console.warn(
    "WARNING: fewer than 1,000 variants — results won't prove 5k-SKU performance.\n",
  );
}

await bench("inventory_list page 1 (50)", async () => {
  const { data, error } = await supabase.rpc("inventory_list", {
    p_shop_id: shopId,
    p_location_id: locationId,
    p_search: null,
    p_stock_status: "all",
    p_tag: null,
    p_vendor: null,
    p_limit: 50,
    p_offset: 0,
  });
  if (error) throw error;
  return { rows: data?.length ?? 0, total: data?.[0]?.total_count ?? 0 };
});

await bench("inventory_list page 20 (offset 950)", async () => {
  const { data, error } = await supabase.rpc("inventory_list", {
    p_shop_id: shopId,
    p_location_id: locationId,
    p_search: null,
    p_stock_status: "all",
    p_tag: null,
    p_vendor: null,
    p_limit: 50,
    p_offset: 950,
  });
  if (error) throw error;
  return { rows: data?.length ?? 0 };
});

await bench("inventory_list low_stock filter", async () => {
  const { data, error } = await supabase.rpc("inventory_list", {
    p_shop_id: shopId,
    p_location_id: locationId,
    p_search: null,
    p_stock_status: "low",
    p_tag: null,
    p_vendor: null,
    p_limit: 50,
    p_offset: 0,
  });
  if (error) throw error;
  return { rows: data?.length ?? 0 };
});

await bench("inventory_list search SKU", async () => {
  const { data, error } = await supabase.rpc("inventory_list", {
    p_shop_id: shopId,
    p_location_id: locationId,
    p_search: "SKU",
    p_stock_status: "all",
    p_tag: null,
    p_vendor: null,
    p_limit: 50,
    p_offset: 0,
  });
  if (error) throw error;
  return { rows: data?.length ?? 0 };
});

await bench("store_vendors", async () => {
  const { data, error } = await supabase.rpc("store_vendors", {
    p_shop_id: shopId,
  });
  if (error) throw error;
  return { vendors: data?.length ?? 0 };
});

await bench("store_tags", async () => {
  const { data, error } = await supabase.rpc("store_tags", {
    p_shop_id: shopId,
  });
  if (error) throw error;
  return { tags: data?.length ?? 0 };
});

const failed = results.filter((r) => !r.pass);
console.log("\n--- Summary ---");
for (const r of results) {
  console.log(`${r.pass ? "✓" : "✗"} ${r.label}: ${r.ms}ms`);
}
console.log(
  failed.length === 0
    ? `\nAll ${results.length} queries under ${TARGET_MS}ms.`
    : `\n${failed.length}/${results.length} queries exceeded ${TARGET_MS}ms.`,
);

process.exit(failed.length > 0 ? 1 : 0);
