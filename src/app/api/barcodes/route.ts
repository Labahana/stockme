import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isNextResponse, resolveShopContext } from "@/lib/api/shop-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { setVariantBarcode } from "@/lib/shopify/inventory";
import { generateBarcodeValue } from "@/lib/barcodes/generate";
import { fetchAllFilteredVariantIds } from "@/lib/inventory/ids";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const filtersSchema = z.object({
  locationId: z.string().uuid(),
  search: z.string().optional(),
  stockStatus: z.string().optional(),
  tag: z.string().optional(),
  vendor: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveShopContext(request);
    if (isNextResponse(ctx)) return ctx;

    const body = await request.json();
    const supabase = createAdminClient();

    // Bulk: generate for selected IDs or entire filtered set
    if (body.action === "bulk" || body.applyToFiltered || Array.isArray(body.variantIds)) {
      let variantIds: string[] = Array.isArray(body.variantIds) ? body.variantIds : [];

      if (body.applyToFiltered) {
        const filters = filtersSchema.safeParse(body.filters);
        if (!filters.success) {
          return NextResponse.json({ error: "Invalid filters" }, { status: 400 });
        }
        variantIds = await fetchAllFilteredVariantIds({
          shopId: ctx.store.id,
          locationId: filters.data.locationId,
          search: filters.data.search,
          stockStatus: filters.data.stockStatus ?? "all",
          tag: filters.data.tag,
          vendor: filters.data.vendor,
        });
      }

      if (variantIds.length === 0) {
        return NextResponse.json({ ok: true, generated: 0, skipped: 0, barcodes: [] });
      }

      const { data: variants, error } = await supabase
        .from("variants")
        .select("id, shopify_variant_id, barcode")
        .eq("shop_id", ctx.store.id)
        .in("id", variantIds.slice(0, 5000));

      if (error) throw error;

      let generated = 0;
      let skipped = 0;
      const barcodes: { variantId: string; barcode: string }[] = [];
      const errors: string[] = [];

      for (const variant of variants ?? []) {
        if (variant.barcode) {
          skipped += 1;
          continue;
        }
        const barcode = generateBarcodeValue(variant.id);
        try {
          await setVariantBarcode(ctx.shop, variant.shopify_variant_id, barcode);
          await supabase.from("variants").update({ barcode }).eq("id", variant.id);
          generated += 1;
          barcodes.push({ variantId: variant.id, barcode });
        } catch (e) {
          errors.push(e instanceof Error ? e.message : "barcode failed");
        }
      }

      return NextResponse.json({
        ok: errors.length === 0,
        generated,
        skipped,
        barcodes,
        errors: errors.slice(0, 5),
      });
    }

    const { variantId, barcode } = body;
    if (!variantId || !barcode) {
      return NextResponse.json({ error: "variantId and barcode required" }, { status: 400 });
    }

    const { data: variant, error } = await supabase
      .from("variants")
      .select("shopify_variant_id")
      .eq("id", variantId)
      .eq("shop_id", ctx.store.id)
      .single();

    if (error || !variant) {
      return NextResponse.json({ error: "Variant not found" }, { status: 404 });
    }

    await setVariantBarcode(ctx.shop, variant.shopify_variant_id, barcode);
    await supabase.from("variants").update({ barcode }).eq("id", variantId);

    return NextResponse.json({ ok: true, barcode });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Barcode update failed" },
      { status: 500 },
    );
  }
}
