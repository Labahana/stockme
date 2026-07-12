import { NextRequest, NextResponse } from "next/server";
import { isNextResponse, resolveShopContext } from "@/lib/api/shop-context";
import {
  fetchInventoryList,
  fetchLocations,
  fetchStoreTags,
  fetchStoreVendors,
  fetchConsolidatedInventory,
} from "@/lib/inventory/queries";
import { csvResponse, toCsv } from "@/lib/export/csv";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveShopContext(request);
    if (isNextResponse(ctx)) return ctx;

    const { searchParams } = request.nextUrl;
    const locationId = searchParams.get("locationId");
    const consolidated = searchParams.get("consolidated") === "true";
    const exportCsv = searchParams.get("export") === "csv";

    if (consolidated) {
      const result = await fetchConsolidatedInventory(ctx.store.id, {
        search: searchParams.get("search") ?? undefined,
        page: Number(searchParams.get("page") ?? "1"),
        limit: exportCsv ? 10_000 : Number(searchParams.get("limit") ?? "50"),
      });
      if (exportCsv) {
        return csvResponse(
          "stockme-inventory-consolidated.csv",
          toCsv(
            result.items.map((item) => ({
              product: item.product_title,
              variant: item.variant_title,
              sku: item.sku ?? "",
              barcode: item.barcode ?? "",
              total_available: item.total_available,
            })),
          ),
        );
      }
      return NextResponse.json({
        ...result,
        store: {
          shop: ctx.shop,
          lastSyncedAt: ctx.store.last_synced_at,
          planTier: ctx.store.plan_tier,
        },
      });
    }

    if (!locationId) {
      const locations = await fetchLocations(ctx.store.id);
      return NextResponse.json({
        store: {
          shop: ctx.shop,
          lastSyncedAt: ctx.store.last_synced_at,
          planTier: ctx.store.plan_tier,
        },
        locations,
        tags: await fetchStoreTags(ctx.store.id),
        vendors: await fetchStoreVendors(ctx.store.id),
      });
    }

    const result = await fetchInventoryList({
      shopId: ctx.store.id,
      locationId,
      search: searchParams.get("search") ?? undefined,
      stockStatus: searchParams.get("stockStatus") ?? "all",
      tag: searchParams.get("tag") ?? undefined,
      vendor: searchParams.get("vendor") ?? undefined,
      page: Number(searchParams.get("page") ?? "1"),
      limit: exportCsv ? 10_000 : Number(searchParams.get("limit") ?? "50"),
    });

    if (exportCsv) {
      return csvResponse(
        "stockme-inventory.csv",
        toCsv(
          result.items.map((item) => ({
            product: item.product_title,
            variant: item.variant_title,
            sku: item.sku ?? "",
            barcode: item.barcode ?? "",
            available: item.available,
            min_stock: item.min_stock,
            max_stock: item.max_stock ?? "",
            vendor: item.vendor ?? "",
          })),
        ),
      );
    }

    return NextResponse.json({
      ...result,
      store: {
        shop: ctx.shop,
        lastSyncedAt: ctx.store.last_synced_at,
      },
    });
  } catch (error) {
    console.error("Inventory list error:", error);
    return NextResponse.json({ error: "Failed to load inventory" }, { status: 500 });
  }
}
