import { fetchInventoryList, type InventoryListParams } from "@/lib/inventory/queries";

/** Resolve every variant ID matching inventory filters (true select-all). */
export async function fetchAllFilteredVariantIds(
  params: Omit<InventoryListParams, "page" | "limit">,
  options?: { max?: number },
) {
  const max = options?.max ?? 50_000;
  const limit = 500;
  const ids: string[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && ids.length < max) {
    const result = await fetchInventoryList({ ...params, page, limit });
    totalPages = result.pagination.totalPages;
    for (const item of result.items) {
      ids.push(item.variant_id);
      if (ids.length >= max) break;
    }
    if (result.items.length === 0) break;
    page += 1;
  }

  return ids;
}
