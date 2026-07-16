# STOCKME FREE TIER OPTIMIZATION GUIDE
## How to Handle 500+ Merchants on $0 Infrastructure

**Version:** 1.0  
**Date:** 2026-07-12  
**Stack:** Next.js 14 + Vercel Hobby + Supabase Free + Resend Free  
**Goal:** Maximize free tier capacity before paying a single dollar

---

## TABLE OF CONTENTS

1. [The Free Tier Battlefield](#1-the-free-tier-battlefield)
2. [Database Optimization: The 500 MB War](#2-database-optimization-the-500-mb-war)
3. [Vercel Optimization: Killing the 10-Second Timeout](#3-vercel-optimization-killing-the-10-second-timeout)
4. [Bandwidth Optimization: Stretching 5 GB Egress](#4-bandwidth-optimization-stretching-5-gb-egress)
5. [Email Optimization: 3,000 Emails for 500 Merchants](#5-email-optimization-3000-emails-for-500-merchants)
6. [The 7-Day Pause Problem](#6-the-7-day-pause-problem)
7. [The Nuclear Option: Zero-Cost Database Scaling](#7-the-nuclear-option-zero-cost-database-scaling)
8. [Capacity Matrix: Before vs After](#8-capacity-matrix-before-vs-after)
9. [When to Actually Pay](#9-when-to-actually-pay)
10. [Quick Wins Checklist](#10-quick-wins-checklist)
11. [Complete Code Reference](#11-complete-code-reference)

---

## 1. THE FREE TIER BATTLEFIELD

### The Hard Limits (2026)

| Service | Free Tier Limit | What Kills You | Cost to Upgrade |
|---------|----------------|---------------|-----------------|
| **Vercel Hobby** | 10s function timeout, 100 GB bandwidth, 100 GB-hours functions | Large SKU syncs, CSV exports, slow queries | $20/mo Pro |
| **Supabase Free** | 500 MB database, 5 GB egress, 200 concurrent connections, pauses after 7 days inactivity | Database size (always hits first), bandwidth spikes | $25/mo Pro |
| **Resend** | 3,000 emails/month | Daily alerts to many merchants | $20/mo Pro |
| **Shopify Partner** | Unlimited custom app installs, no App Store listing fee | $19 one-time App Store registration | $19 one-time |

**The real killer is Supabase's 500 MB database.** When exceeded, free projects enter **read-only mode** — no writes until you upgrade or purge data. This is not a soft limit. Your app breaks.

### The Math: How Fast 500 MB Fills

| Data Type | Size Per Record | Records per Merchant | Space per Merchant |
|-----------|----------------|---------------------|-------------------|
| Products + Variants | ~400 bytes | 2,000 SKUs | **0.8 MB** |
| Inventory Levels | ~200 bytes | 2,000 SKUs × 3 locations | **1.2 MB** |
| Purchase Orders | ~2 KB | 500 POs/year | **1.0 MB** |
| PO Line Items | ~500 bytes | 10,000 lines/year | **5.0 MB** |
| Stock Takes | ~1 KB | 200/year | **0.2 MB** |
| Vendors | ~500 bytes | 50 | **0.025 MB** |
| **Webhook Logs** | **~2 KB** | **50,000/year** | **~100 MB** |

**Total per merchant (1 year): ~110 MB** (mostly webhook logs)  
**Without webhook logs: ~10 MB per merchant**

| Scenario | Merchants on Free | Status |
|----------|------------------|--------|
| Default (with logs) | **4–5 merchants** | ❌ Unusable |
| With 30-day log purge | **15–20 merchants** | ⚠️ Tight |
| With aggressive optimization | **200–500+ merchants** | ✅ Viable |

---

## 2. DATABASE OPTIMIZATION: THE 500 MB WAR

### 2.1 Schema Optimization (Save 40–50% Space)

Every byte matters. Use the smallest data type that fits your data.

#### Before vs After

| Field | Current (Wasteful) | Optimized | Savings |
|-------|-------------------|-----------|---------|
| SKU | `TEXT` (unlimited) | `VARCHAR(50)` | ~2x |
| Email | `TEXT` | `VARCHAR(255)` | ~2x |
| Product title | `TEXT` (store full text) | `VARCHAR(200)` + fetch from Shopify on display | ~5x |
| Description | `TEXT` | Don't store — fetch from Shopify | Infinite |
| UUID as string | `TEXT` | `UUID` type | ~2x |
| Cost/price | `FLOAT` | `DECIMAL(10,2)` | Same space, correct math |
| Timestamps | `TIMESTAMP` | `TIMESTAMPTZ` | Same space, timezone-safe |
| Status enum | `VARCHAR(20)` | `SMALLINT` (mapped to enum) | ~4x |
| Boolean flags | `BOOLEAN` | `BIT(8)` (pack 8 booleans into 1 byte) | ~8x |

#### The Optimized Schema

```sql
-- shops: 50 bytes per row (was 200+)
CREATE TABLE shops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_domain VARCHAR(100) NOT NULL UNIQUE,
    access_token VARCHAR(255) NOT NULL, -- encrypted
    plan SMALLINT DEFAULT 1, -- 1=Starter, 2=Growth, 3=Pro
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ,
    INDEX idx_shops_domain (shop_domain)
);

-- vendors: 80 bytes per row (was 300+)
CREATE TABLE vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(30),
    bill_to_address VARCHAR(500), -- compressed if needed
    ship_to_address VARCHAR(500),
    lead_time_days SMALLINT DEFAULT 7,
    payment_terms VARCHAR(50) DEFAULT 'Net 30',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    INDEX idx_vendors_shop (shop_id)
);

-- products: 60 bytes per row (was 400+)
-- Store ONLY what you need for inventory ops
-- Fetch titles, descriptions from Shopify on display
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    shopify_product_id VARCHAR(50) NOT NULL,
    shopify_variant_id VARCHAR(50) NOT NULL,
    sku VARCHAR(50) NOT NULL,
    barcode VARCHAR(50),
    cost DECIMAL(10,2),
    tracked BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(shop_id, shopify_variant_id),
    INDEX idx_products_shop_sku (shop_id, sku),
    INDEX idx_products_barcode (shop_id, barcode)
);

-- inventory_levels: 30 bytes per row (was 200+)
CREATE TABLE inventory_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    location_id VARCHAR(50) NOT NULL,
    available SMALLINT DEFAULT 0, -- max 32,767. Use INTEGER if needed
    incoming SMALLINT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(product_id, location_id),
    INDEX idx_inventory_product (product_id),
    INDEX idx_inventory_location (location_id)
);

-- purchase_orders: 150 bytes per row
CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    po_number VARCHAR(50) NOT NULL,
    status SMALLINT DEFAULT 1, -- 1=draft, 2=pending, 3=partial, 4=received, 5=cancelled
    total DECIMAL(10,2) DEFAULT 0,
    received_total DECIMAL(10,2) DEFAULT 0,
    notes VARCHAR(1000),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    INDEX idx_pos_shop (shop_id),
    INDEX idx_pos_vendor (vendor_id),
    INDEX idx_pos_status (shop_id, status)
);

-- po_line_items: 60 bytes per row
CREATE TABLE po_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    qty_ordered SMALLINT DEFAULT 0,
    qty_received SMALLINT DEFAULT 0,
    unit_cost DECIMAL(10,2) DEFAULT 0,
    total_cost DECIMAL(10,2) DEFAULT 0,
    INDEX idx_lineitems_po (po_id),
    INDEX idx_lineitems_product (product_id)
);

-- receipts (for partial receiving): 80 bytes per row
CREATE TABLE receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    received_at TIMESTAMPTZ DEFAULT NOW(),
    invoice_number VARCHAR(50),
    notes VARCHAR(500),
    INDEX idx_receipts_po (po_id)
);

-- receipt_line_items: 40 bytes per row
CREATE TABLE receipt_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    po_line_item_id UUID NOT NULL REFERENCES po_line_items(id) ON DELETE CASCADE,
    qty_received SMALLINT DEFAULT 0,
    INDEX idx_receipt_lines_receipt (receipt_id)
);

-- stock_takes: 100 bytes per row
CREATE TABLE stock_takes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    location_id VARCHAR(50) NOT NULL,
    status SMALLINT DEFAULT 1, -- 1=counting, 2=review, 3=posted, 4=cancelled
    counted_at TIMESTAMPTZ,
    posted_at TIMESTAMPTZ,
    notes VARCHAR(500),
    INDEX idx_stocks_shop (shop_id)
);

-- stock_take_items: 50 bytes per row
CREATE TABLE stock_take_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_take_id UUID NOT NULL REFERENCES stock_takes(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    expected_qty SMALLINT DEFAULT 0,
    counted_qty SMALLINT DEFAULT 0,
    variance SMALLINT DEFAULT 0, -- auto-computed
    INDEX idx_sttake_items_take (stock_take_id)
);

-- alerts: 60 bytes per row
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    location_id VARCHAR(50),
    alert_type SMALLINT DEFAULT 1, -- 1=low_stock, 2=out_of_stock, 3=overstock
    threshold SMALLINT DEFAULT 0,
    triggered_at TIMESTAMPTZ DEFAULT NOW(),
    sent BOOLEAN DEFAULT FALSE,
    INDEX idx_alerts_shop (shop_id),
    INDEX idx_alerts_sent (sent)
);

-- webhook_logs: 50 bytes per row (was 2,000+ bytes)
-- Store ONLY metadata, not the full payload
CREATE TABLE webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    topic VARCHAR(50) NOT NULL, -- e.g., 'products/create'
    webhook_id VARCHAR(50) NOT NULL, -- Shopify's webhook ID for idempotency
    status SMALLINT DEFAULT 1, -- 1=received, 2=processing, 3=processed, 4=error
    processed_at TIMESTAMPTZ,
    error_message VARCHAR(255), -- truncated, not full stack trace
    INDEX idx_webhooks_shop (shop_id),
    INDEX idx_webhooks_processed (processed_at)
);
```

**Space saved: ~60% compared to naive schema.**

---

### 2.2 The Webhook Log Problem (Biggest Space Hog)

**The crime:** Storing full webhook payloads in the database.

**A single `inventory_levels/update` webhook payload:**
```json
{
  "id": 6554415982788,
  "inventory_item_id": 44632934482084,
  "location_id": 69288521892,
  "available": 15,
  "updated_at": "2026-07-12T10:42:00Z",
  "admin_graphql_api_id": "gid://shopify/InventoryLevel/6554415982788?inventory_item_id=44632934482084"
}
```
**Size: ~2,000 bytes.**

**50,000 webhooks/month = 100 MB.** That's 20% of your free database gone in one month.

#### The Fix: Metadata-Only Logging

```sql
-- Instead of storing the full payload, store only:
CREATE TABLE webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL,
    topic VARCHAR(50) NOT NULL,        -- 'inventory_levels/update'
    webhook_id VARCHAR(50) NOT NULL,    -- Shopify's unique ID
    status SMALLINT DEFAULT 1,           -- 1=received, 2=processed, 3=error
    processed_at TIMESTAMPTZ,
    error_message VARCHAR(255),          -- Only if error, truncated
    -- NO payload column. NO body column.
);
-- Size per row: ~50 bytes (was 2,000)
-- 50,000 webhooks = 2.5 MB (was 100 MB)
```

**If you need the payload for debugging:** Log it to Vercel's serverless logs (free, 7-day retention) or send to a cheap logging service.

---

### 2.3 Aggressive Log Purging (The 7-Day Rule)

```sql
-- Run this as a daily cron job in Supabase
-- Supabase has built-in pg_cron extension

-- Enable cron extension (one time)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily purge at 3 AM UTC
SELECT cron.schedule(
    'daily-webhook-purge',
    '0 3 * * *',  -- Every day at 3 AM UTC
    $$DELETE FROM webhook_logs WHERE processed_at < NOW() - INTERVAL '7 days'$$
);

-- Also purge old alerts (sent = true, older than 30 days)
SELECT cron.schedule(
    'daily-alert-purge',
    '0 3 * * *',
    $$DELETE FROM alerts WHERE sent = TRUE AND triggered_at < NOW() - INTERVAL '30 days'$$
);

-- Purge old stock takes (posted, older than 90 days)
SELECT cron.schedule(
    'quarterly-stocktake-purge',
    '0 3 1 * *',  -- First of every month at 3 AM
    $$DELETE FROM stock_takes WHERE status = 3 AND posted_at < NOW() - INTERVAL '90 days'$$
);
```

**Result with 7-day purge vs 30-day:**

| Retention | Webhook Logs (50k/month) | Space Saved |
|-----------|-------------------------|-------------|
| 30 days | 100 MB | Baseline |
| 7 days | 23 MB | **77% reduction** |
| 3 days | 10 MB | **90% reduction** |
| 1 day | 3.3 MB | **97% reduction** |

**Recommendation:** 7 days for webhooks, 30 days for alerts, 90 days for posted stock takes.

---

### 2.4 Archive Strategy (Stretch 500 MB to 2,000+ Merchants)

Move old data to compressed JSON in Supabase Storage (separate 1 GB limit, free tier).

```typescript
// lib/archive.ts
import { createClient } from '@supabase/supabase-js';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * Archive purchase orders older than 90 days
 * Move from expensive PostgreSQL to cheap Supabase Storage
 */
export async function archiveOldPOs(shopId: string) {
  const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Fetch old POs with their line items
  const { data: oldPOs } = await supabase
    .from('purchase_orders')
    .select(`
      *,
      po_line_items (*),
      receipts (*, receipt_line_items (*))
    `)
    .eq('shop_id', shopId)
    .lt('created_at', cutoffDate)
    .eq('status', 4); // Only archive 'received' POs

  if (!oldPOs || oldPOs.length === 0) return { archived: 0 };

  // 2. Compress to gzip JSON
  const json = JSON.stringify(oldPOs);
  const compressed = await gzipAsync(Buffer.from(json));

  // 3. Upload to Supabase Storage (1 GB free, separate from DB)
  const archiveName = `archives/${shopId}/pos-${Date.now()}.json.gz`;
  const { error: uploadError } = await supabase.storage
    .from('archives')
    .upload(archiveName, compressed, {
      contentType: 'application/gzip',
      cacheControl: '3600'
    });

  if (uploadError) throw uploadError;

  // 4. Delete from PostgreSQL (frees space immediately)
  const poIds = oldPOs.map(po => po.id);

  await supabase.from('receipt_line_items').delete().in('receipt_id', 
    oldPOs.flatMap(po => po.receipts?.map(r => r.id) || [])
  );
  await supabase.from('receipts').delete().in('po_id', poIds);
  await supabase.from('po_line_items').delete().in('po_id', poIds);
  await supabase.from('purchase_orders').delete().in('id', poIds);

  return { archived: oldPOs.length, bytesFreed: json.length };
}

/**
 * Restore archived POs on demand (rarely needed)
 */
export async function restoreArchivedPOs(shopId: string, archiveName: string) {
  const { data, error } = await supabase.storage
    .from('archives')
    .download(archiveName);

  if (error) throw error;

  const compressed = Buffer.from(await data.arrayBuffer());
  const decompressed = await gunzipAsync(compressed);
  const pos = JSON.parse(decompressed.toString());

  // Re-insert into PostgreSQL (merchant is viewing old data)
  // ... insert logic here

  return pos;
}
```

**Storage math:**

| Data Type | PostgreSQL Size | Compressed JSON Size | Savings |
|-----------|----------------|---------------------|---------|
| 1,000 POs | 2 MB | 150 KB | **13x** |
| 10,000 POs | 20 MB | 1.2 MB | **17x** |
| 100,000 POs | 200 MB | 10 MB | **20x** |

**With archive strategy:** 500 MB PostgreSQL + 1 GB Storage = equivalent of **5–10 GB raw data**.

---

### 2.5 VACUUM Regularly (Reclaim Deleted Row Space)

PostgreSQL doesn't immediately free space when you delete rows. It marks them as "dead tuples." VACUUM reclaims this space.

```sql
-- Run weekly in Supabase SQL Editor or via cron
-- Reclaims 20-30% of space instantly after heavy deletes

VACUUM FULL;

-- Or automated weekly
SELECT cron.schedule(
    'weekly-vacuum',
    '0 4 * * 0',  -- Every Sunday at 4 AM
    'VACUUM FULL;'
);
```

**When to run:**
- After archiving old POs
- After purging webhook logs
- After any bulk delete operation
- Weekly as maintenance

---

### 2.6 Don't Store What Shopify Already Stores

**The golden rule:** If Shopify has it, you don't need it in your database.

| Data | Store in Your DB? | Alternative |
|------|------------------|-------------|
| Product title | ❌ No | Fetch via GraphQL on display |
| Product description | ❌ No | Fetch via GraphQL |
| Product images | ❌ No | Use Shopify CDN URLs |
| Variant options | ❌ No | Fetch via GraphQL |
| Customer data | ❌ No | Not needed for inventory app |
| Order details | ❌ No | Only store `order_id` + `variant_id` + `qty` for forecasting |
| Full order history | ❌ No | Pull 90 days on demand, don't cache |

**What you MUST store:**
- SKU, barcode, cost (for PO creation)
- Inventory levels per location (for alerts)
- PO numbers, vendor IDs, quantities (for your core workflow)
- Sync timestamps (for reconciliation)

**Result:** 80% less data in your database.

---

## 3. VERCEL OPTIMIZATION: KILLING THE 10-SECOND TIMEOUT

### 3.1 The Problem

| Operation | Typical Time | Vercel Hobby Result |
|-----------|-------------|---------------------|
| OAuth callback | 1–2s | ✅ Safe |
| Product sync (500 SKUs) | 2–3s | ✅ Safe |
| Product sync (5,000 SKUs) | 8–12s | ⚠️ Risky |
| Product sync (10,000 SKUs) | 30–60s | ❌ Timeout |
| CSV export (50k rows) | 15–30s | ❌ Timeout |
| Stock take post (1,000 SKUs) | 5–8s | ✅ Safe |
| Stock take post (5,000 SKUs) | 20–40s | ❌ Timeout |

**The 10-second timeout is a hard wall.** When hit, the function is killed mid-operation, leaving your database in an inconsistent state.

### 3.2 The Fix: Chunked Streaming Architecture

Instead of one big request, break into small chunks that each complete in under 3 seconds.

```typescript
// lib/sync-chunked.ts

const CHUNK_SIZE = 500; // SKUs per chunk
const MAX_CHUNK_TIME = 3000; // 3 seconds per chunk (safe margin)

interface SyncProgress {
  shopId: string;
  totalProducts: number;
  syncedProducts: number;
  currentChunk: number;
  totalChunks: number;
  status: 'running' | 'completed' | 'error';
  error?: string;
}

// In-memory progress store (use Redis in production, Map for MVP)
const syncProgress = new Map<string, SyncProgress>();

export async function startChunkedSync(shopId: string, accessToken: string) {
  // Initialize progress
  syncProgress.set(shopId, {
    shopId,
    totalProducts: 0,
    syncedProducts: 0,
    currentChunk: 0,
    totalChunks: 0,
    status: 'running'
  });

  // Start first chunk immediately
  await processNextChunk(shopId, accessToken, null);

  return { jobId: shopId, status: 'started' };
}

async function processNextChunk(
  shopId: string, 
  accessToken: string, 
  cursor: string | null
) {
  const startTime = Date.now();
  const progress = syncProgress.get(shopId)!;

  try {
    // Fetch one chunk from Shopify
    const result = await fetchShopifyProductsChunk({
      shop: shopId,
      accessToken,
      first: CHUNK_SIZE,
      after: cursor
    });

    // Store chunk immediately (don't accumulate in memory)
    await storeProductChunk(shopId, result.products);

    // Update progress
    progress.syncedProducts += result.products.length;
    progress.currentChunk++;
    progress.totalChunks = Math.ceil(result.totalCount / CHUNK_SIZE);

    // Check if more chunks needed
    if (result.pageInfo.hasNextPage && result.pageInfo.endCursor) {
      // Schedule next chunk via background job or client polling
      // Option A: Queue for Inngest/QStash
      // Option B: Client polls and triggers next chunk

      // For MVP: Client polling approach
      progress.status = 'running';
    } else {
      progress.status = 'completed';
    }

    const elapsed = Date.now() - startTime;
    console.log(`Chunk ${progress.currentChunk} completed in ${elapsed}ms`);

  } catch (error) {
    progress.status = 'error';
    progress.error = error instanceof Error ? error.message : 'Unknown error';
    throw error;
  }
}

// Client polling endpoint
export async function getSyncStatus(shopId: string): Promise<SyncProgress> {
  return syncProgress.get(shopId) || {
    shopId,
    totalProducts: 0,
    syncedProducts: 0,
    currentChunk: 0,
    totalChunks: 0,
    status: 'error',
    error: 'Sync not found'
  };
}

// Trigger next chunk (called by client or cron)
export async function continueSync(shopId: string, accessToken: string) {
  const progress = syncProgress.get(shopId);
  if (!progress || progress.status !== 'running') {
    return { status: 'no-op' };
  }

  // Get last cursor from database
  const { data: lastSync } = await supabase
    .from('sync_state')
    .select('last_cursor')
    .eq('shop_id', shopId)
    .single();

  await processNextChunk(shopId, accessToken, lastSync?.last_cursor || null);
  return syncProgress.get(shopId)!;
}
```

**Client-side polling component:**

```tsx
// components/sync/SyncProgress.tsx
'use client';

import { useState, useEffect } from 'react';
import { ProgressBar, Banner, Button } from '@shopify/polaris';

interface SyncProgress {
  totalProducts: number;
  syncedProducts: number;
  currentChunk: number;
  totalChunks: number;
  status: string;
  error?: string;
}

export default function SyncProgress({ shopId }: { shopId: string }) {
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (!isSyncing) return;

    const poll = setInterval(async () => {
      const res = await fetch(`/api/sync/status?shopId=${shopId}`);
      const data = await res.json();
      setProgress(data);

      if (data.status === 'completed' || data.status === 'error') {
        setIsSyncing(false);
        clearInterval(poll);
      }
    }, 1000); // Poll every second

    return () => clearInterval(poll);
  }, [isSyncing, shopId]);

  const startSync = async () => {
    setIsSyncing(true);
    await fetch('/api/sync/start', {
      method: 'POST',
      body: JSON.stringify({ shopId })
    });
  };

  if (!progress && !isSyncing) {
    return <Button onClick={startSync} variant="primary">Sync Inventory</Button>;
  }

  if (progress?.status === 'error') {
    return (
      <Banner tone="critical">
        Sync failed: {progress.error}
        <Button onClick={startSync}>Retry</Button>
      </Banner>
    );
  }

  const percent = progress 
    ? Math.round((progress.syncedProducts / progress.totalProducts) * 100) 
    : 0;

  return (
    <div>
      <ProgressBar progress={percent} size="small" />
      <p>
        {progress?.syncedProducts || 0} of {progress?.totalProducts || 0} products synced
        {progress?.totalChunks > 0 && ` (chunk ${progress.currentChunk} of ${progress.totalChunks})`}
      </p>
      {progress?.status === 'completed' && (
        <Banner tone="success">Sync complete!</Banner>
      )}
    </div>
  );
}
```

**Result:** 50,000 SKUs sync in 100 chunks of 500, each under 3 seconds. No timeout. No memory spike. Merchant sees real-time progress.

---

### 3.3 Edge Functions for Heavy Lifting

Vercel Edge Functions have **30-second timeout** (vs. 10s for Serverless). Move heavy operations there.

```typescript
// app/api/sync/edge/route.ts
export const runtime = 'edge'; // 30s timeout, not 10s
export const maxDuration = 30; // Explicitly set to 30 seconds

export async function POST(req: Request) {
  // Heavy sync operation here
  // 3x more time than regular serverless

  const { shopId, accessToken } = await req.json();

  // Can now sync ~1,500 SKUs in one call instead of 500
  const result = await syncLargeChunk(shopId, accessToken, 1500);

  return Response.json(result);
}
```

**Edge vs Serverless:**

| Feature | Serverless (Node.js) | Edge (V8) |
|---------|---------------------|-----------|
| Timeout | 10s (Hobby) | 30s (all tiers) |
| Cold start | 200-500ms | 0-50ms |
| Memory | 1,024 MB | 128 MB |
| Best for | Heavy compute, DB access | Fast responses, light compute |
| **Use for** | Chunked sync, DB writes | Status checks, auth, redirects |

**Strategy:** Use Edge for the status check endpoint (fast, always available), Serverless for the actual chunk processing (more memory, longer timeout).

---

### 3.4 Streaming CSV Exports (Never Timeout)

```typescript
// app/api/export/csv/route.ts
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const shopId = searchParams.get('shopId');
  const type = searchParams.get('type'); // 'inventory', 'pos', etc.

  // Use streaming response instead of buffering entire CSV
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Send headers immediately
      controller.enqueue(encoder.encode('SKU,Title,Location,Available,Incoming\n'));

      // Stream in chunks of 500 rows
      let cursor = 0;
      const chunkSize = 500;
      let hasMore = true;

      while (hasMore) {
        const { data: rows } = await supabase
          .from('inventory_levels')
          .select('products(sku, title), location_id, available, incoming')
          .eq('shop_id', shopId)
          .range(cursor, cursor + chunkSize - 1);

        if (!rows || rows.length === 0) {
          hasMore = false;
          break;
        }

        // Convert to CSV and enqueue
        const csvChunk = rows.map(row => 
          `${row.products.sku},${row.products.title},${row.location_id},${row.available},${row.incoming}`
        ).join('\n') + '\n';

        controller.enqueue(encoder.encode(csvChunk));

        cursor += chunkSize;
        hasMore = rows.length === chunkSize;
      }

      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="stockme-export-${Date.now()}.csv"`,
      'Cache-Control': 'no-cache'
    }
  });
}
```

**Result:** Export 1 million rows without ever holding more than 500 in memory. No timeout. No memory crash.

---

## 4. BANDWIDTH OPTIMIZATION: STRETCHING 5 GB EGRESS

### 4.1 What's Eating Your Egress

| Source | Typical Usage | Fix |
|--------|-------------|-----|
| API responses (JSON) | 60% of egress | Compress with gzip |
| Webhook deliveries | 20% | Don't echo full payload |
| Real-time subscriptions | 15% | Use polling for low-frequency data |
| Static assets | 5% | Already cached by Vercel |

### 4.2 Gzip Everything

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const response = NextResponse.next();

  // Enable gzip for all API routes
  if (req.nextUrl.pathname.startsWith('/api/')) {
    response.headers.set('Content-Encoding', 'gzip');
    response.headers.set('Vary', 'Accept-Encoding');

    // Also enable Brotli if client supports it (better compression)
    const acceptEncoding = req.headers.get('accept-encoding') || '';
    if (acceptEncoding.includes('br')) {
      response.headers.set('Content-Encoding', 'br');
    }
  }

  return response;
}

export const config = {
  matcher: '/api/:path*'
};
```

**Compression ratios:**

| Content Type | Raw Size | Gzip | Brotli |
|-------------|----------|------|--------|
| JSON API response | 100 KB | 25 KB (75%) | 20 KB (80%) |
| HTML page | 50 KB | 12 KB (76%) | 10 KB (80%) |
| CSV export | 1 MB | 200 KB (80%) | 150 KB (85%) |

**Result:** 5 GB egress now handles **20–25 GB of uncompressed data**.

---

### 4.3 Aggressive Pagination

```typescript
// Default: return 100 items per page (too much)
// Optimized: return 20 items per page

const PAGE_SIZE = 20; // Not 100, not 50

// Users scroll less than you think
// Shopify's own admin uses 20-25 per page
// This is the industry standard for dense data tables

// API route
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const shopId = searchParams.get('shopId');

  const { data, count } = await supabase
    .from('purchase_orders')
    .select('*', { count: 'exact' })
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  return Response.json({
    data,
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      totalItems: count,
      totalPages: Math.ceil((count || 0) / PAGE_SIZE)
    }
  });
}
```

**Result:** 5x less bandwidth per page load. 50 merchants viewing 10 pages/day = 10,000 API calls, ~50 MB/day, ~1.5 GB/month. Well under 5 GB.

---

### 4.4 Cloudflare CDN (Free Unlimited Bandwidth)

Use Cloudflare's free tier as a CDN layer in front of Vercel:

```
Merchant browser → Cloudflare (cached) → Vercel (origin)
```

**Setup:**
1. Sign up at cloudflare.com (free)
2. Add your domain `gentletap.co`
3. Change DNS nameservers to Cloudflare's
4. Add `stockme.gentletap.co` as a CNAME record pointing to `cname.vercel-dns.com`
5. Enable caching rules:
   - Static assets: Cache 1 month
   - API responses: Cache 0 (don't cache dynamic data)
   - HTML pages: Cache 1 hour (stale-while-revalidate)

**Cloudflare free includes:**
- Unlimited bandwidth
- Global CDN (200+ locations)
- DDoS protection
- SSL certificate (auto)
- Page rules (10)

**Result:** Your 5 GB Supabase egress is protected. Static assets serve from Cloudflare's cache, not Vercel's bandwidth.

---

## 5. EMAIL OPTIMIZATION: 3,000 EMAILS FOR 500 MERCHANTS

### 5.1 The Problem

| Alert Type | Emails per Merchant/Month | 50 Merchants | 200 Merchants |
|-----------|--------------------------|--------------|---------------|
| Instant low-stock alerts | 60 (2/day) | 3,000 | 12,000 |
| Daily digest | 30 (1/day) | 1,500 | 6,000 |
| Weekly summary | 4 | 200 | 800 |

**Instant alerts hit the 3,000 limit at 50 merchants.** Daily digests stretch to 200 merchants.

### 5.2 The Fix: Batch Alerts Into Digests

```typescript
// lib/digest.ts
// Runs once daily via Vercel Cron

interface DailyDigest {
  shopId: string;
  email: string;
  lowStockItems: Array<{
    sku: string;
    title: string;
    location: string;
    available: number;
    threshold: number;
  }>;
  outOfStockItems: Array<{
    sku: string;
    title: string;
    location: string;
  }>;
  pendingPOs: number;
  totalInventoryValue: number;
}

export async function sendDailyDigests() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // 1. Find all shops with alerts in the last 24 hours
  const { data: alertShops } = await supabase
    .from('alerts')
    .select('shop_id')
    .eq('sent', false)
    .gte('triggered_at', yesterday)
    .group('shop_id');

  if (!alertShops) return { sent: 0 };

  let sentCount = 0;

  for (const { shop_id } of alertShops) {
    // 2. Build digest for this shop
    const digest = await buildDigest(shop_id);

    if (!digest) continue;

    // 3. Send one email
    await sendEmail({
      to: digest.email,
      subject: `StockMe Daily: ${digest.lowStockItems.length} items need attention`,
      html: renderDigestTemplate(digest)
    });

    // 4. Mark all alerts as sent
    await supabase
      .from('alerts')
      .update({ sent: true })
      .eq('shop_id', shop_id)
      .eq('sent', false)
      .gte('triggered_at', yesterday);

    sentCount++;
  }

  return { sent: sentCount };
}

async function buildDigest(shopId: string): Promise<DailyDigest | null> {
  // Fetch shop email
  const { data: shop } = await supabase
    .from('shops')
    .select('email')
    .eq('id', shopId)
    .single();

  if (!shop?.email) return null;

  // Fetch low stock items
  const { data: lowStock } = await supabase
    .from('alerts')
    .select('products(sku, title), location_id, threshold')
    .eq('shop_id', shopId)
    .eq('alert_type', 1) // low_stock
    .eq('sent', false)
    .order('triggered_at', { ascending: false })
    .limit(20);

  // Fetch out of stock
  const { data: outOfStock } = await supabase
    .from('alerts')
    .select('products(sku, title), location_id')
    .eq('shop_id', shopId)
    .eq('alert_type', 2) // out_of_stock
    .eq('sent', false)
    .limit(10);

  // Fetch pending POs count
  const { count: pendingPOs } = await supabase
    .from('purchase_orders')
    .select('*', { count: 'exact', head: true })
    .eq('shop_id', shopId)
    .eq('status', 2); // pending

  return {
    shopId,
    email: shop.email,
    lowStockItems: lowStock?.map(a => ({
      sku: a.products.sku,
      title: a.products.title,
      location: a.location_id,
      available: 0, // fetched from inventory_levels
      threshold: a.threshold
    })) || [],
    outOfStockItems: outOfStock?.map(a => ({
      sku: a.products.sku,
      title: a.products.title,
      location: a.location_id
    })) || [],
    pendingPOs: pendingPOs || 0,
    totalInventoryValue: 0 // computed from inventory_levels
  };
}

// Vercel Cron config
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/daily-digest",
      "schedule": "0 9 * * *"  // 9 AM UTC daily
    }
  ]
}
```

**Result:** 500 merchants × 1 digest/day × 30 days = 15,000 emails. Still over 3,000.

**Next level:** Weekly digests for low-activity merchants, daily for high-activity.

```typescript
// Smart frequency
const getDigestFrequency = (merchantTier: string): string => {
  if (merchantTier === 'pro') return '0 9 * * *';      // Daily at 9 AM
  if (merchantTier === 'growth') return '0 9 * * 1,4'; // Mon, Thu
  return '0 9 * * 1';                                   // Monday only
};
```

**With smart frequency:** 100 Pro (daily) + 200 Growth (2x/week) + 200 Starter (weekly) = 3,000 + 1,714 + 857 = **5,571 emails.** Still over.

**Final fix:** In-app notifications as primary, email as secondary. Only email for critical alerts (out of stock). Everything else is in-app.

```typescript
// Only email for critical alerts
const shouldEmail = (alertType: number): boolean => {
  return alertType === 2; // out_of_stock only
  // low_stock = in-app notification only
  // overstock = in-app notification only
};
```

**With critical-only email:** 500 merchants × 2 critical alerts/week × 4 weeks = 4,000 emails. Under 3,000 with some headroom.

---

## 6. THE 7-DAY PAUSE PROBLEM

### 6.1 The Problem

Supabase free projects **pause after 7 days of inactivity**. When a merchant tries to use your app after 8 days, they get a 30-second cold start while Supabase wakes up. This feels broken.

### 6.2 The Fix: Keep-Alive Ping

```typescript
// app/api/cron/keep-alive/route.ts
export async function GET() {
  // Ping Supabase to prevent pause
  const { data, error } = await supabase
    .from('shops')
    .select('id', { count: 'exact', head: true });

  if (error) {
    console.error('Keep-alive failed:', error);
    return new Response('FAIL', { status: 500 });
  }

  return new Response('OK', { status: 200 });
}

// Vercel Cron config
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/keep-alive",
      "schedule": "0 0 * * 3"  // Every Wednesday at midnight
    }
  ]
}
```

**Alternative:** Any real user traffic keeps it alive. With 10+ active merchants, this is automatic.

**Better approach:** The daily digest cron (above) also serves as keep-alive. One cron, two jobs.

```typescript
// app/api/cron/daily-digest/route.ts
export async function GET() {
  // 1. Keep-alive ping (prevents pause)
  await supabase.from('shops').select('id', { count: 'exact', head: true });

  // 2. Send daily digests
  const result = await sendDailyDigests();

  return Response.json({ 
    status: 'ok', 
    digestsSent: result.sent,
    keepAlive: 'ok' 
  });
}
```

---

## 7. THE NUCLEAR OPTION: ZERO-COST DATABASE SCALING

If you hit 400 MB and don't want to pay $25 yet, here's the emergency playbook:

| Strategy | Cost | Effort | Result | When to Use |
|----------|------|--------|--------|-------------|
| **Purge webhook logs** | $0 | 5 min | Free 50-70% space | Immediately |
| **Archive old POs to Storage** | $0 | 2 hours | Free 30-40% space | At 300 MB |
| **Use Supabase Storage for PDFs** | $0 (1 GB limit) | 30 min | Move blobs out of DB | At 350 MB |
| **Compress archived data** | $0 | 1 hour | 80% smaller archives | With archive strategy |
| **VACUUM weekly** | $0 | 5 min/week | Reclaim dead tuples | Weekly |
| **Don't store Shopify data** | $0 | Ongoing | 80% less data | From day 1 |
| **Shrink data types** | $0 | 1 hour | 40-50% less per row | Schema redesign |
| **Delete old notifications** | $0 | 10 min | Free 5-10% | Monthly |

**Combined result:** 500 MB behaves like 2–3 GB. You hit 1,000+ merchants before paying.

---

## 8. CAPACITY MATRIX: BEFORE VS AFTER

| Metric | Before Optimization | After Optimization | Improvement |
|--------|---------------------|-------------------|-------------|
| **Merchants on free DB** | 20–50 | **200–500** | **10x** |
| **Max SKUs per sync** | 5,000 (timeout risk) | **Unlimited** (chunked) | **Infinite** |
| **Emails/month capacity** | 3,000 (instant alerts) | **3,000** (digests = 10x merchants) | **10x** |
| **Bandwidth effective** | 5 GB raw | **20–25 GB** (gzip) | **5x** |
| **Project uptime** | Risk of 7-day pause | **100%** (keep-alive) | **Reliable** |
| **Time to first paid upgrade** | Month 1–2 | **Month 4–6** | **3x runway** |
| **Database space per merchant** | 110 MB | **10–20 MB** | **5-10x** |
| **Webhook log retention** | 30 days | **7 days** | **4x less space** |
| **CSV export max rows** | 10,000 (timeout) | **1,000,000+** (streaming) | **100x** |
| **Cold start risk** | High (Supabase pause) | **None** (daily ping) | **Reliable** |

---

## 9. WHEN TO ACTUALLY PAY

| Trigger | Your Revenue | Upgrade Cost | ROI | Priority |
|---------|-------------|--------------|-----|----------|
| DB consistently > 400 MB | $2,900+/mo (100 merchants × $29) | $25/mo Supabase Pro | **116x** | 🔥 High |
| Function timeouts on 10k+ SKU syncs | $5,800+/mo (200 merchants) | $20/mo Vercel Pro | **290x** | 🔥 High |
| 3,000 emails/month exceeded | $8,700+/mo (300 merchants) | $20/mo Resend Pro | **435x** | Medium |
| Need daily backups | Any revenue | $25/mo Supabase Pro | Peace of mind | Medium |
| Need team collaboration | 2+ developers | $20/mo Vercel Pro | Productivity | Low |
| Need 99.99% SLA | Enterprise customers | $500+/mo Enterprise | Contract requirement | Low |

**At 100 merchants ($2,900 MRR), $45/month in infrastructure is 1.5% of revenue.** The free tier gets you to product-market fit. Paid tiers get you to $1M.

---

## 10. QUICK WINS CHECKLIST

### Day 1 (30 minutes)
- [ ] Add `VACUUM` cron job
- [ ] Change webhook_logs to metadata-only (remove payload column)
- [ ] Add 7-day webhook log purge cron

### Day 2 (1 hour)
- [ ] Implement chunked sync architecture
- [ ] Add gzip middleware to all API routes
- [ ] Reduce page size from 100 to 20 items

### Day 3 (2 hours)
- [ ] Implement daily digest emails (replace instant alerts)
- [ ] Add keep-alive cron (or piggyback on digest cron)
- [ ] Set up Cloudflare CDN in front of Vercel

### Day 4 (2 hours)
- [ ] Implement archive strategy for old POs
- [ ] Move PDF generation to client-side (jsPDF)
- [ ] Review schema: shrink VARCHARs, remove TEXT fields

### Day 5 (1 hour)
- [ ] Add streaming CSV export
- [ ] Implement smart email frequency (Pro=daily, Growth=2x/week, Starter=weekly)
- [ ] Monitor database size daily

---

## 11. COMPLETE CODE REFERENCE

### 11.1 Database Schema (Optimized)

See Section 2.1 above.

### 11.2 Chunked Sync

See Section 3.2 above.

### 11.3 Streaming CSV Export

See Section 3.4 above.

### 11.4 Daily Digest Cron

See Section 5.2 above.

### 11.5 Archive Strategy

See Section 2.4 above.

### 11.6 Gzip Middleware

See Section 4.2 above.

### 11.7 Keep-Alive + Digest Combined Cron

```typescript
// app/api/cron/daily-maintenance/route.ts
export async function GET() {
  const results = {
    keepAlive: false,
    digestsSent: 0,
    logsPurged: 0,
    vacuumed: false
  };

  try {
    // 1. Keep-alive ping
    await supabase.from('shops').select('id', { count: 'exact', head: true });
    results.keepAlive = true;

    // 2. Send daily digests
    const digestResult = await sendDailyDigests();
    results.digestsSent = digestResult.sent;

    // 3. Purge old webhook logs (7 days)
    const { data: purgeResult } = await supabase.rpc('purge_old_webhook_logs');
    results.logsPurged = purgeResult || 0;

    // 4. Weekly vacuum (only on Sundays)
    const today = new Date().getDay();
    if (today === 0) { // Sunday
      await supabase.rpc('vacuum_full');
      results.vacuumed = true;
    }

    return Response.json({ status: 'ok', results });
  } catch (error) {
    console.error('Daily maintenance failed:', error);
    return Response.json({ status: 'error', error: String(error) }, { status: 500 });
  }
}
```

### 11.8 Vercel Config

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/daily-maintenance",
      "schedule": "0 9 * * *"
    }
  ],
  "functions": {
    "app/api/sync/edge/route.ts": {
      "maxDuration": 30
    }
  }
}
```

### 11.9 Environment Variables

```env
# Shopify
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SCOPES=read_products,write_products,read_inventory,write_inventory,read_orders,read_locations

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_role_key

# App
HOST=https://stockme.gentletap.co

# Optional: Cloudflare (for analytics)
# CLOUDFLARE_API_TOKEN=your_token
```

---

## APPENDIX A: MONITORING YOUR FREE TIER

### Supabase Dashboard Metrics

Check weekly:
1. **Database size** — Settings → Database → Size
2. **Egress usage** — Settings → Usage → Egress
3. **Connection count** — Real-time peak connections
4. **Storage usage** — Storage → Buckets → Size

### Vercel Dashboard Metrics

Check weekly:
1. **Function execution time** — Analytics → Functions
2. **Bandwidth usage** — Analytics → Bandwidth
3. **Error rate** — Monitoring → Errors
4. **Build time** — Deployments

### Alert Thresholds

| Metric | Yellow Alert | Red Alert |
|--------|--------------|-----------|
| Database size | 350 MB | 450 MB |
| Egress | 3.5 GB | 4.5 GB |
| Function timeout rate | 1% | 5% |
| Email usage | 2,000/month | 2,800/month |

---

## APPENDIX B: THE "OH SHIT" PLAYBOOK

**Database is at 480 MB and growing:**
1. Immediately run `VACUUM FULL`
2. Purge all webhook logs older than 3 days
3. Archive POs older than 30 days (not 90)
4. Temporarily disable non-essential features
5. If still > 490 MB, upgrade to Pro ($25) or face read-only mode

**Function timeouts spiking:**
1. Check which endpoint is slow (Vercel logs)
2. Reduce chunk size from 500 to 250
3. Add edge function for that endpoint
4. If still failing, upgrade to Pro ($20) for 60s timeout

**Out of emails:**
1. Switch all merchants to weekly digest immediately
2. Disable non-critical alerts
3. Use in-app notifications as primary
4. Upgrade to Resend Pro ($20) before next billing cycle

---

**Document version 1.0 — July 12, 2026**
**Next review: When you hit 100 merchants or 350 MB database size**
