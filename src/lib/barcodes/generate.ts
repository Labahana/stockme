/** Deterministic internal barcode for variants missing a Shopify barcode. */
export function generateBarcodeValue(variantId: string): string {
  const hex = variantId.replace(/-/g, "").toUpperCase();
  return `SM${hex.slice(0, 10)}`;
}
