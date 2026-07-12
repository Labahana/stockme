import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isNextResponse, resolveShopContext } from "@/lib/api/shop-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { nextTransferNumber } from "@/lib/po/number";
import { csvResponse, toCsv } from "@/lib/export/csv";
// import { assertTransfersAllowed } from "@/lib/billing/limits";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveShopContext(request);
    if (isNextResponse(ctx)) return ctx;

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("stock_transfers")
      .select(
        `*, from_location:locations!stock_transfers_from_location_id_fkey(name),
         to_location:locations!stock_transfers_to_location_id_fkey(name),
         stock_transfer_lines(count)`,
      )
      .eq("shop_id", ctx.store.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (request.nextUrl.searchParams.get("export") === "csv") {
      return csvResponse("transfers.csv", toCsv(data ?? []));
    }

    return NextResponse.json({ transfers: data ?? [] });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load transfers" }, { status: 500 });
  }
}

const createSchema = z.object({
  fromLocationId: z.string().uuid(),
  toLocationId: z.string().uuid(),
  notes: z.string().optional(),
  lines: z.array(
    z.object({
      variantId: z.string().uuid(),
      quantity: z.number().int().min(1),
    }),
  ).min(1),
});

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveShopContext(request);
    if (isNextResponse(ctx)) return ctx;

    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Plan-limit enforcement disabled for initial dev/testing.
    // const locationError = assertTransfersAllowed(ctx.store);
    // if (locationError) {
    //   return NextResponse.json({ error: locationError }, { status: 403 });
    // }

    const supabase = createAdminClient();
    const transferNumber = await nextTransferNumber(ctx.store.id);

    const { data: transfer, error } = await supabase
      .from("stock_transfers")
      .insert({
        shop_id: ctx.store.id,
        transfer_number: transferNumber,
        from_location_id: parsed.data.fromLocationId,
        to_location_id: parsed.data.toLocationId,
        status: "draft",
        notes: parsed.data.notes ?? null,
      })
      .select("*")
      .single();

    if (error) throw error;

    await supabase.from("stock_transfer_lines").insert(
      parsed.data.lines.map((l) => ({
        shop_id: ctx.store.id,
        stock_transfer_id: transfer.id,
        variant_id: l.variantId,
        quantity: l.quantity,
      })),
    );

    return NextResponse.json({ transfer });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create transfer" }, { status: 500 });
  }
}
