import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isNextResponse, resolveShopContext } from "@/lib/api/shop-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendLowStockDigestForShop } from "@/lib/email/low-stock";
// import { billingBypassEnabled } from "@/lib/billing/plans";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveShopContext(request, { skipBilling: true });
    if (isNextResponse(ctx)) return ctx;

    return NextResponse.json({
      email: ctx.store.email,
      lowStockDigestEnabled: Boolean(
        (ctx.store as { low_stock_digest_enabled?: boolean }).low_stock_digest_enabled,
      ),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

const patchSchema = z.object({
  email: z.string().email().optional(),
  lowStockDigestEnabled: z.boolean().optional(),
  sendDigestNow: z.boolean().optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await resolveShopContext(request, { skipBilling: true });
    if (isNextResponse(ctx)) return ctx;

    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = createAdminClient();
    const updates: Record<string, unknown> = {};
    if (parsed.data.email !== undefined) updates.email = parsed.data.email;
    if (parsed.data.lowStockDigestEnabled !== undefined) {
      updates.low_stock_digest_enabled = parsed.data.lowStockDigestEnabled;
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from("stores")
        .update(updates)
        .eq("id", ctx.store.id);
      if (error) throw error;
    }

    let digestResult = null;
    if (parsed.data.sendDigestNow) {
      // Billing enforcement disabled for initial dev/testing.
      // if (ctx.store.billing_status !== "active" && !billingBypassEnabled()) {
      //   return NextResponse.json(
      //     { error: "An active Shopify subscription is required." },
      //     { status: 402 },
      //   );
      // }
      digestResult = await sendLowStockDigestForShop(ctx.store.id, ctx.shop);
    }

    return NextResponse.json({ ok: true, digestResult });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
