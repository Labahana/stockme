import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isNextResponse, resolveShopContext } from "@/lib/api/shop-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { csvResponse, toCsv } from "@/lib/export/csv";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveShopContext(request);
    if (isNextResponse(ctx)) return ctx;

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("stocktakes")
      .select("*, locations(name)")
      .eq("shop_id", ctx.store.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (request.nextUrl.searchParams.get("export") === "csv") {
      return csvResponse("stocktakes.csv", toCsv(data ?? []));
    }

    return NextResponse.json({ stocktakes: data ?? [] });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load stocktakes" }, { status: 500 });
  }
}

const createSchema = z.object({
  locationId: z.string().uuid(),
  name: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveShopContext(request);
    if (isNextResponse(ctx)) return ctx;

    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: stocktake, error } = await supabase
      .from("stocktakes")
      .insert({
        shop_id: ctx.store.id,
        location_id: parsed.data.locationId,
        name: parsed.data.name,
        status: "in_progress",
      })
      .select("*")
      .single();

    if (error) throw error;

    const { data: levels } = await supabase
      .from("inventory_levels")
      .select("variant_id, available")
      .eq("shop_id", ctx.store.id)
      .eq("location_id", parsed.data.locationId);

    if (levels?.length) {
      await supabase.from("stocktake_lines").insert(
        levels.map((l) => ({
          shop_id: ctx.store.id,
          stocktake_id: stocktake.id,
          variant_id: l.variant_id,
          system_qty: l.available,
        })),
      );
    }

    return NextResponse.json({ stocktake });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create stocktake" }, { status: 500 });
  }
}
