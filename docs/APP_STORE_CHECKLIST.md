# Shopify App Store — Pre-Submission Checklist

**App:** Stockme  
**URL:** https://stockme.gentletap.co (also `https://stocky-rho.vercel.app`)  
**Review date:** July 14, 2026

## Ready ✅

| Requirement | Status | Notes |
|-------------|--------|-------|
| OAuth / embedded app | ✅ | App Bridge CDN + cookie-less offline OAuth |
| Session tokens | ✅ | `shopFetch` sends Bearer idToken; `resolveShopContext` verifies JWT |
| Shopify Billing API | ✅ | $15 / $29 / $39, 14-day trial, plan upgrade/downgrade in Settings |
| BillingGuard + PlanGate | ✅ | Redirect to Settings when unpaid; feature gates by plan |
| Webhook HMAC validation | ✅ | `/api/webhooks` |
| APP_UNINSTALLED handler | ✅ | Deletes sessions |
| GDPR webhooks | ✅ | `customers/data_request`, `customers/redact`, `shop/redact` |
| Privacy policy URL | ✅ | `/privacy` |
| Scoped data access | ✅ | Products, inventory, locations, orders (read) only |
| GraphQL Admin API | ✅ | No REST Admin |

## Before submit ⚠️

| Item | Action |
|------|--------|
| **SHOPIFY_BILLING_TEST** | `true` for App Store review; `false` after approval for live charges |
| **Vercel Shopify secrets** | Match new Partner Client ID / Secret |
| **Legacy install flow** | Enabled in Partner app version + matching callback URL |
| **App Store listing** | Icon 1200×1200, 3–5 screenshots, pricing copy |
| **Demo store + screencast** | Reviewer credentials + short walkthrough |
| **Support email** | support@stockme.gentletap.co — respond within 2 business days |
| **Partner AI self-review** | Run in Distribution before submit |

## Production env (Vercel)

```
NEXT_PUBLIC_APP_URL=https://stocky-rho.vercel.app
NEXT_PUBLIC_SHOPIFY_API_KEY=<client id>
SHOPIFY_API_KEY=<client id>
SHOPIFY_API_SECRET=<client secret>
SHOPIFY_BILLING_TEST=true   # during App Store review only
SUPABASE_* / INNGEST_* / RESEND_* / CRON_SECRET
```

## Partner Dashboard config

- **App URL:** `https://stocky-rho.vercel.app/app`
- **Allowed redirection URL:** `https://stocky-rho.vercel.app/api/auth/callback`
- **Embedded:** Yes
- **Use legacy install flow:** Yes (custom OAuth)
- **GDPR webhooks:** Registered on install

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
