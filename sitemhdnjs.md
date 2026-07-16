 I'll explain exactly how to build the Stocky CSV importer — the critical migration feature that converts Stocky refugees into StockMe users.

---

## What the Merchant Has

When Stocky shuts down, merchants can export two CSV files:

| File | Contents | Columns |
|------|----------|---------|
| `stocky_suppliers.csv` | Vendor list | Name, Email, Phone, Address, Lead Time, Terms |
| `stocky_purchase_orders.csv` | PO history | PO Number, Vendor, Date, Status, Line Items (Product, Qty, Cost) |

Your job: Parse these → Map to StockMe schema → Import into Supabase.

---

## The Flow

```
Merchant clicks "Import from Stocky"
        │
        ▼
Upload suppliers CSV → Parse → Validate → Preview → Import
        │
        ▼
Upload POs CSV → Parse → Validate → Preview → Import
        │
        ▼
Show summary: "47 suppliers imported. 128 POs imported. 3 errors skipped."
        │
        ▼
Merchant continues using StockMe with their history intact
```

---

## Step 1: CSV Upload UI

```tsx
// app/import/page.tsx
import { Page, Card, DropZone, Button, Banner, DataTable } from '@shopify/polaris';

export default function ImportPage() {
  const [suppliersFile, setSuppliersFile] = useState<File | null>(null);
  const [posFile, setPosFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);

  return (
    <Page title="Import from Stocky" backAction={{ content: 'Dashboard', url: '/app' }}>
      <Layout>
        <Layout.Section>
          <Banner tone="info">
            Stocky shuts down August 31, 2026. Upload your Stocky CSV exports to preserve your suppliers and purchase order history.
          </Banner>
        </Layout.Section>

        <Layout.Section>
          <Card title="Step 1: Upload Suppliers">
            <DropZone
              accept=".csv"
              onDrop={([file]) => setSuppliersFile(file)}
            >
              {suppliersFile ? <p>{suppliersFile.name}</p> : <p>Drop stocky_suppliers.csv here</p>}
            </DropZone>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card title="Step 2: Upload Purchase Orders">
            <DropZone
              accept=".csv"
              onDrop={([file]) => setPosFile(file)}
            >
              {posFile ? <p>{posFile.name}</p> : <p>Drop stocky_purchase_orders.csv here</p>}
            </DropZone>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Button
            variant="primary"
            onClick={handlePreview}
            disabled={!suppliersFile || importing}
          >
            Preview Import
          </Button>
        </Layout.Section>

        {preview && (
          <Layout.Section>
            <Card title="Preview">
              <DataTable
                headings={['Type', 'Total Rows', 'Valid', 'Errors']}
                rows={[
                  ['Suppliers', preview.suppliers.total, preview.suppliers.valid, preview.suppliers.errors],
                  ['Purchase Orders', preview.pos.total, preview.pos.valid, preview.pos.errors],
                ]}
              />
              <Button variant="primary" onClick={handleImport} loading={importing}>
                Confirm Import
              </Button>
            </Card>
          </Layout.Section>
        )}

        {result && (
          <Layout.Section>
            <Banner tone={result.errors > 0 ? 'warning' : 'success'}>
              {result.message}
            </Banner>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
```

---

## Step 2: CSV Parser (Server-Side)

