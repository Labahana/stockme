import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isNextResponse, resolveShopContext } from "@/lib/api/shop-context";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  contact_name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  lead_time_days: z.number().int().min(0).optional(),
  notes: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ctx = await resolveShopContext(request);
    if (isNextResponse(ctx)) return ctx;

    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("suppliers")
      .update(parsed.data)
      .eq("id", params.id)
      .eq("shop_id", ctx.store.id)
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ supplier: data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update supplier" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ctx = await resolveShopContext(request);
    if (isNextResponse(ctx)) return ctx;

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("suppliers")
      .delete()
      .eq("id", params.id)
      .eq("shop_id", ctx.store.id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete supplier" }, { status: 500 });
  }
}
