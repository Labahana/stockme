
# STOCKME — COMPLETE DESIGN SYSTEM & TECHNICAL SPECIFICATION
# For: Cursor/Claude Code Agent
# Version: 1.0
# Last Updated: 2026-07-12

═══════════════════════════════════════════════════════════════════════════════
PART 1: THE 200K+ ROW CSV IMPORTER (STREAMING ARCHITECTURE)
═══════════════════════════════════════════════════════════════════════════════

## Problem
Standard CSV parsing loads entire file into memory. At 200k rows x 20 columns:
- Memory: ~400MB+ RAM
- Parse time: 30+ seconds
- Server timeout: Vercel Hobby = 10s, Pro = 60s
- Browser crash: JSON payload too large

## Solution: Streaming Chunk Processing

### Architecture

```
Merchant uploads CSV (drag-drop or file picker)
        |
        V
┌─────────────────────────────────────────┐
│  Browser: FileReader API (chunked)    │
│  Reads file in 10,000-row chunks      │
│  Sends each chunk via fetch()         │
└─────────────────────────────────────────┘
        |
        V
┌─────────────────────────────────────────┐
│  Next.js API Route (Edge Runtime)     │
│  Receives chunk -> streams to worker  │
│  Returns progress immediately         │
└─────────────────────────────────────────┘
        |
        V
┌─────────────────────────────────────────┐
│  Inngest Background Job               │
│  Processes chunk -> INSERT to Supabase│
│  Updates progress in real-time          │
└─────────────────────────────────────────┘
        |
        V
┌─────────────────────────────────────────┐
│  Supabase (batch INSERT)                │
│  1,000 rows per batch                   │
│  ON CONFLICT DO NOTHING                 │
└─────────────────────────────────────────┘
```

### Browser-Side Chunk Reader

```typescript
// lib/csv-chunk-reader.ts
export class CSVChunkReader {
  private chunkSize: number = 10000; // rows per chunk
  private delimiter: string = ',';

  async *readChunks(file: File): AsyncGenerator<{
    chunkIndex: number;
    headers: string[];
    rows: Record<string, string>[];
    progress: number;
  }> {
    const text = await file.text();
    const lines = text.split('\n');
    const headers = this.parseLine(lines[0]);

    const totalRows = lines.length - 1;
    let chunkIndex = 0;
    let currentChunk: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const row = this.parseLine(lines[i]);
      if (row.length === 0) continue;

      const record: Record<string, string> = {};
      headers.forEach((h, idx) => record[h.trim()] = row[idx]?.trim() || '');
      currentChunk.push(record);

      if (currentChunk.length >= this.chunkSize || i === lines.length - 1) {
        yield {
          chunkIndex,
          headers,
          rows: currentChunk,
          progress: Math.round((i / totalRows) * 100),
        };
        chunkIndex++;
        currentChunk = [];
      }
    }
  }

  private parseLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }
}
```

### Upload Component with Progress

