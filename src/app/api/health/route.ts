import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateProductionEnv } from "@/lib/config/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const envCheck = validateProductionEnv();
  let dbOk = false;

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("stores").select("id").limit(1);
    dbOk = !error;
  } catch {
    dbOk = false;
  }

  const ok = envCheck.ok && dbOk;

  return NextResponse.json(
    {
      ok,
      app: "stockme",
      version: "1.0.0",
      checks: {
        env: envCheck.ok,
        database: dbOk,
        missingEnv: envCheck.missing,
      },
    },
    { status: ok ? 200 : 503 },
  );
}