```typescript
// app/api/import/preview/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';

// Stocky suppliers CSV schema
const StockySupplierSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  lead_time_days: z.string().transform((v) => parseInt(v) || 7).optional(),
  payment_terms: z.string().optional().or(z.literal('Net 30')),
});

// Stocky PO CSV schema
const StockyPOSchema = z.object({
  po_number: z.string().min(1),
  vendor_name: z.string().min(1),
  date: z.string(),
  status: z.string(),
  total: z.string().optional(),
  line_items: z.string().optional(), // JSON or delimited string
});

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const suppliersFile = formData.get('suppliers') as File;
  const posFile = formData.get('pos') as File;

  // Parse suppliers CSV
  const suppliersText = await suppliersFile.text();
  const suppliersRaw = parse(suppliersText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const suppliers = {
    total: suppliersRaw.length,
    valid: 0,
    errors: 0,
    rows: [] as any[],
  };

  for (const row of suppliersRaw) {
    const parsed = StockySupplierSchema.safeParse(row);
    if (parsed.success) {
      suppliers.valid++;
      suppliers.rows.push(parsed.data);
    } else {
      suppliers.errors++;
      suppliers.rows.push({ ...row, _error: parsed.error.errors[0].message });
    }
  }

  // Parse POs CSV
  const posText = await posFile.text();
  const posRaw = parse(posText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const pos = {
    total: posRaw.length,
    valid: 0,
    errors: 0,
    rows: [] as any[],
  };

  for (const row of posRaw) {
    const parsed = StockyPOSchema.safeParse(row);
    if (parsed.success) {
      pos.valid++;
      pos.rows.push(parsed.data);
    } else {
      pos.errors++;
      pos.rows.push({ ...row, _error: parsed.error.errors[0].message });
    }
  }

  return NextResponse.json({ suppliers, pos });
}
```

---

## Step 3: Import to Supabase

```typescript
// app/api/import/confirm/route.ts
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  const { shopId, suppliers, pos } = await req.json();
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  const results = {
    suppliersImported: 0,
    posImported: 0,
    lineItemsImported: 0,
    errors: [] as string[],
  };

  // 1. Import suppliers
  for (const supplier of suppliers) {
    const { data, error } = await supabase
      .from('vendors')
      .insert({
        shop_id: shopId,
        name: supplier.name,
        email: supplier.email || null,
        phone: supplier.phone || null,
        bill_to_address: supplier.address || null,
        ship_to_address: supplier.address || null,
        lead_time_days: supplier.lead_time_days || 7,
        payment_terms: supplier.payment_terms || 'Net 30',
      })
      .select('id')
      .single();

    if (error) {
      results.errors.push(`Supplier ${supplier.name}: ${error.message}`);
    } else {
      results.suppliersImported++;
    }
  }

  // 2. Import POs (after suppliers are in)
  // First, get vendor ID mapping
  const { data: vendors } = await supabase
    .from('vendors')
    .select('id, name')
    .eq('shop_id', shopId);

  const vendorMap = new Map(vendors?.map(v => [v.name, v.id]) || []);

  for (const po of pos) {
    const vendorId = vendorMap.get(po.vendor_name);
    if (!vendorId) {
      results.errors.push(`PO ${po.po_number}: Vendor "${po.vendor_name}" not found`);
      continue;
    }

    const { data: poRecord, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        shop_id: shopId,
        vendor_id: vendorId,
        po_number: po.po_number,
        status: mapStockyStatus(po.status), // 'pending' → 'pending', etc.
        total: parseFloat(po.total) || 0,
        notes: `Imported from Stocky on ${new Date().toISOString()}`,
      })
      .select('id')
      .single();

    if (poError) {
      results.errors.push(`PO ${po.po_number}: ${poError.message}`);
      continue;
    }

    results.posImported++;

    // 3. Import line items (if present)
    if (po.line_items) {
      const lineItems = parseLineItems(po.line_items);
      for (const item of lineItems) {
        const { error: itemError } = await supabase
          .from('po_line_items')
          .insert({
            po_id: poRecord.id,
            title: item.title,
            sku: item.sku,
            qty_ordered: item.qty,
            unit_cost: item.cost,
            total_cost: item.qty * item.cost,
          });

        if (!itemError) results.lineItemsImported++;
      }
    }
  }

  return NextResponse.json(results);
}

// Helper: Map Stocky status to StockMe status
function mapStockyStatus(stockyStatus: string): string {
  const map: Record<string, string> = {
    'draft': 'draft',
    'pending': 'pending',
    'ordered': 'pending',
    'partially_received': 'partially_received',
    'received': 'received',
    'closed': 'received',
    'cancelled': 'cancelled',
  };
  return map[stockyStatus.toLowerCase()] || 'pending';
}

// Helper: Parse line items from various formats
function parseLineItems(lineItemsRaw: string): Array<{title: string, sku: string, qty: number, cost: number}> {
  // Try JSON first
  try {
    return JSON.parse(lineItemsRaw);
  } catch {
    // Fallback: semicolon-delimited "Product A,SKU123,10,5.99;Product B,SKU456,5,3.99"
    return lineItemsRaw.split(';').map(item => {
      const [title, sku, qty, cost] = item.split(',');
      return { title: title?.trim() || '', sku: sku?.trim() || '', qty: parseInt(qty) || 0, cost: parseFloat(cost) || 0 };
    });
  }
}
```

