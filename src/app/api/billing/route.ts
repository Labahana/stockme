import { NextRequest, NextResponse } from "next/server";
import { isNextResponse, resolveShopContext } from "@/lib/api/shop-context";
import { loadOfflineSession } from "@/lib/shopify";
import {
  requestSubscription,
  syncStoreBilling,
} from "@/lib/billing/plans";
import { countShopLocations, countShopVariants, getPlanLimits } from "@/lib/billing/limits";
import type { PlanTier } from "@/lib/constants";
import { PLAN_TIERS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveShopContext(request, { skipBilling: true });
    if (isNextResponse(ctx)) return ctx;

    const session = await loadOfflineSession(ctx.shop);
    let billing = {
      hasActivePayment: ctx.store.billing_status === "active",
      planTier: ctx.store.plan_tier,
      billingStatus: ctx.store.billing_status,
    };

    if (session) {
      billing = await syncStoreBilling(session, ctx.store.id);
    }

    return NextResponse.json({
      planTier: billing.planTier,
      billingStatus: billing.billingStatus,
      hasActivePayment: billing.hasActivePayment,
      provider: "shopify",
      plans: PLAN_TIERS,
      usage: {
        skuCount: await countShopVariants(ctx.store.id),
        locationCount: await countShopLocations(ctx.store.id),
        limits: getPlanLimits(billing.planTier),
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Billing status failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveShopContext(request, { skipBilling: true });
    if (isNextResponse(ctx)) return ctx;

    const { plan } = (await request.json()) as { plan: PlanTier };
    if (!plan || !PLAN_TIERS[plan]) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const session = await loadOfflineSession(ctx.shop);
    if (!session) {
      return NextResponse.json({ error: "No session" }, { status: 401 });
    }

    const host = request.nextUrl.searchParams.get("host");
    const base = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
    const returnParams = new URLSearchParams({
      shop: ctx.shop,
      billing: "confirmed",
    });
    if (host) returnParams.set("host", host);
    const returnUrl = `${base}/app/settings?${returnParams.toString()}`;
    const confirmation = await requestSubscription(session, plan, returnUrl);

    return NextResponse.json({ confirmationUrl: confirmation });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Billing request failed" }, { status: 500 });
  }
}
