import { Session } from "@shopify/shopify-api";
import { createAdminClient } from "@/lib/supabase/admin";

export function rowToSession(row: {
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
  const { getShopify } = await import("@/lib/shopify/index");
  const sessionId = getShopify().session.getOfflineId(shop);
  return loadSession(sessionId);
}