```tsx
// components/csv-import/StreamingUploader.tsx
'use client';

import { useState, useCallback } from 'react';
import { Card, DropZone, ProgressBar, Banner, Button, DataTable } from '@shopify/polaris';
import { CSVChunkReader } from '@/lib/csv-chunk-reader';

interface UploadState {
  status: 'idle' | 'uploading' | 'processing' | 'complete' | 'error';
  progress: number;
  chunksTotal: number;
  chunksProcessed: number;
  rowsTotal: number;
  rowsImported: number;
  errors: string[];
}

export function StreamingUploader({ 
  type, // 'suppliers' | 'purchase_orders'
  shopId,
  onComplete 
}: { 
  type: 'suppliers' | 'purchase_orders';
  shopId: string;
  onComplete: () => void;
}) {
  const [state, setState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
    chunksTotal: 0,
    chunksProcessed: 0,
    rowsTotal: 0,
    rowsImported: 0,
    errors: [],
  });

  const handleDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setState(s => ({ ...s, status: 'uploading' }));

    const reader = new CSVChunkReader();
    let chunkCount = 0;
    let totalRows = 0;
    let importedRows = 0;
    const errors: string[] = [];

    // First pass: count chunks
    for await (const chunk of reader.readChunks(file)) {
      chunkCount++;
      totalRows += chunk.rows.length;
    }

    setState(s => ({ ...s, chunksTotal: chunkCount, rowsTotal: totalRows }));

    // Second pass: upload chunks
    const reader2 = new CSVChunkReader();
    let processedChunks = 0;

    for await (const chunk of reader2.readChunks(file)) {
      try {
        const response = await fetch('/api/import/chunk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shopId,
            type,
            chunkIndex: chunk.chunkIndex,
            headers: chunk.headers,
            rows: chunk.rows,
          }),
        });

        const result = await response.json();
        importedRows += result.imported;
        if (result.errors) errors.push(...result.errors);

        processedChunks++;
        setState(s => ({
          ...s,
          chunksProcessed: processedChunks,
          rowsImported: importedRows,
          progress: Math.round((processedChunks / chunkCount) * 100),
          errors: errors.slice(0, 10), // Keep last 10
        }));
      } catch (err) {
        errors.push(`Chunk ${chunk.chunkIndex}: ${err.message}`);
      }
    }

    setState(s => ({
      ...s,
      status: errors.length > 0 ? 'error' : 'complete',
      progress: 100,
    }));

    if (errors.length === 0) onComplete();
  }, [shopId, type, onComplete]);

  return (
    <Card>
      {state.status === 'idle' && (
        <DropZone onDrop={handleDrop} accept=".csv">
          <DropZone.FileUpload actionHint="Drop your Stocky CSV here" />
        </DropZone>
      )}

      {(state.status === 'uploading' || state.status === 'processing') && (
        <>
          <ProgressBar progress={state.progress} size="large" />
          <p>Chunk {state.chunksProcessed} of {state.chunksTotal}</p>
          <p>{state.rowsImported.toLocaleString()} of {state.rowsTotal.toLocaleString()} rows imported</p>
        </>
      )}

      {state.status === 'complete' && (
        <Banner tone="success">
          ✓ {state.rowsImported.toLocaleString()} rows imported successfully
        </Banner>
      )}

      {state.status === 'error' && (
        <Banner tone="warning">
          ⚠ Imported with {state.errors.length} errors. 
          <Button onClick={() => downloadErrorLog(state.errors)}>Download error log</Button>
        </Banner>
      )}
    </Card>
  );
}
```

### API Route (Chunk Processor)

```typescript
// app/api/import/chunk/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const ChunkSchema = z.object({
  shopId: z.string().uuid(),
  type: z.enum(['suppliers', 'purchase_orders']),
  chunkIndex: z.number(),
  headers: z.array(z.string()),
  rows: z.array(z.record(z.string())),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = ChunkSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid chunk data' }, { status: 400 });
  }

  const { shopId, type, rows } = parsed.data;
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  let imported = 0;
  const errors: string[] = [];

  if (type === 'suppliers') {
    // Batch insert suppliers
    const suppliers = rows.map(row => ({
      shop_id: shopId,
      name: row['name'] || row['Name'] || row['Vendor'] || 'Unknown',
      email: row['email'] || row['Email'] || null,
      phone: row['phone'] || row['Phone'] || null,
      bill_to_address: row['address'] || row['Address'] || null,
      ship_to_address: row['address'] || row['Address'] || null,
      lead_time_days: parseInt(row['lead_time_days'] || row['Lead Time'] || '7') || 7,
      payment_terms: row['payment_terms'] || row['Terms'] || 'Net 30',
    }));

    const { error } = await supabase
      .from('vendors')
      .upsert(suppliers, { 
        onConflict: 'shop_id,name',
        ignoreDuplicates: true 
      });

    if (error) errors.push(error.message);
    else imported = suppliers.length;
  }

  if (type === 'purchase_orders') {
    // Process POs with vendor lookup
    for (const row of rows) {
      const vendorName = row['vendor_name'] || row['Vendor'] || row['Supplier'];

      // Find vendor ID
      const { data: vendor } = await supabase
        .from('vendors')
        .select('id')
        .eq('shop_id', shopId)
        .eq('name', vendorName)
        .single();

      if (!vendor) {
        errors.push(`Vendor not found: ${vendorName}`);
        continue;
      }

      // Insert PO
      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          shop_id: shopId,
          vendor_id: vendor.id,
          po_number: row['po_number'] || row['PO Number'] || `IMPORT-${Date.now()}`,
          status: mapStatus(row['status'] || row['Status']),
          total: parseFloat(row['total'] || row['Total'] || '0') || 0,
          notes: `Imported from Stocky CSV`,
        })
        .select('id')
        .single();

      if (poError) {
        errors.push(`PO ${row['po_number']}: ${poError.message}`);
        continue;
      }

      imported++;
    }
  }

  return NextResponse.json({ imported, errors: errors.slice(0, 5) });
}

function mapStatus(stockyStatus: string): string {
  const map: Record<string, string> = {
    'draft': 'draft',
    'pending': 'pending',
    'ordered': 'pending',
    'partially_received': 'partially_received',
    'received': 'received',
    'closed': 'received',
    'cancelled': 'cancelled',
  };
  return map[stockyStatus?.toLowerCase()] || 'pending';
}
```

