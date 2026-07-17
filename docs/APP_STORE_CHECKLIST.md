# Shopify App Store — Pre-Submission Checklist

**App:** Stockme  
**Production URL:** https://stockme.gentletap.co  
**Avoid:** any `stocky-*.vercel.app` host (Shopify Stocky trademark / brand confusion)  
**Support:** support@stockme.gentletap.co  
**Updated:** July 16, 2026

## Ready ✅ (codebase)

| Requirement | Status | Notes |
|-------------|--------|-------|
| OAuth / embedded app | ✅ | App Bridge CDN + cookie-less offline OAuth |
| Session tokens | ✅ | `shopFetch` sends Bearer idToken; `resolveShopContext` verifies JWT |
| Shopify Billing API | ✅ | $15 / $29 / $39, 14-day trial, plan upgrade/downgrade in Settings |
| BillingGuard + PlanGate | ✅ | Redirect to Settings when unpaid; feature gates by plan |
| Webhook HMAC validation | ✅ | `/api/webhooks` |
| APP_UNINSTALLED handler | ✅ | Deletes sessions |
| GDPR webhooks | ✅ | `customers/data_request`, `customers/redact`, `shop/redact` (HMAC + 200; shop/redact deletes store data) |
| Privacy policy URL | ✅ | `/privacy` |
| Scoped data access | ✅ | Products, inventory, locations, orders (read) only |
| GraphQL Admin API | ✅ | No REST Admin |
| Brand mark / App icon | ✅ | Inventory cube on #0D7377 |

## Blocking before submit ❌

| Item | Action |
|------|--------|
| **Rename off stocky-\*** | See `docs/DOMAIN_CUTOVER.md` — Vercel project → `stockme`, Partner URLs updated |
| **NEXT_PUBLIC_APP_URL** | Production = `https://stockme.gentletap.co` + redeploy |
| **Real screenshots** | Replace gallery mocks with 2–3 populated demo-store captures |
| **OAuth retest** | Full install on new host |
| **Billing E2E** | Subscribe / upgrade / downgrade with `SHOPIFY_BILLING_TEST=true` |
| **GDPR test fire** | Partner Dashboard or CLI → confirm 200s |
| **Support inbox** | Send a real email to support@stockme.gentletap.co |

## Production env (Vercel)

```
NEXT_PUBLIC_APP_URL=https://stockme.gentletap.co
NEXT_PUBLIC_SHOPIFY_API_KEY=<client id>
SHOPIFY_API_KEY=<client id>
SHOPIFY_API_SECRET=<client secret>
SHOPIFY_BILLING_TEST=true   # during App Store review only
SUPABASE_* / INNGEST_* / RESEND_* / CRON_SECRET
```

## Partner Dashboard config

- **App URL:** `https://stockme.gentletap.co/api/auth` (must 302 to OAuth — App Store automated check)
- **Allowed redirection URL:** `https://stockme.gentletap.co/api/auth/callback`
- **Privacy:** `https://stockme.gentletap.co/privacy`
- **Webhooks / GDPR:** `https://stockme.gentletap.co/api/webhooks` — declare in `shopify.app.toml` and run `shopify app deploy`
- **Website:** `https://stockme.gentletap.co/`
- **Embedded:** Yes
- **Use legacy install flow:** Yes (custom OAuth)

## Pre-submit smoke test

1. Install on dev store → OAuth → choose plan → approve Shopify charge (test)
2. Confirm unpaid path redirects to Settings
3. Upgrade/downgrade plan in Settings
4. Import sample PO + supplier CSV
5. Create PO → send → receive → inventory updates
6. Stocktake / transfer gated for Starter as expected
7. Uninstall → sessions deleted; `shop/redact` clears store

## Reviewer notes (paste in submission)

> Stockme replaces Shopify Stocky for POS Pro inventory workflows. Charges use the Shopify Billing API ($15/$29/$39, 14-day trial). Test charges enabled via SHOPIFY_BILLING_TEST. Embedded admin uses App Bridge session tokens. No customer PII stored. GDPR + APP_UNINSTALLED webhooks implemented. Privacy: https://stockme.gentletap.co/privacy

## Listing copy

Paste from `public/app-store/README.md` (tagline, introduction, features, how it works, pricing).

## Do not select

Built for Shopify on the first submission.
