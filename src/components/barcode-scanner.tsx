"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BlockStack, Button } from "@shopify/polaris";
import { Html5Qrcode } from "html5-qrcode";

type BarcodeScannerProps = {
  elementId: string;
  onScan: (barcode: string) => void;
};

export function BarcodeScanner({ elementId, onScan }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scanning, setScanning] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const startScanner = useCallback(async () => {
    setStartError(null);
    setScanning(true);
    try {
      const scanner = new Html5Qrcode(elementId);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 120 } },
        (decoded) => onScan(decoded),
        () => undefined,
      );
    } catch (err) {
      setScanning(false);
      scannerRef.current = null;
      setStartError(
        err instanceof Error ? err.message : "Could not start camera",
      );
    }
  }, [elementId, onScan]);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    if (scanner) {
      try {
        await scanner.stop();
      } catch {
        // stop() rejects if already stopped or stream closed — safe to ignore.
      }
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      if (scanner) {
        scanner.stop().catch(() => undefined);
        scannerRef.current = null;
      }
    };
  }, []);

  return (
    <BlockStack gap="200">
      <div id={elementId} style={{ width: "100%", minHeight: scanning ? 240 : 0 }} />
      {startError && <p style={{ color: "#d72C0C" }}>{startError}</p>}
      <Button onClick={scanning ? stopScanner : startScanner}>
        {scanning ? "Stop scanner" : "Start barcode scanner"}
      </Button>
    </BlockStack>
  );
}
