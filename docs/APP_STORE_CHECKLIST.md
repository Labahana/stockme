# Shopify App Store — Pre-Submission Checklist

**App:** Stockme  
**URL:** https://stockme.gentletap.co  
**Review date:** July 9, 2026

## Ready ✅

| Requirement | Status | Notes |
|-------------|--------|-------|
| OAuth / embedded app | ✅ | App Bridge + offline tokens in Supabase |
| Shopify Billing API | ✅ | $15 / $29 / $39, 14-day trial, test mode via `SHOPIFY_BILLING_TEST` |
| Webhook HMAC validation | ✅ | `/api/webhooks` |
| APP_UNINSTALLED handler | ✅ | Deletes sessions |
| GDPR webhooks | ✅ | `customers/data_request`, `customers/redact`, `shop/redact` |
| Privacy policy URL | ✅ | `/privacy` |
| Scoped data access | ✅ | Products, inventory, locations, orders (read) only |
| Billing before feature access | ✅ | 402 gate + BillingGuard |
| Stocky CSV importer | ✅ | `/app/import` — POs + suppliers |

## Submit this week ⚠️

| Item | Action |
|------|--------|
| **App Store listing** | Create listing in Partner Dashboard — not submitted yet |
| **App icon** | 1200×1200 PNG required |
| **Screenshots** | 3–5 screenshots: inventory, PO forecast, import, stocktake scan |
| **Listing copy** | Lead with "Stocky alternative" + Aug 31 deadline + $15/mo |
| **Demo store** | Screencast URL + test credentials for reviewers |
| **Support email** | support@stockme.gentletap.co — must respond within 2 business days |

## Production env (Vercel)

```
NEXT_PUBLIC_APP_URL=https://stockme.gentletap.co
SHOPIFY_API_KEY / SHOPIFY_API_SECRET
SUPABASE_* keys
INNGEST_* keys
RESEND_API_KEY + RESEND_FROM_EMAIL
SHOPIFY_BILLING_TEST=true   # during App Store review only
```

## Partner Dashboard config

- **App URL:** `https://stockme.gentletap.co`
- **Allowed redirection URL:** `https://stockme.gentletap.co/api/auth/callback`
- **Embedded:** Yes
- **GDPR webhooks:** Auto-registered on install (verify in Partner Dashboard after test install)

## Known gaps (non-blocking for v1 submit)

- No automated test suite (manual E2E recommended before submit)
- List virtualization not implemented (pagination handles 5k SKUs)
- Stocky CSV column names vary — importer uses flexible header mapping; document templates for merchants

## Pre-submit smoke test

1. Install on dev store → billing approval → catalog sync
2. Import sample PO + supplier CSV from `/api/import/stocky?sample=*`
3. Create PO → send → partial receive → verify Shopify inventory
4. Stocktake scan → complete → verify adjustment
5. Uninstall → confirm sessions deleted
6. Trigger test `shop/redact` from Partner Dashboard → confirm store row deleted

## Reviewer notes (paste in submission)

> Stockme replaces Shopify Stocky (sunsetting Aug 31, 2026) for POS Pro inventory workflows. Billing is via Shopify recurring charges. The app stores product/inventory/PO data only — no customer PII. GDPR webhooks implemented. Test charges enabled via SHOPIFY_BILLING_TEST.
