import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { Session } from "@shopify/shopify-api";
import { SHOPIFY_SCOPES } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { getShopify, sanitizeShop } from "@/lib/shopify";
import { loadOfflineSession, storeSession } from "@/lib/shopify/sessions";

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes (Shopify cookie is only 60s)
const CALLBACK_PATH = "/api/auth/callback";

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "https://stockme.gentletap.co"
  );
}

function apiKey() {
  return (
    process.env.SHOPIFY_API_KEY ||
    process.env.NEXT_PUBLIC_SHOPIFY_API_KEY ||
    ""
  );
}

function apiSecret() {
  return process.env.SHOPIFY_API_SECRET || "";
}

function stateSessionId(state: string) {
  return `oauth_state_${state}`;
}

function nonce() {
  return randomBytes(16).toString("hex");
}

function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Shopify OAuth HMAC over sorted query params (excluding hmac/signature). */
export function validateOAuthHmac(searchParams: URLSearchParams, secret: string) {
  const hmac = searchParams.get("hmac");
  if (!hmac) return false;

  const entries: string[] = [];
  searchParams.forEach((value, key) => {
    if (key === "hmac" || key === "signature") return;
    entries.push(`${key}=${value}`);
  });
  entries.sort();
  const message = entries.join("&");
  const digest = createHmac("sha256", secret).update(message).digest("hex");
  return safeEqual(digest, hmac);
}

async function storeOAuthState(shop: string, state: string) {
  const supabase = createAdminClient();
  const expires = new Date(Date.now() + STATE_TTL_MS).toISOString();
  const { error } = await supabase.from("shopify_sessions").upsert(
    {
      id: stateSessionId(state),
      shop,
      state,
      is_online: false,
      scope: null,
      expires,
      access_token: null,
      refresh_token: null,
      refresh_token_expires: null,
      online_access_info: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) throw error;
}

async function consumeOAuthState(shop: string, state: string) {
  const supabase = createAdminClient();
  const id = stateSessionId(state);
  const { data, error } = await supabase
    .from("shopify_sessions")
    .select("id, shop, state, expires")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return false;
  if (data.shop !== shop || data.state !== state) return false;
  if (!data.expires || new Date(data.expires).getTime() < Date.now()) {
    await supabase.from("shopify_sessions").delete().eq("id", id);
    return false;
  }

  await supabase.from("shopify_sessions").delete().eq("id", id);
  return true;
}

export function buildAuthorizeUrl(shop: string, state: string) {
  const scopes = SHOPIFY_SCOPES.join(",");
  const redirectUri = `${appBaseUrl()}${CALLBACK_PATH}`;
  const params = new URLSearchParams({
    client_id: apiKey(),
    scope: scopes,
    redirect_uri: redirectUri,
    state,
    "grant_options[]": "",
  });
  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

/** Start offline OAuth without relying on browser cookies for state. */
export async function beginOfflineOAuth(shopInput: string) {
  const shop = sanitizeShop(shopInput);
  if (!shop) throw new Error("Invalid shop parameter");
  if (!apiKey() || !apiSecret()) {
    throw new Error("Missing SHOPIFY_API_KEY / SHOPIFY_API_SECRET");
  }

  const state = nonce();
  await storeOAuthState(shop, state);
  return {
    shop,
    state,
    redirectUrl: buildAuthorizeUrl(shop, state),
  };
}

type AccessTokenResponse = {
  access_token: string;
  scope: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  associated_user?: unknown;
};

async function exchangeCodeForToken(shop: string, code: string) {
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: apiKey(),
      client_secret: apiSecret(),
      code,
      // Shopify rejects non-expiring offline tokens on the Admin API for public
      // apps (403 "GraphQL Client: Forbidden"). Request the expiring variant so
      // the response includes refresh_token / expires_in.
      expiring: "1",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${body}`);
  }

  return (await response.json()) as AccessTokenResponse;
}

function sessionFromTokenResponse(
  shop: string,
  state: string,
  token: AccessTokenResponse,
) {
  const offlineId = getShopify().session.getOfflineId(shop);
  const session = new Session({
    id: offlineId,
    shop,
    state,
    isOnline: false,
  });
  session.accessToken = token.access_token;
  session.scope = token.scope;
  if (token.expires_in) {
    session.expires = new Date(Date.now() + token.expires_in * 1000);
  }
  if (token.refresh_token && token.refresh_token_expires_in) {
    session.refreshToken = token.refresh_token;
    session.refreshTokenExpires = new Date(
      Date.now() + token.refresh_token_expires_in * 1000,
    );
  }
  return session;
}

export type OAuthCallbackResult = {
  session: Session;
  shop: string;
};

/** Complete OAuth using DB-backed state + HMAC (no cookie required). */
export async function completeOfflineOAuth(
  searchParams: URLSearchParams,
): Promise<OAuthCallbackResult> {
  const shop = sanitizeShop(searchParams.get("shop"));
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!shop || !code || !state) {
    throw new Error("Missing shop, code, or state in OAuth callback");
  }
  if (!validateOAuthHmac(searchParams, apiSecret())) {
    throw new Error("Invalid OAuth HMAC");
  }

  const stateOk = await consumeOAuthState(shop, state);
  if (!stateOk) {
    throw new Error(
      "OAuth state missing or expired. Start install again from /api/auth.",
    );
  }

  const token = await exchangeCodeForToken(shop, code);
  const session = sessionFromTokenResponse(shop, state, token);
  return { session, shop };
}

async function refreshAccessToken(shop: string, refreshToken: string) {
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: apiKey(),
      client_secret: apiSecret(),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${body}`);
  }

  return (await response.json()) as AccessTokenResponse;
}

/**
 * Exchange the stored refresh token for a new expiring offline access token.
 * The response carries a NEW refresh token that invalidates the old one, so it
 * is persisted atomically before returning. Returns null for legacy
 * non-expiring installs (no refresh token) — those must re-authorize.
 */
export async function refreshOfflineSession(shop: string): Promise<Session | null> {
  const existing = await loadOfflineSession(shop);
  if (!existing?.refreshToken) return null;

  const token = await refreshAccessToken(shop, existing.refreshToken);
  const session = sessionFromTokenResponse(shop, existing.state ?? "", token);
  await storeSession(session);
  return session;
}

/**
 * Legacy perpetual tokens (issued with expiring=0) are now rejected by the
 * Admin API. They have an access token but neither an expiry nor a refresh
 * token, so the merchant must re-authorize to mint an expiring token.
 */
export function isLegacyNonExpiringSession(session: Session): boolean {
  return Boolean(session.accessToken) && !session.expires && !session.refreshToken;
}

export { CALLBACK_PATH };
