import { getShopify } from "@/lib/shopify";

function apiKey() {
  return (
    process.env.SHOPIFY_API_KEY ||
    process.env.NEXT_PUBLIC_SHOPIFY_API_KEY ||
    ""
  );
}

/**
 * After OAuth, always bounce the merchant into Shopify Admin's embedded app
 * surface. Redirecting to the raw app domain (without Admin iframe / host)
 * breaks App Bridge session tokens and looks "broken after OAuth" to App Store
 * reviewers (requirement 2.1.3).
 */
export async function postInstallAdminUrl(
  shop: string,
  hostParam: string | null | undefined,
): Promise<string> {
  const key = apiKey();
  if (hostParam) {
    try {
      return await getShopify().auth.buildEmbeddedAppUrl(hostParam);
    } catch (error) {
      console.error("buildEmbeddedAppUrl failed, using admin/apps fallback:", error);
    }
  }

  if (!key) {
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
      "https://stockme.gentletap.co";
    return `${appUrl}/app?shop=${encodeURIComponent(shop)}`;
  }

  // Top-level Admin URL → Admin embeds the app with shop + host for App Bridge.
  return `https://${shop}/admin/apps/${key}`;
}
