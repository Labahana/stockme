/** Parse Shopify GID → numeric ID */
export function parseShopifyGid(gid: string): number {
  const id = gid.split("/").pop();
  if (!id) throw new Error(`Invalid Shopify GID: ${gid}`);
  const numeric = Number(id);
  if (!Number.isFinite(numeric)) throw new Error(`Invalid Shopify GID: ${gid}`);
  return numeric;
}

export function shopifyGid(resource: string, id: number | string): string {
  return `gid://shopify/${resource}/${id}`;
}
