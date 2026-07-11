import "@shopify/shopify-api/adapters/node";
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

let shopifyClient: Shopify | null = null;

function getHostName() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://stockme.gentletap.co";
  return new URL(appUrl).host;
}

export function getShopify() {
  if (!shopifyClient) {
    shopifyClient = shopifyApi({
      apiKey:
        process.env.SHOPIFY_API_KEY ||
        process.env.NEXT_PUBLIC_SHOPIFY_API_KEY ||
        "",
      apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
      scopes: [...SHOPIFY_SCOPES],
      hostName: getHostName(),
      hostScheme: "https",
      apiVersion: ApiVersion.July26,
      isEmbeddedApp: true,
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

function rowToSession(row: {
  id: string;
  shop: string;
  state: string;
  is_online: boolean;
  scope: string | null;
  expires: string | null;
  access_token: string | null;
  refresh_token: string | null;
  refresh_token_expires: string | null;
  online_access_info: unknown;
}): Session {
  const session = new Session({
    id: row.id,
    shop: row.shop,
    state: row.state,
    isOnline: row.is_online,
  });

  if (row.scope) session.scope = row.scope;
  if (row.expires) session.expires = new Date(row.expires);
  if (row.access_token) session.accessToken = row.access_token;
  if (row.refresh_token) session.refreshToken = row.refresh_token;
  if (row.refresh_token_expires) {
    session.refreshTokenExpires = new Date(row.refresh_token_expires);
  }
  if (row.online_access_info) {
    session.onlineAccessInfo = row.online_access_info as Session["onlineAccessInfo"];
  }

  return session;
}

function sessionToRow(session: Session) {
  return {
    id: session.id,
    shop: session.shop,
    state: session.state,
    is_online: session.isOnline,
    scope: session.scope ?? null,
    expires: session.expires?.toISOString() ?? null,
    access_token: session.accessToken ?? null,
    refresh_token: session.refreshToken ?? null,
    refresh_token_expires: session.refreshTokenExpires?.toISOString() ?? null,
    online_access_info: session.onlineAccessInfo ?? null,
    updated_at: new Date().toISOString(),
  };
}

export async function storeSession(session: Session) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("shopify_sessions")
    .upsert(sessionToRow(session), { onConflict: "id" });

  if (error) throw error;
}

export async function loadSession(id: string): Promise<Session | undefined> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("shopify_sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return undefined;
  return rowToSession(data);
}

export async function deleteSession(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("shopify_sessions").delete().eq("id", id);
  if (error) throw error;
}

export async function loadOfflineSession(shop: string): Promise<Session | undefined> {
  const sessionId = getShopify().session.getOfflineId(shop);
  return loadSession(sessionId);
}

export function sanitizeShop(shop: string | null): string | null {
  if (!shop) return null;
  const domain = shop.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain)) {
    return null;
  }
  return domain;
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
  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://stockme.gentletap.co"}/api/webhooks`;
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
    CUSTOMERS_DATA_REQUEST: [
      {
        deliveryMethod: DeliveryMethod.Http,
        callbackUrl,
        callback: async () => undefined,
      },
    ],
    CUSTOMERS_REDACT: [
      {
        deliveryMethod: DeliveryMethod.Http,
        callbackUrl,
        callback: async () => undefined,
      },
    ],
    SHOP_REDACT: [
      {
        deliveryMethod: DeliveryMethod.Http,
        callbackUrl,
        callback: async () => undefined,
      },
    ],
  });

  await client.webhooks.register({ session });
}

export async function getGraphqlClient(shop: string) {
  const session = await loadOfflineSession(shop);
  if (!session?.accessToken) {
    throw new Error(`No offline session for ${shop}`);
  }
  const client = getShopify();
  return new client.clients.Graphql({ session });
}
