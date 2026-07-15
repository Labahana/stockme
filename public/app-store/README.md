# Stockme — App Store submission pack

**App URL base:** https://stocky-rho.vercel.app  
**Commit:** use latest `master` (billing + session tokens)

## Partner Dashboard — App version

| Field | Value |
|--------|--------|
| App name | Stockme |
| App URL | `https://stocky-rho.vercel.app/app` |
| Redirect URL | `https://stocky-rho.vercel.app/api/auth/callback` |
| Embedded | Yes |
| Use legacy install flow | **Yes** |
| API version | 2026-07 |
| Scopes | `write_inventory,read_inventory,read_locations,read_orders,read_products,write_products` |
| GDPR / webhooks | `https://stocky-rho.vercel.app/api/webhooks` |

## Listing URLs

| Field | Value |
|--------|--------|
| App listing website | https://stocky-rho.vercel.app/ |
| Privacy policy | https://stocky-rho.vercel.app/privacy |
| Support email | support@stockme.gentletap.co |

## Assets in this folder

| File | Use in Partner Dashboard | Spec |
|------|--------------------------|------|
| `stockme-app-icon-1200.png` | **App icon** | 1200×1200 — layered cube mark on teal |
| `stockme-favicon.png` | Optional small logo / favicon source | Same mark as app icon |
| `stockme-feature-graphic.png` | Feature / gallery hero | 16:9 |
| `stockme-screenshot-inventory.png` | Gallery screenshot 1 | 16:9 |
| `stockme-screenshot-purchase-orders.png` | Gallery screenshot 2 | 16:9 |
| `stockme-screenshot-scan-receive.png` | Gallery screenshot 3 | 16:9 |
| `stockme-screenshot-pricing.png` | Gallery screenshot 4 | 16:9 |
| `stockme-homepage.png` | Optional (marketing page) | Live site capture |

> **Important:** Generated UI shots are listing-ready placeholders. Before final submit, replace 2–3 shots with **real embeds** from your demo store (populated data, no empty states, no `*.myshopify.com` visible in chrome if possible).

## Listing copy (paste)

**Tagline**  
Stocky’s replacement for Shopify inventory, POs, and stock takes.

**Introduction**  
Stockme helps POS Pro merchants replace Stocky before August 31, 2026: sync inventory, build purchase orders from forecasts, receive by barcode, run stock takes, and import Stocky CSVs — billed on your Shopify invoice from $15/month.

**Features**
- Inventory sync with min/max and low-stock digests  
- Purchase orders with forecasting and partial receiving  
- Barcode scan-to-receive (Growth+)  
- Stock transfers and stock takes  
- Stocky CSV import  
- Reports: valuation, sell-through, supplier performance  

**How it works**
1. Install Stockme from the App Store and approve access  
2. Choose Starter, Growth, or Pro (14-day trial via Shopify Billing)  
3. Sync your catalog or import Stocky CSVs  
4. Create POs, receive stock, and keep Shopify inventory accurate  

**Pricing**  
Starter $15 · Growth $29 · Pro $39 / month. 14-day free trial. Change plans anytime in Settings. Billed through Shopify.

## Reviewer notes

> Stockme replaces Shopify Stocky for POS Pro inventory workflows. Charges use the Shopify Billing API ($15/$29/$39, 14-day trial). Test charges via SHOPIFY_BILLING_TEST. Embedded admin uses App Bridge session tokens. No customer PII. GDPR + APP_UNINSTALLED at /api/webhooks. Privacy: https://stocky-rho.vercel.app/privacy

## Vercel env (must match Partner app)

```
NEXT_PUBLIC_APP_URL=https://stocky-rho.vercel.app
NEXT_PUBLIC_SHOPIFY_API_KEY=<Client ID>
SHOPIFY_API_KEY=<Client ID>
SHOPIFY_API_SECRET=<Client Secret>
SHOPIFY_BILLING_TEST=true
```

## Do not select

Built for Shopify — submit **standard** App Store listing only this round.
