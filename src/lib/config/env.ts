/** Runtime env checks for production deployments. */
export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function validateProductionEnv() {
  const missing: string[] = [];
  const required = [
    "NEXT_PUBLIC_APP_URL",
    "SHOPIFY_API_KEY",
    "SHOPIFY_API_SECRET",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
  ];

  for (const key of required) {
    if (!process.env[key]) missing.push(key);
  }

  return { ok: missing.length === 0, missing };
}
