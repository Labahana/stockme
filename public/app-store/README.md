# Stockme — App Store submission pack

**App URL base:** https://stockme.gentletap.co  
**Do not use:** `stocky-rho.vercel.app` (contains Shopify product name “Stocky” — brand-confusion risk)

## Domain cutover (do this first)

1. **Vercel** → Project **stocky** → Settings → General → rename project to **`stockme`**  
   - Production host becomes `https://stockme.gentletap.co` (if taken, use the alias Vercel shows, e.g. `stockme-xxx.vercel.app`, and use that everywhere below).
2. **Vercel → Settings → Environment Variables**  
   - Set `NEXT_PUBLIC_APP_URL=https://stockme.gentletap.co` (Production)  
   - Redeploy production after saving.
3. **Partner Dashboard → App setup / URLs** — paste the table below (all four + Website).
4. Re-test: install OAuth → open embedded app → billing subscribe (test charge).

## Partner Dashboard — App version

| Field | Value |
|--------|--------|
| App name | Stockme |
| App URL | `https://stockme.gentletap.co/app` |
| Redirect URL | `https://stockme.gentletap.co/api/auth/callback` |
| Embedded | Yes |
| Use legacy install flow | **Yes** |
| API version | 2026-07 |
| Scopes | `write_inventory,read_inventory,read_locations,read_orders,read_products,write_products` |
| GDPR / webhooks | `https://stockme.gentletap.co/api/webhooks` |

## Listing URLs

| Field | Value |
|--------|--------|
| App listing website | https://stockme.gentletap.co/ |
| Privacy policy | https://stockme.gentletap.co/privacy |
| Support email | support@stockme.gentletap.co |

## Assets in this folder

| File | Use in Partner Dashboard | Spec |
|------|--------------------------|------|
| `stockme-app-icon-1200.png` | **App icon** | 1200×1200 — inventory cube on #0D7377 |
| `stockme-app-icon.svg` | Vector app-icon variant | Cube mark on brand field |
| `stockme-favicon.png` | Favicon / small logo | Same as app icon |
| `../brand/stockme-mark.svg` | Site mark (icon only) | Colored cube, transparent |
| `../brand/stockme-logo.svg` | Site logo (icon + Stockme) | Transparent SVG |
| `stockme-feature-graphic.png` | Feature / gallery hero | 16:9 |
| `stockme-screenshot-inventory.png` | Gallery screenshot 1 | 16:9 — **replace with real demo** |
| `stockme-screenshot-purchase-orders.png` | Gallery screenshot 2 | 16:9 — **replace with real demo** |
| `stockme-screenshot-scan-receive.png` | Gallery screenshot 3 | 16:9 — **replace with real demo** |
| `stockme-screenshot-pricing.png` | Gallery screenshot 4 | 16:9 — optional / pricing UI |
| `stockme-homepage.png` | Optional (marketing page) | Live site capture |

> **BLOCKING:** Current gallery PNGs are marketing mocks. Do **not** submit until Gallery #1–3 are real screenshots from a populated demo store (inventory list, PO detail/receive, stocktake or report). Empty states and Lorem Ipsum will fail review.

## Listing copy (paste)

**Tagline** (≤100 chars)  
Stocky’s replacement for Shopify inventory, POs, and stock takes.

**App name**  
Stockme

**Introduction**  
Stockme is built for Shopify POS Pro merchants who need a Stocky replacement before August 31, 2026. Sync inventory across locations, create purchase orders from forecasts, receive with barcodes, run stock takes and transfers, and import Stocky CSVs — billed on your Shopify invoice from $15/month with a 14-day trial.

**Feature list**
- Inventory sync with min/max levels and low-stock alerts  
- Purchase orders with forecasting and partial receiving  
- Barcode scan-to-receive (Growth and Pro)  
- Stock transfers between locations  
- Stock takes / cycle counts  
- Import Stocky purchase order and supplier CSVs  
- Reports: inventory valuation, sell-through, supplier performance  

**How it works**
1. Install Stockme and approve the requested permissions  
2. Choose Starter ($15), Growth ($29), or Pro ($39) — 14-day trial via Shopify Billing  
3. Sync your catalog, or import Stocky CSVs to keep PO history  
4. Create POs, receive stock, run stock takes, and keep Shopify inventory accurate  

**Pricing details**  
Starter $15 / Growth $29 / Pro $39 per month. 14-day free trial. Change or cancel plans anytime in Settings. All charges go through Shopify Billing (appears on your Shopify invoice). No separate card required for Stockme.

**Category suggestions**  
Inventory · Orders and shipping · Finding products

## Reviewer notes (submission form)

> Stockme replaces Shopify Stocky for POS Pro inventory workflows. Charges use the Shopify Billing API ($15/$29/$39, 14-day trial). For review, `SHOPIFY_BILLING_TEST=true` so charges are test. Embedded admin uses App Bridge session tokens. We do not store customer PII. GDPR topics `customers/data_request`, `customers/redact`, `shop/redact` and `APP_UNINSTALLED` are handled at `/api/webhooks`. Privacy: https://stockme.gentletap.co/privacy · Support: support@stockme.gentletap.co

## Vercel env (must match Partner app)

```
NEXT_PUBLIC_APP_URL=https://stockme.gentletap.co
NEXT_PUBLIC_SHOPIFY_API_KEY=<Client ID>
SHOPIFY_API_KEY=<Client ID>
SHOPIFY_API_SECRET=<Client Secret>
SHOPIFY_BILLING_TEST=true
```

## Pre-submit checklist (blocking)

- [ ] Project renamed; live site opens on `stockme.gentletap.co` (not `stocky-*`)
- [ ] Partner App URL / Redirect / Webhooks / Privacy / Website all use `stockme.gentletap.co`
- [ ] OAuth install works end-to-end on the new host
- [ ] Billing: subscribe → upgrade → downgrade on a dev store (test charges)
- [ ] GDPR webhooks return 200 (Partner test tools or CLI)
- [ ] Support email receives a real test message
- [ ] Gallery has 2–3 **real** populated-store screenshots
- [ ] Submit **standard** listing only — not Built for Shopify

## Do not select

Built for Shopify — submit **standard** App Store listing only this round.
