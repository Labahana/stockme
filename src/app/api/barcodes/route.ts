import { NextRequest, NextResponse } from "next/server";
import { isNextResponse, resolveShopContext } from "@/lib/api/shop-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { setVariantBarcode } from "@/lib/shopify/inventory";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveShopContext(request);
    if (isNextResponse(ctx)) return ctx;

    const { variantId, barcode } = await request.json();
    if (!variantId || !barcode) {
      return NextResponse.json({ error: "variantId and barcode required" }, { status: 400 });
    }

    const supabase = createAdminClient();
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
