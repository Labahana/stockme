import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isNextResponse, resolveShopContext } from "@/lib/api/shop-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { csvResponse, toCsv } from "@/lib/export/csv";

export const dynamic = "force-dynamic";

const supplierSchema = z.object({
  name: z.string().min(1),
  contact_name: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  lead_time_days: z.number().int().min(0).default(7),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveShopContext(request);
    if (isNextResponse(ctx)) return ctx;

    if (request.nextUrl.searchParams.get("export") === "csv") {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("shop_id", ctx.store.id)
        .order("name");
      if (error) throw error;
      return csvResponse(
        "suppliers.csv",
        toCsv(data ?? []),
      );
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("suppliers")
      .select("*, supplier_products(count)")
      .eq("shop_id", ctx.store.id)
      .order("name");

    if (error) throw error;
    return NextResponse.json({ suppliers: data ?? [] });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load suppliers" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveShopContext(request);
    if (isNextResponse(ctx)) return ctx;

    const parsed = supplierSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("suppliers")
      .insert({ shop_id: ctx.store.id, ...parsed.data, email: parsed.data.email || null })
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ supplier: data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create supplier" }, { status: 500 });
  }
}
