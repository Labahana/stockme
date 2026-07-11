import JsBarcode from "jsbarcode";

/** Render a Code128 barcode to a data-URL PNG (client-side only). */
export function renderBarcodeDataUrl(value: string): string {
  const canvas = document.createElement("canvas");
  JsBarcode(canvas, value, {
    format: "CODE128",
    width: 2,
    height: 80,
    displayValue: true,
    fontSize: 14,
    margin: 8,
  });
  return canvas.toDataURL("image/png");
}
