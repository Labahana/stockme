import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isNextResponse, resolveShopContext } from "@/lib/api/shop-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeForecastLines } from "@/lib/forecast";
import { nextPoNumber } from "@/lib/po/number";
import { csvResponse, toCsv } from "@/lib/export/csv";
import type { ForecastMethod } from "@/lib/constants";
import { assertForecastMethodAllowed } from "@/lib/billing/limits";

export const dynamic = "force-dynamic";

const createPoSchema = z.object({
  supplierId: z.string().uuid(),
  locationId: z.string().uuid(),
  notes: z.string().optional(),
  forecastMethod: z.string().optional(),
  forecastParams: z.record(z.string(), z.unknown()).optional(),
  lines: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        orderedQty: z.number().int().min(1),
        unitCost: z.number().min(0).default(0),
      }),
    )
    .min(1),
});

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveShopContext(request);
    if (isNextResponse(ctx)) return ctx;

    const supabase = createAdminClient();

    if (request.nextUrl.searchParams.get("export") === "csv") {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(
          `po_number, status, notes, expected_at, sent_at,
           suppliers(name), locations(name)`,
        )
        .eq("shop_id", ctx.store.id);
      if (error) throw error;
      const rows = (data ?? []).map((po: Record<string, unknown>) => {
        const suppliers = po.suppliers as { name?: string } | { name?: string }[] | null;
        const locations = po.locations as { name?: string } | { name?: string }[] | null;
        const supplier = Array.isArray(suppliers) ? suppliers[0]?.name : suppliers?.name;
        const location = Array.isArray(locations) ? locations[0]?.name : locations?.name;
        return {
          po_number: po.po_number,
          status: po.status,
          supplier,
          location,
          notes: po.notes,
          expected_at: po.expected_at,
          sent_at: po.sent_at,
        };
      });
      return csvResponse("purchase-orders.csv", toCsv(rows));
    }

    const status = request.nextUrl.searchParams.get("status");
    const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? "1"));
    const limit = Math.min(200, Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? "50")));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let q = supabase
      .from("purchase_orders")
      .select(
        `*, suppliers(name, email), locations(name),
         po_line_items(id, ordered_qty, received_qty, unit_cost, variants(sku, title))`,
        { count: "exact" },
      )
      .eq("shop_id", ctx.store.id)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (status) q = q.eq("status", status);

    const { data, error, count } = await q;
    if (error) throw error;
    return NextResponse.json({
      purchaseOrders: data ?? [],
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit) || 1,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load POs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveShopContext(request);
    if (isNextResponse(ctx)) return ctx;

    const body = await request.json();

    if (body.action === "forecast") {
      const method = body.method as ForecastMethod;
      const blocked = assertForecastMethodAllowed(ctx.store, method);
      if (blocked) {
        return NextResponse.json({ error: blocked }, { status: 403 });
      }
      const lines = await computeForecastLines(
        ctx.shop,
        ctx.store.id,
        body.locationId,
        body.supplierId ?? null,
        {
          method: body.method as ForecastMethod,
          days: body.days,
          startDate: body.startDate,
          endDate: body.endDate,
          targetStock: body.targetStock,
        },
        body.leadTimeDays ?? 7,
      );
      return NextResponse.json({ lines });
    }

    const parsed = createPoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { supplierId, locationId, lines, notes, forecastMethod, forecastParams } =
      parsed.data;

    const supabase = createAdminClient();

    const [{ data: supplier }, { data: location }, { data: variants }] = await Promise.all([
      supabase.from("suppliers").select("id").eq("id", supplierId).eq("shop_id", ctx.store.id).maybeSingle(),
      supabase.from("locations").select("id").eq("id", locationId).eq("shop_id", ctx.store.id).maybeSingle(),
      supabase
        .from("variants")
        .select("id")
        .eq("shop_id", ctx.store.id)
        .in(
          "id",
          lines.map((l) => l.variantId),
        ),
    ]);

    if (!supplier) {
      return NextResponse.json({ error: "Supplier does not belong to this store" }, { status: 403 });
    }
    if (!location) {
      return NextResponse.json({ error: "Location does not belong to this store" }, { status: 403 });
    }
    const validVariantIds = new Set((variants ?? []).map((v) => v.id));
    const unknownVariants = lines.filter((l) => !validVariantIds.has(l.variantId));
    if (unknownVariants.length > 0) {
      return NextResponse.json(
        { error: `${unknownVariants.length} line variant(s) do not belong to this store` },
        { status: 403 },
      );
    }

    const poNumber = await nextPoNumber(ctx.store.id);

    const { data: po, error: poError } = await supabase
      .from("purchase_orders")
      .insert({
        shop_id: ctx.store.id,
        supplier_id: supplierId,
        location_id: locationId,
        po_number: poNumber,
        status: "draft",
        notes: notes ?? null,
        forecast_method: forecastMethod ?? null,
        forecast_params: forecastParams ?? null,
      })
      .select("*")
      .single();

    if (poError) throw poError;

    const lineRows = lines.map((l) => ({
      shop_id: ctx.store.id,
      purchase_order_id: po.id,
      variant_id: l.variantId,
      ordered_qty: l.orderedQty,
      unit_cost: l.unitCost,
    }));

    const { error: lineError } = await supabase.from("po_line_items").insert(lineRows);
    if (lineError) throw lineError;

    return NextResponse.json({ purchaseOrder: po });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create PO" }, { status: 500 });
  }
}
