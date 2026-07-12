"use client";

import { useCallback, useState } from "react";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  DropZone,
  ProgressBar,
  Text,
} from "@shopify/polaris";
import { CSVChunkReader } from "@/lib/csv-chunk-reader";
import { apiUrl } from "@/lib/hooks/use-shop";

type UploadState = {
  status: "idle" | "uploading" | "complete" | "error";
  progress: number;
  chunksTotal: number;
  chunksProcessed: number;
  rowsTotal: number;
  rowsImported: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  fileName: string | null;
};

const initialState: UploadState = {
  status: "idle",
  progress: 0,
  chunksTotal: 0,
  chunksProcessed: 0,
  rowsTotal: 0,
  rowsImported: 0,
  created: 0,
  updated: 0,
  skipped: 0,
  errors: [],
  fileName: null,
};

export function StreamingUploader({
  type,
  shop,
  createMissingSuppliers = true,
  onComplete,
}: {
  type: "suppliers" | "purchase_orders";
  shop: string;
  createMissingSuppliers?: boolean;
  onComplete?: () => void;
}) {
  const [state, setState] = useState<UploadState>(initialState);

  const downloadErrorLog = () => {
    const blob = new Blob([state.errors.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stockme-import-errors-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDrop = useCallback(
    async (_drops: File[], accepted: File[]) => {
      const file = accepted[0];
      if (!file) return;

      setState({
        ...initialState,
        status: "uploading",
        fileName: file.name,
      });

      const reader = new CSVChunkReader(5_000);
      const chunks: {
        chunkIndex: number;
        rows: Record<string, string>[];
      }[] = [];
      let totalRows = 0;

      for await (const chunk of reader.readChunks(file)) {
        chunks.push({ chunkIndex: chunk.chunkIndex, rows: chunk.rows });
        totalRows += chunk.rows.length;
      }

      if (chunks.length === 0) {
        setState((s) => ({
          ...s,
          status: "error",
          errors: ["CSV is empty or could not be parsed"],
        }));
        return;
      }

      setState((s) => ({
        ...s,
        chunksTotal: chunks.length,
        rowsTotal: totalRows,
      }));

      let importedRows = 0;
      let created = 0;
      let updated = 0;
      let skipped = 0;
      const errors: string[] = [];
      let rowOffset = 0;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        try {
          const response = await fetch(apiUrl("/api/import/chunk", shop), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type,
              chunkIndex: chunk.chunkIndex,
              rowOffset,
              rows: chunk.rows,
              createMissingSuppliers,
            }),
          });
          const result = await response.json();
          if (!response.ok) {
            errors.push(`Chunk ${chunk.chunkIndex}: ${result.error ?? "failed"}`);
          } else {
            importedRows += Number(result.imported ?? 0);
            created += Number(result.created ?? 0);
            updated += Number(result.updated ?? 0);
            skipped += Number(result.skipped ?? 0);
            if (Array.isArray(result.errors)) {
              errors.push(...result.errors);
            }
          }
        } catch (err) {
          errors.push(
            `Chunk ${chunk.chunkIndex}: ${err instanceof Error ? err.message : "network error"}`,
          );
        }

        rowOffset += chunk.rows.length;
        setState((s) => ({
          ...s,
          chunksProcessed: i + 1,
          rowsImported: importedRows,
          created,
          updated,
          skipped,
          progress: Math.round(((i + 1) / chunks.length) * 100),
          errors: errors.slice(0, 25),
        }));
      }

      const hasHardFailure = importedRows === 0 && errors.length > 0;
      setState((s) => ({
        ...s,
        status: hasHardFailure ? "error" : errors.length > 0 ? "error" : "complete",
        progress: 100,
        errors: errors.slice(0, 25),
      }));

      if (!hasHardFailure) onComplete?.();
    },
    [shop, type, createMissingSuppliers, onComplete],
  );

  const reset = () => setState(initialState);

  return (
    <Card>
      <BlockStack gap="400">
        {state.status === "idle" && (
          <DropZone accept=".csv,text/csv" type="file" onDrop={handleDrop}>
            <DropZone.FileUpload actionHint="Drop your Stocky CSV here — streams in 5,000-row chunks" />
          </DropZone>
        )}

        {state.status === "uploading" && (
          <BlockStack gap="200">
            <Text as="p" fontWeight="semibold">
              Importing {state.fileName}
            </Text>
            <ProgressBar progress={state.progress} size="large" />
            <Text as="p" tone="subdued">
              Chunk {state.chunksProcessed} of {state.chunksTotal} ·{" "}
              {state.rowsImported.toLocaleString()} imported of{" "}
              {state.rowsTotal.toLocaleString()} rows
            </Text>
          </BlockStack>
        )}

        {state.status === "complete" && (
          <Banner tone="success" onDismiss={reset}>
            {state.created.toLocaleString()} created, {state.updated.toLocaleString()} updated
            {state.skipped > 0 ? `, ${state.skipped.toLocaleString()} skipped` : ""} across{" "}
            {state.rowsTotal.toLocaleString()} rows.
          </Banner>
        )}

        {state.status === "error" && (
          <Banner tone="warning" onDismiss={reset}>
            <BlockStack gap="200">
              <Text as="p">
                Imported {state.rowsImported.toLocaleString()} with {state.errors.length} error
                {state.errors.length === 1 ? "" : "s"}.
              </Text>
              {state.errors.slice(0, 5).map((e) => (
                <Text as="p" key={e} variant="bodySm" tone="subdued">
                  {e}
                </Text>
              ))}
              {state.errors.length > 0 && (
                <Button onClick={downloadErrorLog}>Download error log</Button>
              )}
            </BlockStack>
          </Banner>
        )}

        {state.status !== "idle" && state.status !== "uploading" && (
          <Button onClick={reset}>Upload another file</Button>
        )}
      </BlockStack>
    </Card>
  );
}
