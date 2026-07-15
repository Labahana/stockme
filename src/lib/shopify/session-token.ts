import { getShopify, sanitizeShop } from "@/lib/shopify";

export type SessionTokenPayload = {
  dest: string;
  aud: string;
  exp: number;
  nbf: number;
  iat: number;
  jti: string;
  sub: string;
  iss: string;
  sid: string;
  sig: string;
};

/**
 * Verify App Bridge session / ID token (JWT signed with SHOPIFY_API_SECRET).
 * Returns the shop domain from `dest`.
 */
export async function shopFromSessionToken(token: string): Promise<string | null> {
  const shopify = getShopify();
  const payload = (await shopify.session.decodeSessionToken(token)) as SessionTokenPayload;
  const dest = payload.dest;
  if (!dest) return null;
  try {
    const host = dest.startsWith("http") ? new URL(dest).hostname : dest;
    return sanitizeShop(host);
  } catch {
    return sanitizeShop(dest);
  }
}

export function bearerFromRequest(authorization: string | null): string | null {
  if (!authorization) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match?.[1]?.trim() || null;
}
