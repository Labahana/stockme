import { NextRequest, NextResponse } from "next/server";
import { isNextResponse, resolveShopContext } from "@/lib/api/shop-context";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  adjustShopifyInventory,
  inventoryItemGid,
  locationGid,
} from "@/lib/shopify/inventory";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ctx = await resolveShopContext(request);
    if (isNextResponse(ctx)) return ctx;

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("stocktakes")
      .select(`*, locations(name), stocktake_lines(*, variants(sku, title, barcode))`)
      .eq("id", params.id)
      .eq("shop_id", ctx.store.id)
      .single();

    if (error) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ stocktake: data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load stocktake" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ctx = await resolveShopContext(request);
    if (isNextResponse(ctx)) return ctx;

    const body = await request.json();
    const supabase = createAdminClient();

    if (body.action === "count" || (body.variantId && body.countedQty != null)) {
      let variantId = body.variantId as string | undefined;

      if (body.barcode) {
        const { data: variant } = await supabase
          .from("variants")
          .select("id")
          .eq("shop_id", ctx.store.id)
          .eq("barcode", body.barcode)
          .maybeSingle();
        if (!variant) {
          return NextResponse.json({ error: "Barcode not found" }, { status: 404 });
        }
        variantId = variant.id;
      }

      if (!variantId) {
        return NextResponse.json({ error: "variantId required" }, { status: 400 });
      }

      const { data: stocktake } = await supabase
        .from("stocktakes")
        .select("id, status")
        .eq("id", params.id)
        .eq("shop_id", ctx.store.id)
        .maybeSingle();

      if (!stocktake) {
        return NextResponse.json({ error: "Stocktake not found" }, { status: 404 });
      }
      if (stocktake.status !== "in_progress") {
        return NextResponse.json(
          { error: "Stocktake is not in progress" },
          { status: 409 },
        );
      }

      const { error, count } = await supabase
        .from("stocktake_lines")
        .update({
          counted_qty: body.countedQty,
          barcode_scanned: body.barcodeScanned ?? Boolean(body.barcode),
        })
        .eq("stocktake_id", params.id)
        .eq("variant_id", variantId);

      if (error) throw error;
      if (count === 0) {
        return NextResponse.json({ error: "Variant not in this stocktake" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, variantId });
    }

    if (body.action === "complete") {
      const { data: stocktake, error: stError } = await supabase
        .from("stocktakes")
        .select("*, locations(shopify_location_id)")
        .eq("id", params.id)
        .eq("shop_id", ctx.store.id)
        .single();

      if (stError) return NextResponse.json({ error: "Not found" }, { status: 404 });

      if (stocktake.status !== "in_progress") {
        return NextResponse.json(
          { error: "Stocktake already completed" },
          { status: 409 },
        );
      }

      const { data: lines, error: linesError } = await supabase
        .from("stocktake_lines")
        .select(`*, variants(shopify_inventory_item_id)`)
        .eq("stocktake_id", params.id)
        .not("counted_qty", "is", null);

      if (linesError) throw linesError;

      const location = Array.isArray(stocktake.locations)
        ? stocktake.locations[0]
        : stocktake.locations;

      for (const line of lines ?? []) {
        if (line.counted_qty == null) continue;
        const delta = line.counted_qty - line.system_qty;
        if (delta === 0) continue;

        const variant = Array.isArray(line.variants) ? line.variants[0] : line.variants;
        if (variant?.shopify_inventory_item_id && location) {
          await adjustShopifyInventory(
            ctx.shop,
            inventoryItemGid(variant.shopify_inventory_item_id),
            locationGid(location.shopify_location_id),
            delta,
            "correction",
          );
        }

        await supabase
          .from("inventory_levels")
          .upsert(
            {
              shop_id: ctx.store.id,
              variant_id: line.variant_id,
              location_id: stocktake.location_id,
              available: line.counted_qty,
              on_hand: line.counted_qty,
            },
            { onConflict: "variant_id,location_id" },
          );
      }

      const { data: updated, error: updateError } = await supabase
        .from("stocktakes")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", params.id)
        .select("*")
        .single();

      if (updateError) throw updateError;
      return NextResponse.json({ stocktake: updated });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Stocktake update failed" },
      { status: 500 },
    );
  }
}
