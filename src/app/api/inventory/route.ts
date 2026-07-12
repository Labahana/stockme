import { NextRequest, NextResponse } from "next/server";
import { isNextResponse, resolveShopContext } from "@/lib/api/shop-context";
import {
  fetchInventoryList,
  fetchLocations,
  fetchStoreTags,
  fetchStoreVendors,
  fetchConsolidatedInventory,
} from "@/lib/inventory/queries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveShopContext(request);
    if (isNextResponse(ctx)) return ctx;

    const { searchParams } = request.nextUrl;
    const locationId = searchParams.get("locationId");
    const consolidated = searchParams.get("consolidated") === "true";

    if (consolidated) {
      // Plan-limit enforcement disabled for initial dev/testing.
      // const blocked = assertConsolidatedViewAllowed(ctx.store);
      // if (blocked) {
      //   return NextResponse.json({ error: blocked }, { status: 403 });
      // }
      const result = await fetchConsolidatedInventory(ctx.store.id, {
        search: searchParams.get("search") ?? undefined,
        page: Number(searchParams.get("page") ?? "1"),
        limit: Number(searchParams.get("limit") ?? "50"),
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
    // Plan-limit enforcement disabled for initial dev/testing.
    // const locations = await filterLocationsForPlan(ctx.store, await fetchLocations(ctx.store.id));
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
      limit: Number(searchParams.get("limit") ?? "50"),
    });

    // Plan-limit enforcement disabled for initial dev/testing.
    // const limits = getPlanLimits(ctx.store.plan_tier);
    // if (limits.locations !== null) {
    //   const allowed = await filterLocationsForPlan(ctx.store, await fetchLocations(ctx.store.id));
    //   if (!allowed.some((l) => l.id === locationId)) {
    //     return NextResponse.json(
    //       { error: `Your ${limits.name} plan includes 1 location. Upgrade to manage inventory at more locations.` },
    //       { status: 403 },
    //     );
    //   }
    // }

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
