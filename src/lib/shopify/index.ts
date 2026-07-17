import "@shopify/shopify-api/adapters/web-api";
import {
  shopifyApi,
  ApiVersion,
  Session,
  DeliveryMethod,
  BillingInterval,
  type Shopify,
} from "@shopify/shopify-api";
import { SHOPIFY_SCOPES } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAppHost } from "@/lib/shopify/next-adapter";
import { supabaseSessionStorage } from "@/lib/shopify/session-storage";
import {
  deleteSession,
  loadSession,
  storeSession,
} from "@/lib/shopify/sessions";

export { deleteSession, loadSession, storeSession };

let shopifyClient: Shopify | null = null;

export function getShopify() {
  if (!shopifyClient) {
    shopifyClient = shopifyApi({
      apiKey:
        process.env.SHOPIFY_API_KEY ||
        process.env.NEXT_PUBLIC_SHOPIFY_API_KEY ||
        "",
      apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
      scopes: [...SHOPIFY_SCOPES],
      hostName: resolveAppHost(),
      hostScheme: "https",
      apiVersion: ApiVersion.July26,
      isEmbeddedApp: true,
      sessionStorage: supabaseSessionStorage,
      billing: {
        starter: {
          trialDays: 14,
          lineItems: [
            {
              amount: 15,
              currencyCode: "USD",
              interval: BillingInterval.Every30Days,
            },
          ],
        },
        growth: {
          trialDays: 14,
          lineItems: [
            {
              amount: 29,
              currencyCode: "USD",
              interval: BillingInterval.Every30Days,
            },
          ],
        },
        pro: {
          trialDays: 14,
          lineItems: [
            {
              amount: 39,
              currencyCode: "USD",
              interval: BillingInterval.Every30Days,
            },
          ],
        },
      },
    });
  }
  return shopifyClient;
}

/** @deprecated Use getShopify() — kept for route imports */
export const shopify = new Proxy({} as Shopify, {
  get(_target, prop) {
    return Reflect.get(getShopify(), prop);
  },
});

export function sanitizeShop(shop: string | null): string | null {
  if (!shop) return null;
  const domain = shop.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain)) {
    return null;
  }
  return domain;
}

export async function loadOfflineSession(shop: string): Promise<Session | undefined> {
  const sessionId = getShopify().session.getOfflineId(shop);
  return loadSession(sessionId);
}

/**
 * Load the offline session, proactively refreshing the (now expiring) access
 * token when it is within the skew window of expiry. Use this anywhere an
 * Admin API call is about to be made.
 */
export async function getValidOfflineSession(
  shop: string,
): Promise<Session | undefined> {
  const { ensureExpiringOfflineSession, refreshOfflineSession } = await import(
    "@/lib/shopify/oauth"
  );

  // Migrate legacy non-expiring tokens before any Admin API call.
  let session = (await ensureExpiringOfflineSession(shop)) ?? undefined;
  if (!session?.accessToken) return session;

  const REFRESH_SKEW_MS = 2 * 60 * 1000;
  const expiresSoon = session.expires
    ? session.expires.getTime() - Date.now() <= REFRESH_SKEW_MS
    : false;

  if (expiresSoon && session.refreshToken) {
    try {
      const refreshed = await refreshOfflineSession(shop);
      if (refreshed) session = refreshed;
    } catch (error) {
      console.error(`Offline token refresh failed for ${shop}:`, error);
    }
  }

  return session;
}

export async function ensureStoreRecord(shop: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("stores")
    .upsert({ shop_domain: shop }, { onConflict: "shop_domain" })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function registerWebhooks(session: Session) {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "https://stockme.gentletap.co";
  const callbackUrl = `${appUrl}/api/webhooks`;
  const client = getShopify();

  client.webhooks.addHandlers({
    PRODUCTS_UPDATE: [
      {
        deliveryMethod: DeliveryMethod.Http,
        callbackUrl,
        callback: async () => undefined,
      },
    ],
    PRODUCTS_DELETE: [
      {
        deliveryMethod: DeliveryMethod.Http,
        callbackUrl,
        callback: async () => undefined,
      },
    ],
    INVENTORY_LEVELS_UPDATE: [
      {
        deliveryMethod: DeliveryMethod.Http,
        callbackUrl,
        callback: async () => undefined,
      },
    ],
    APP_UNINSTALLED: [
      {
        deliveryMethod: DeliveryMethod.Http,
        callbackUrl,
        callback: async () => undefined,
      },
    ],
    APP_SUBSCRIPTIONS_UPDATE: [
      {
        deliveryMethod: DeliveryMethod.Http,
        callbackUrl,
        callback: async () => undefined,
      },
    ],
    PRODUCTS_CREATE: [
      {
        deliveryMethod: DeliveryMethod.Http,
        callbackUrl,
        callback: async () => undefined,
      },
    ],
  });

  // Compliance topics (customers/data_request, customers/redact, shop/redact)
  // must be app-specific via shopify.app.toml — not registered per-install.
  await client.webhooks.register({ session });
}

export async function getGraphqlClient(shop: string) {
  const session = await getValidOfflineSession(shop);
  if (!session?.accessToken) {
    throw new Error(`No offline session for ${shop}`);
  }
  const client = getShopify();
  return new client.clients.Graphql({ session });
}
