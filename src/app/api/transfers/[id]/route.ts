import { NextRequest, NextResponse } from "next/server";
import { isNextResponse, resolveShopContext } from "@/lib/api/shop-context";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  adjustShopifyInventory,
  inventoryItemGid,
  locationGid,
} from "@/lib/shopify/inventory";
// import { assertTransfersAllowed } from "@/lib/billing/limits";

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
      .from("stock_transfers")
      .select(
        `*, stock_transfer_lines(*, variants(sku, title)),
         from_location:locations!stock_transfers_from_location_id_fkey(name, shopify_location_id),
         to_location:locations!stock_transfers_to_location_id_fkey(name, shopify_location_id)`,
      )
      .eq("id", params.id)
      .eq("shop_id", ctx.store.id)
      .single();

    if (error) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ transfer: data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load transfer" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ctx = await resolveShopContext(request);
    if (isNextResponse(ctx)) return ctx;

    const { action } = await request.json();
    const supabase = createAdminClient();

    // Plan-limit enforcement disabled for initial dev/testing.
    // const transferBlocked = assertTransfersAllowed(ctx.store);
    // if (transferBlocked && (action === "ship" || action === "receive")) {
    //   return NextResponse.json({ error: transferBlocked }, { status: 403 });
    // }

    const { data: transfer, error } = await supabase
      .from("stock_transfers")
      .select(
        `*, stock_transfer_lines(*, variants(shopify_inventory_item_id)),
         from_location:locations!stock_transfers_from_location_id_fkey(shopify_location_id),
         to_location:locations!stock_transfers_to_location_id_fkey(shopify_location_id)`,
      )
      .eq("id", params.id)
      .eq("shop_id", ctx.store.id)
      .single();

    if (error) throw error;

    const fromLoc = Array.isArray(transfer.from_location)
      ? transfer.from_location[0]
      : transfer.from_location;
    const toLoc = Array.isArray(transfer.to_location)
      ? transfer.to_location[0]
      : transfer.to_location;
    const lines = Array.isArray(transfer.stock_transfer_lines)
      ? transfer.stock_transfer_lines
      : [];

    if (action === "ship") {
      if (transfer.status !== "draft") {
        return NextResponse.json(
          { error: `Cannot ship a transfer with status "${transfer.status}"` },
          { status: 409 },
        );
      }

      for (const line of lines) {
        const variant = Array.isArray(line.variants) ? line.variants[0] : line.variants;
        if (variant?.shopify_inventory_item_id && fromLoc) {
          await adjustShopifyInventory(
            ctx.shop,
            inventoryItemGid(variant.shopify_inventory_item_id),
            locationGid(fromLoc.shopify_location_id),
            -line.quantity,
            "movement",
          );
        }
        const { data: inv } = await supabase
          .from("inventory_levels")
          .select("available")
          .eq("variant_id", line.variant_id)
          .eq("location_id", transfer.from_location_id)
          .maybeSingle();

        if (inv) {
          await supabase
            .from("inventory_levels")
            .update({ available: inv.available - line.quantity, on_hand: inv.available - line.quantity })
            .eq("variant_id", line.variant_id)
            .eq("location_id", transfer.from_location_id);
        }
      }

      const { data: updated } = await supabase
        .from("stock_transfers")
        .update({ status: "in_transit", shipped_at: new Date().toISOString() })
        .eq("id", params.id)
        .eq("status", "draft")
        .select("*")
        .single();

      return NextResponse.json({ transfer: updated });
    }

    if (action === "receive") {
      if (transfer.status !== "in_transit") {
        return NextResponse.json(
          { error: `Cannot receive a transfer with status "${transfer.status}"` },
          { status: 409 },
        );
      }

      for (const line of lines) {
        const variant = Array.isArray(line.variants) ? line.variants[0] : line.variants;
        if (variant?.shopify_inventory_item_id && toLoc) {
          await adjustShopifyInventory(
            ctx.shop,
            inventoryItemGid(variant.shopify_inventory_item_id),
            locationGid(toLoc.shopify_location_id),
            line.quantity,
            "movement",
          );
        }

        const { data: inv } = await supabase
          .from("inventory_levels")
          .select("available")
          .eq("variant_id", line.variant_id)
          .eq("location_id", transfer.to_location_id)
          .maybeSingle();

        const newQty = (inv?.available ?? 0) + line.quantity;
        await supabase.from("inventory_levels").upsert(
          {
            shop_id: ctx.store.id,
            variant_id: line.variant_id,
            location_id: transfer.to_location_id,
            available: newQty,
            on_hand: newQty,
          },
          { onConflict: "variant_id,location_id" },
        );

        await supabase
          .from("stock_transfer_lines")
          .update({ received_qty: line.quantity })
          .eq("id", line.id);
      }

      const { data: updated } = await supabase
        .from("stock_transfers")
        .update({ status: "received", received_at: new Date().toISOString() })
        .eq("id", params.id)
        .eq("status", "in_transit")
        .select("*")
        .single();

      return NextResponse.json({ transfer: updated });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Transfer update failed" },
      { status: 500 },
    );
  }
}
