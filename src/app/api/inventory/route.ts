import { NextRequest, NextResponse } from "next/server";
import { isNextResponse, resolveShopContext } from "@/lib/api/shop-context";
import {
  fetchInventoryList,
  fetchLocations,
  fetchStoreTags,
  fetchStoreVendors,
  fetchConsolidatedInventory,
} from "@/lib/inventory/queries";
import {
  assertConsolidatedViewAllowed,
  filterLocationsForPlan,
} from "@/lib/billing/limits";
import { toCsv } from "@/lib/export/csv";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveShopContext(request);
    if (isNextResponse(ctx)) return ctx;

    const { searchParams } = request.nextUrl;
    const locationId = searchParams.get("locationId");
    const consolidated = searchParams.get("consolidated") === "true";
    const exportCsv = searchParams.get("export") === "csv";

    if (consolidated) {
      const blocked = assertConsolidatedViewAllowed(ctx.store);
      if (blocked) {
        return NextResponse.json({ error: blocked }, { status: 403 });
      }
      if (exportCsv) {
        return streamInventoryCsv(ctx.store.id, null, searchParams.get("search"));
      }
      const result = await fetchConsolidatedInventory(ctx.store.id, {
        search: searchParams.get("search") ?? undefined,
        page: Number(searchParams.get("page") ?? "1"),
        limit: Number(searchParams.get("limit") ?? "20"),
      });
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
      const allLocations = await fetchLocations(ctx.store.id);
      const locations = await filterLocationsForPlan(ctx.store, allLocations);
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

    if (exportCsv) {
      return streamInventoryCsv(ctx.store.id, locationId, searchParams.get("search"), {
        stockStatus: searchParams.get("stockStatus") ?? "all",
        tag: searchParams.get("tag"),
        vendor: searchParams.get("vendor"),
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
      limit: Number(searchParams.get("limit") ?? "20"),
    });

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

/** Stream CSV in 500-row pages — free-tier safe for large catalogs. */
async function streamInventoryCsv(
  shopId: string,
  locationId: string | null,
  search: string | null,
  filters?: { stockStatus?: string; tag?: string | null; vendor?: string | null },
) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (locationId) {
          controller.enqueue(
            encoder.encode(
              "product,variant,sku,barcode,available,min_stock,max_stock,vendor\n",
            ),
          );
          let page = 1;
          let hasMore = true;
          while (hasMore) {
            const result = await fetchInventoryList({
              shopId,
              locationId,
              search: search ?? undefined,
              stockStatus: filters?.stockStatus ?? "all",
              tag: filters?.tag ?? undefined,
              vendor: filters?.vendor ?? undefined,
              page,
              limit: 500,
            });
            const chunk = toCsv(
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
            );
            // Drop header from subsequent pages (toCsv includes header)
            const body = page === 1 ? chunk : chunk.split("\n").slice(1).join("\n");
            if (body.trim()) controller.enqueue(encoder.encode(body + "\n"));
            hasMore = page < result.pagination.totalPages;
            page += 1;
            if (page > 2000) break;
          }
        } else {
          controller.enqueue(
            encoder.encode("product,variant,sku,barcode,total_available\n"),
          );
          let page = 1;
          let hasMore = true;
          while (hasMore) {
            const result = await fetchConsolidatedInventory(shopId, {
              search: search ?? undefined,
              page,
              limit: 500,
            });
            const chunk = toCsv(
              result.items.map((item) => ({
                product: item.product_title,
                variant: item.variant_title,
                sku: item.sku ?? "",
                barcode: item.barcode ?? "",
                total_available: item.total_available,
              })),
            );
            const body = page === 1 ? chunk : chunk.split("\n").slice(1).join("\n");
            if (body.trim()) controller.enqueue(encoder.encode(body + "\n"));
            hasMore = page < result.pagination.totalPages;
            page += 1;
            if (page > 2000) break;
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="stockme-inventory-${Date.now()}.csv"`,
      "Cache-Control": "no-cache",
    },
  });
}
