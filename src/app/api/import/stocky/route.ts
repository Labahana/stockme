import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isNextResponse, resolveShopContext } from "@/lib/api/shop-context";
import {
  importStockyPurchaseOrders,
  importStockySuppliers,
} from "@/lib/import/stocky";
import { PO_SAMPLE_CSV, SUPPLIER_SAMPLE_CSV } from "@/lib/import/csv";

export const dynamic = "force-dynamic";

const importSchema = z.object({
  type: z.enum(["suppliers", "purchase_orders"]),
  csv: z.string().min(1).max(5_000_000),
  createMissingSuppliers: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const sample = request.nextUrl.searchParams.get("sample");
  if (sample === "suppliers") {
    return new Response(SUPPLIER_SAMPLE_CSV, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="stockme-suppliers-template.csv"',
      },
    });
  }
  if (sample === "purchase_orders") {
    return new Response(PO_SAMPLE_CSV, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="stockme-purchase-orders-template.csv"',
      },
    });
  }
  return NextResponse.json({
    samples: {
      suppliers: "/api/import/stocky?sample=suppliers",
      purchase_orders: "/api/import/stocky?sample=purchase_orders",
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveShopContext(request);
    if (isNextResponse(ctx)) return ctx;

    const parsed = importSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const result =
      parsed.data.type === "suppliers"
        ? await importStockySuppliers(ctx.store.id, parsed.data.csv)
        : await importStockyPurchaseOrders(ctx.store.id, parsed.data.csv, {
            createMissingSuppliers: parsed.data.createMissingSuppliers ?? true,
          });

    return NextResponse.json({ type: parsed.data.type, ...result });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
