import type { Session } from "@shopify/shopify-api";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  deleteSession as deleteStoredSession,
  loadSession as loadStoredSession,
  rowToSession,
  storeSession as persistSession,
} from "@/lib/shopify/sessions";

/** Shopify OAuth state + session persistence backed by Supabase. */
export class SupabaseSessionStorage {
  async storeSession(session: Session): Promise<boolean> {
    await persistSession(session);
    return true;
  }

  async loadSession(id: string): Promise<Session | undefined> {
    return loadStoredSession(id);
  }

  async deleteSession(id: string): Promise<boolean> {
    await deleteStoredSession(id);
    return true;
  }

  async deleteSessions(ids: string[]): Promise<boolean> {
    await Promise.all(ids.map((id) => deleteStoredSession(id)));
    return true;
  }

  async findSessionsByShop(shop: string): Promise<Session[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("shopify_sessions")
      .select("*")
      .eq("shop", shop);

    if (error) throw error;
    return (data ?? []).map(rowToSession);
  }
}

export const supabaseSessionStorage = new SupabaseSessionStorage();
