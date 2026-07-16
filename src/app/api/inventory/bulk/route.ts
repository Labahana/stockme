import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isNextResponse, resolveShopContext } from "@/lib/api/shop-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllFilteredVariantIds } from "@/lib/inventory/ids";

const filtersSchema = z.object({
  locationId: z.string().uuid(),
  search: z.string().optional(),
  stockStatus: z.string().optional(),
  tag: z.string().optional(),
  vendor: z.string().optional(),
});

const bodySchema = z
  .object({
    variantIds: z.array(z.string().uuid()).optional(),
    applyToFiltered: z.boolean().optional(),
    filters: filtersSchema.optional(),
    locationId: z.string().uuid().optional(),
    minStock: z.number().int().min(0).optional(),
    maxStock: z.number().int().min(0).nullable().optional(),
    targetStock: z.number().int().min(0).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.applyToFiltered) {
      if (!data.filters?.locationId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "filters.locationId required when applyToFiltered is true",
        });
      }
    } else if (!data.variantIds?.length || !data.locationId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "variantIds and locationId required unless applyToFiltered",
      });
    }
  });

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await resolveShopContext(request);
    if (isNextResponse(ctx)) return ctx;

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { minStock, maxStock, targetStock } = parsed.data;

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

    let variantIds: string[];
    let locationId: string;

    if (parsed.data.applyToFiltered && parsed.data.filters) {
      locationId = parsed.data.filters.locationId;
      variantIds = await fetchAllFilteredVariantIds({
        shopId: ctx.store.id,
        locationId,
        search: parsed.data.filters.search,
        stockStatus: parsed.data.filters.stockStatus ?? "all",
        tag: parsed.data.filters.tag,
        vendor: parsed.data.filters.vendor,
      });
    } else {
      locationId = parsed.data.locationId!;
      variantIds = parsed.data.variantIds ?? [];
    }

    if (variantIds.length === 0) {
      return NextResponse.json({ ok: true, updated: 0 });
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

    // Process in chunks to stay under PostgREST payload limits
    const CHUNK = 500;
    let updated = 0;

    for (let i = 0; i < variantIds.length; i += CHUNK) {
      const chunk = variantIds.slice(i, i + CHUNK);

      const { data: existing, error: existingError } = await supabase
        .from("variant_location_settings")
        .select("variant_id, min_stock, max_stock, target_stock")
        .eq("shop_id", ctx.store.id)
        .eq("location_id", locationId)
        .in("variant_id", chunk);

      if (existingError) throw existingError;

      const existingMap = new Map(
        (existing ?? []).map((row) => [row.variant_id, row]),
      );

      const mergedRows = chunk.map((variantId) => {
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
      updated += chunk.length;
    }

    return NextResponse.json({ ok: true, updated });
  } catch (error) {
    console.error("Bulk threshold update error:", error);
    return NextResponse.json({ error: "Bulk update failed" }, { status: 500 });
  }
}