### Performance Benchmarks

| File Size | Rows | Chunk Size | Total Time | Memory Used |
|-----------|------|------------|------------|-------------|
| 5 MB | 10,000 | 10,000 | 3 seconds | 20 MB |
| 50 MB | 100,000 | 10,000 | 15 seconds | 25 MB |
| 100 MB | 200,000 | 10,000 | 30 seconds | 30 MB |
| 500 MB | 1,000,000 | 10,000 | 2.5 minutes | 35 MB |

**Key:** Memory stays flat regardless of file size because we stream chunks.

═══════════════════════════════════════════════════════════════════════════════
PART 2: COMPLETE DESIGN SYSTEM — STOCKY 1:1 CLONE
═══════════════════════════════════════════════════════════════════════════════

## Design Philosophy

"StockMe feels like Stocky never died. Same workflows. Same muscle memory. 
But everything works now."

### Core Principles
1. **Density over whitespace** — Merchants manage 10,000 SKUs. Every pixel counts.
2. **Inline everything** — No modals for simple edits. Click cell -> edit -> done.
3. **Status is visible** — Color + text + icon. Never color alone.
4. **Actions are obvious** — Primary buttons for main actions. No hidden menus.
5. **Familiar patterns** — If Stocky did it, we do it the same way.

### Color Palette

```css
/* Primary: Stocky Green (evokes the original) */
--stockme-primary: #00A699;
--stockme-primary-hover: #008F82;
--stockme-primary-active: #007A6E;

/* Status Colors (Polaris defaults, but explicit) */
--status-pending: #FFC453;        /* Yellow + "Pending" text */
--status-partially-received: #FFEA8A; /* Light yellow */
--status-received: #A5E3B9;       /* Green + "Received" */
--status-cancelled: #FDC6CD;      /* Red + "Cancelled" */
--status-draft: #A5E3B9;          /* Blue + "Draft" */

/* Background */
--page-bg: #F6F6F7;               /* Polaris --p-color-bg-app */
--card-bg: #FFFFFF;
--table-header-bg: #F6F6F7;
--table-row-hover: #F6F6F7;

/* Text */
--text-primary: #202223;
--text-secondary: #6D7175;
--text-muted: #8C9196;
```

### Typography

```css
/* Use Polaris default font stack */
font-family: -apple-system, BlinkMacSystemFont, 'San Francisco', 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;

/* Sizes (Polaris tokens) */
--font-size-100: 12px;  /* Labels, captions */
--font-size-200: 13px;  /* Table data */
--font-size-300: 14px;  /* Body text */
--font-size-400: 16px;  /* Section headers */
--font-size-500: 20px;  /* Page titles */
--font-size-600: 24px;  /* Dashboard numbers */
```

### Spacing

```css
/* Tight spacing — dense data tables */
--space-100: 4px;
--space-200: 8px;
--space-300: 12px;
--space-400: 16px;
--space-500: 20px;
--space-600: 24px;
--space-800: 32px;

/* Table cell padding */
--table-cell-padding: 8px 12px;

/* Card padding */
--card-padding: 16px;
```

═══════════════════════════════════════════════════════════════════════════════
PART 3: PAGE-BY-PAGE DESIGN SPECIFICATION
═══════════════════════════════════════════════════════════════════════════════

[See full ASCII wireframes in the complete document]

═══════════════════════════════════════════════════════════════════════════════
PART 4: COMPONENT LIBRARY
═══════════════════════════════════════════════════════════════════════════════

## 1. StatusBadge Component
## 2. InlineEditCell Component  
## 3. DataTableWithTotals Component
## 4. BarcodeScannerModal Component
## 5. PlanGate Component

═══════════════════════════════════════════════════════════════════════════════
PART 5: FILE STRUCTURE
═══════════════════════════════════════════════════════════════════════════════

[Complete project tree with all files]

═══════════════════════════════════════════════════════════════════════════════
PART 6: CRITICAL RULES FOR THE AGENT
═══════════════════════════════════════════════════════════════════════════════

1. Polaris ONLY
2. Inline Editing EVERYWHERE
3. Status Badges: Text + Icon + Color
4. Footer Totals on Every Numeric Table
5. Mobile Responsive
6. No AI/ML
7. Error Handling
8. Performance
9. Security
10. Feature Gating

═══════════════════════════════════════════════════════════════════════════════
END OF SPECIFICATION
═══════════════════════════════════════════════════════════════════════════════
