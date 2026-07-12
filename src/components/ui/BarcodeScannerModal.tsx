"use client";

import { Modal } from "@shopify/polaris";
import { BarcodeScanner } from "@/components/barcode-scanner";

export function BarcodeScannerModal({
  open,
  onClose,
  onScan,
  title = "Scan barcode",
  elementId = "stockme-barcode-modal",
}: {
  open: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
  elementId?: string;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} secondaryActions={[{ content: "Close", onAction: onClose }]}>
      <Modal.Section>
        {open && (
          <BarcodeScanner
            elementId={elementId}
            onScan={(code) => {
              onScan(code);
            }}
          />
        )}
      </Modal.Section>
    </Modal>
  );
}
