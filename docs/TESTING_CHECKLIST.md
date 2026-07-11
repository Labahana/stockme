# Testing checklist — run tomorrow

## Before testing

1. Apply migrations in order through `005_performance_indexes.sql` in Supabase
2. Fill `.env.local` from `.env.example` (Shopify + Supabase + Inngest + Resend)
3. `npm run build` then `npm run dev`
4. Install app on a Shopify **dev store** and approve billing (set `SHOPIFY_BILLING_TEST=true`)

## Performance (mentor item #1)

```bash
# After catalog sync, copy shop UUID + location UUID from Supabase
npm run load-test -- <shop_id> <location_id>
```

Target: every query **&lt; 1000ms**. Prefer a store with **≥5,000 variants**.

## Smoke flows

| # | Flow | Pass? |
|---|------|-------|
| 1 | Install → Settings → subscribe → dashboard unlocks | |
| 2 | Force catalog sync → inventory loads | |
| 3 | Inventory filters: low stock, vendor, tag, search | |
| 4 | Bulk select → set min/max → generate barcodes | |
| 5 | Forecast: last-X-days (Starter) + all 5 methods (Growth) | |
| 6 | Create PO → send → PDF → partial receive | |
| 7 | Scan-to-receive (Growth+) | |
| 8 | Stocktake → scan count → complete → Shopify qty changes | |
| 9 | Transfer draft → ship → receive (Growth+) | |
| 10 | Import Stocky sample CSVs (suppliers + POs) | |
| 11 | Reports: low stock, COGS, valuation (Pro), CSV export | |
| 12 | Mobile Safari: open PO, send, start scanner | |

## Mobile (mentor item #4)

- iPhone Safari (or Chrome device mode 390×844)
- Confirm nav, tables, modals, barcode scanner start/stop
- Confirm PO send + stocktake count work without horizontal overflow

## Notes

- Landing page is marketing-only; real UX is inside Shopify Admin
- Unpaid shops redirect to Settings — expected
- After load-test, record ms numbers for mentors
