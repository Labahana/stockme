import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isNextResponse, resolveShopContext } from "@/lib/api/shop-context";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  variantIds: z.array(z.string().uuid()).min(1),
  locationId: z.string().uuid(),
  minStock: z.number().int().min(0).optional(),
  maxStock: z.number().int().min(0).nullable().optional(),
  targetStock: z.number().int().min(0).nullable().optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await resolveShopContext(request);
    if (isNextResponse(ctx)) return ctx;

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { variantIds, locationId, minStock, maxStock, targetStock } = parsed.data;

    if (
      minStock === undefined &&
      maxStock === undefined &&
      targetStock === undefined
    ) {
      return NextResponse.json(
        { error: "Provide minStock, maxStock, and/or targetStock" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    const { data: validVariants, error: variantCheckError } = await supabase
      .from("variants")
      .select("id")
      .eq("shop_id", ctx.store.id)
      .in("id", variantIds);
    if (variantCheckError) throw variantCheckError;

    const validVariantIds = new Set((validVariants ?? []).map((v) => v.id));
    const unknownVariants = variantIds.filter((id) => !validVariantIds.has(id));
    if (unknownVariants.length > 0) {
      return NextResponse.json(
        { error: `${unknownVariants.length} variant(s) do not belong to this store` },
        { status: 403 },
      );
    }

    const { data: validLocation, error: locationCheckError } = await supabase
      .from("locations")
      .select("id")
      .eq("shop_id", ctx.store.id)
      .eq("id", locationId)
      .maybeSingle();
    if (locationCheckError) throw locationCheckError;
    if (!validLocation) {
      return NextResponse.json(
        { error: "Location does not belong to this store" },
        { status: 403 },
      );
    }

    const { data: existing, error: existingError } = await supabase
      .from("variant_location_settings")
      .select("variant_id, min_stock, max_stock, target_stock")
      .eq("shop_id", ctx.store.id)
      .eq("location_id", locationId)
      .in("variant_id", variantIds);

    if (existingError) throw existingError;

    const existingMap = new Map(
      (existing ?? []).map((row) => [row.variant_id, row]),
    );

    const mergedRows = variantIds.map((variantId) => {
      const current = existingMap.get(variantId);
      return {
        shop_id: ctx.store.id,
        variant_id: variantId,
        location_id: locationId,
        min_stock: minStock ?? current?.min_stock ?? 0,
        max_stock: maxStock !== undefined ? maxStock : (current?.max_stock ?? null),
        target_stock:
          targetStock !== undefined ? targetStock : (current?.target_stock ?? null),
      };
    });

    const { error } = await supabase
      .from("variant_location_settings")
      .upsert(mergedRows, { onConflict: "variant_id,location_id" });

    if (error) throw error;

    return NextResponse.json({ ok: true, updated: variantIds.length });
  } catch (error) {
    console.error("Bulk threshold update error:", error);
    return NextResponse.json({ error: "Bulk update failed" }, { status: 500 });
  }
}
