import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isNextResponse, resolveShopContext } from "@/lib/api/shop-context";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const linkSchema = z.object({
  variantId: z.string().uuid(),
  supplierSku: z.string().optional(),
  packSize: z.number().int().min(1).default(1),
  moq: z.number().int().min(1).default(1),
  unitCost: z.number().min(0).optional(),
  isPrimary: z.boolean().default(false),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ctx = await resolveShopContext(request);
    if (isNextResponse(ctx)) return ctx;

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("supplier_products")
      .select(
        `id, supplier_sku, pack_size, moq, unit_cost, is_primary,
         variants(id, sku, title, barcode, products(title))`,
      )
      .eq("shop_id", ctx.store.id)
      .eq("supplier_id", params.id);

    if (error) throw error;
    return NextResponse.json({ products: data ?? [] });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load supplier products" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ctx = await resolveShopContext(request);
    if (isNextResponse(ctx)) return ctx;

    const parsed = linkSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: supplier, error: supplierError } = await supabase
      .from("suppliers")
      .select("id")
      .eq("id", params.id)
      .eq("shop_id", ctx.store.id)
      .maybeSingle();

    if (supplierError) throw supplierError;
    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    if (parsed.data.isPrimary) {
      await supabase
        .from("supplier_products")
        .update({ is_primary: false })
        .eq("shop_id", ctx.store.id)
        .eq("variant_id", parsed.data.variantId);
    }

    const { data, error } = await supabase
      .from("supplier_products")
      .upsert(
        {
          shop_id: ctx.store.id,
          supplier_id: params.id,
          variant_id: parsed.data.variantId,
          supplier_sku: parsed.data.supplierSku ?? null,
          pack_size: parsed.data.packSize,
          moq: parsed.data.moq,
          unit_cost: parsed.data.unitCost ?? null,
          is_primary: parsed.data.isPrimary,
        },
        { onConflict: "supplier_id,variant_id" },
      )
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ product: data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to link product" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ctx = await resolveShopContext(request);
    if (isNextResponse(ctx)) return ctx;

    const variantId = request.nextUrl.searchParams.get("variantId");
    if (!variantId) {
      return NextResponse.json({ error: "variantId required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("supplier_products")
      .delete()
      .eq("shop_id", ctx.store.id)
      .eq("supplier_id", params.id)
      .eq("variant_id", variantId);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to unlink product" }, { status: 500 });
  }
}