---

## Step 4: Edge Cases to Handle

| Edge Case | Your Fix |
|-----------|----------|
| **Duplicate suppliers** | Check `name` uniqueness per shop before insert |
| **Duplicate PO numbers** | Append `-imported` or auto-generate new number |
| **Missing vendor for PO** | Create "Unknown Vendor" placeholder or skip PO |
| **Malformed dates** | Parse with `date-fns` or fallback to `new Date()` |
| **Currency symbols in totals** | Strip `$`, `€`, `£` before `parseFloat` |
| **Huge files (10k+ rows)** | Stream parse with `csv-parse` stream API, process in batches |
| **Encoding issues** | Force UTF-8: `file.text()` handles this |
| **Empty rows** | `skip_empty_lines: true` in parser |

---

## Step 5: The UI Feedback Loop

```tsx
// During import: Show progress
<Banner tone="info">
  Importing... {progress.suppliers} suppliers, {progress.pos} POs processed
</Banner>

// After import: Show detailed results
<Card title="Import Complete">
  <DataTable
    headings={['Type', 'Imported', 'Skipped', 'Details']}
    rows={[
      ['Suppliers', result.suppliersImported, result.suppliersErrors, 'View'],
      ['Purchase Orders', result.posImported, result.posErrors, 'View'],
      ['Line Items', result.lineItemsImported, 0, 'View'],
    ]}
  />
  {result.errors.length > 0 && (
    <Banner tone="warning">
      {result.errors.length} items had errors. 
      <Button onClick={downloadErrorLog}>Download error log</Button>
    </Banner>
  )}
</Card>
```

---

## The CSV Format You Expect from Stocky

Since Stocky doesn't have an official export, merchants will manually export or use third-party tools. Document this clearly:

```markdown
## How to Export from Stocky

### Suppliers CSV
Create a spreadsheet with these columns:
- `name` (required)
- `email`
- `phone`
- `address`
- `lead_time_days`
- `payment_terms`

Save as `stocky_suppliers.csv`

### Purchase Orders CSV
Create a spreadsheet with these columns:
- `po_number` (required)
- `vendor_name` (required, must match supplier name)
- `date` (YYYY-MM-DD)
- `status` (draft, pending, ordered, partially_received, received, closed, cancelled)
- `total`
- `line_items` (optional: JSON array or semicolon-delimited)

Save as `stocky_purchase_orders.csv`
```

---

## Summary for Your Agent

| Step | File | Key Logic |
|------|------|-----------|
| **Upload UI** | `app/import/page.tsx` | Polaris DropZone, two-file upload |
| **Preview API** | `app/api/import/preview/route.ts` | Parse CSV with `csv-parse`, validate with Zod, return counts |
| **Import API** | `app/api/import/confirm/route.ts` | Insert to Supabase, map vendor IDs, handle errors |
| **Status mapping** | Helper function | `draft→draft`, `ordered→pending`, `closed→received` |
| **Error handling** | UI + download | Log skipped rows, let merchant fix and re-import |

**The goal:** A merchant with 5 years of Stocky data uploads two CSVs, clicks "Import," and 30 seconds later their entire history is in StockMe. That's the migration experience that converts refugees into loyal users.

Want me to write the complete `csv-parse` streaming handler for large files (10k+ rows)?
