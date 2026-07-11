# Stockme

**Stocky replacement for Shopify POS Pro merchants** — inventory sync, purchase orders, forecasting, stocktakes, transfers, and barcode scanning. $15 / $29 / $39 per month via Shopify Billing.

Stocky shuts down **August 31, 2026**. Stockme includes a **Stocky CSV importer** for purchase orders and suppliers.

- **Production URL:** https://stockme.gentletap.co
- **Support:** support@stockme.gentletap.co
- **Privacy:** https://stockme.gentletap.co/privacy

## Stack

Next.js 14 · TypeScript · Supabase · Shopify App Bridge · Inngest · Resend · Vercel

## Local development

```bash
cp .env.example .env.local
# Fill Shopify, Supabase, Inngest, Resend keys
npm install
npm run dev
```

Run Supabase migrations in order (`supabase/migrations/001` through `005`).

Migration `005` adds performance indexes + optimized `inventory_list` / `store_vendors` / `store_tags` for 5k+ SKU shops.

## Load test

```bash
npm run load-test -- <shop_uuid> <location_uuid>
```

Target: each inventory query under 1 second.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run load-test` | Inventory list load test |

## App Store submission

See [docs/APP_STORE_CHECKLIST.md](docs/APP_STORE_CHECKLIST.md) for pre-submission compliance status.

## Stocky migration

1. Install Stockme and subscribe (Shopify billing, 14-day trial)
2. Force sync inventory from Shopify
3. Go to **Import from Stocky** — upload PO CSV + supplier spreadsheet
4. Templates: `/api/import/stocky?sample=suppliers` and `?sample=purchase_orders`
