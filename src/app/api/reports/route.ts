import { NextRequest, NextResponse } from "next/server";
import { isNextResponse, resolveShopContext } from "@/lib/api/shop-context";
import {
  reportCogs,
  reportLowStock,
  reportSellThrough,
  reportSupplierPerformance,
  reportValuation,
} from "@/lib/reports";
// import {
//   assertBundleCostReports,
//   assertSupplierPerformanceReport,
// } from "@/lib/billing/limits";
import { csvResponse, toCsv } from "@/lib/export/csv";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveShopContext(request);
    if (isNextResponse(ctx)) return ctx;

    const type = request.nextUrl.searchParams.get("type") ?? "low_stock";
    const locationId = request.nextUrl.searchParams.get("locationId") ?? undefined;
    const days = Number(request.nextUrl.searchParams.get("days") ?? "30");
    const exportCsv = request.nextUrl.searchParams.get("export") === "csv";

    let result;
    switch (type) {
      case "valuation": {
        // Plan-limit enforcement disabled for initial dev/testing.
        // const blocked = assertBundleCostReports(ctx.store);
        // if (blocked) return NextResponse.json({ error: blocked }, { status: 403 });
        result = await reportValuation(ctx.store.id, locationId);
        break;
      }
      case "supplier_performance": {
        // Plan-limit enforcement disabled for initial dev/testing.
        // const blocked = assertSupplierPerformanceReport(ctx.store);
        // if (blocked) return NextResponse.json({ error: blocked }, { status: 403 });
        result = await reportSupplierPerformance(ctx.store.id);
        break;
      }
      case "sell_through":
        result = await reportSellThrough(ctx.shop, ctx.store.id, days);
        break;
      case "cogs":
        result = await reportCogs(ctx.store.id, days);
        break;
      case "low_stock":
      default:
        result = await reportLowStock(ctx.store.id, locationId);
    }

    if (exportCsv) {
      return csvResponse(`${type}.csv`, toCsv(result.rows));
    }

    return NextResponse.json({ type, ...result });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Report failed" }, { status: 500 });
  }
}
