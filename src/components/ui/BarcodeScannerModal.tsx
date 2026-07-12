"use client";

import { Banner, BlockStack, Modal, Text } from "@shopify/polaris";
import { useEffect, useState } from "react";
import { BarcodeScanner } from "@/components/barcode-scanner";

/** Spec §15 — camera barcode modal for PO receive + stocktakes. */
export function BarcodeScannerModal({
  open,
  onClose,
  onScan,
  title = "Scan Barcodes",
  lastScanLabel,
}: {
  open: boolean;
  onClose: () => void;
  onScan: (decodedText: string) => void;
  title?: string;
  lastScanLabel?: string | null;
}) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setError(null);
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      primaryAction={{ content: "Done", onAction: onClose }}
    >
      <Modal.Section>
        <BlockStack gap="300">
          {error && (
            <Banner tone="critical" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          )}
          <Text as="p" tone="subdued">
            Supports Code 128, EAN-13, and UPC-A. Point the camera at the barcode.
          </Text>
          {open && (
            <BarcodeScanner
              elementId="barcode-scanner-container"
              onScan={(code) => {
                setError(null);
                onScan(code);
              }}
            />
          )}
          {lastScanLabel && (
            <Banner tone="success">
              Scanned: {lastScanLabel}
            </Banner>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
