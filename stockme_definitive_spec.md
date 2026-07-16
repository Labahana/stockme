
# STOCKME — DEFINITIVE BUILD SPECIFICATION
# Merged from: Stocky Bug-Fix Build Spec + Complete UI/UX Design System
# For: Cursor/Claude Code Agent
# Version: 2.0 (Final)
# Last Updated: 2026-07-12

═══════════════════════════════════════════════════════════════════════════════
MISSION
═══════════════════════════════════════════════════════════════════════════════

Stocky (Shopify's inventory management app for POS Pro) shuts down August 31, 2026.
50,000+ merchants need a replacement. Build StockMe — a 1:1 clone of Stocky's
feature set with all documented bugs fixed.

Timeline: 56 days total. 10 days development. 46 days go-to-market.
Price: $15 / $29 / $39 per month.

═══════════════════════════════════════════════════════════════════════════════
THE 12 STOCKY BUGS WE MUST FIX (From App Store Reviews)
═══════════════════════════════════════════════════════════════════════════════

| # | Stocky Bug | Our Fix | Priority |
|---|-----------|---------|----------|
| 1 | Unusable past ~100 products; 30+ second load times | Server-side pagination + indexing + virtualization; sub-1s at 5,000+ SKUs | CRITICAL |
| 2 | No "select all", missing filters | Every list: select-all checkbox, bulk actions, filters by location/supplier/status/tag | CRITICAL |
| 3 | Data feed misaligned; stock takes stopped working at scale | Webhook-driven sync (not polling); visible "Force resync" button + last-synced timestamp | CRITICAL |
| 4 | No barcode generation or scanning | Generate barcodes (Code128) + scan-to-count (stocktake) + scan-to-receive (PO) | CRITICAL |
| 5 | No mobile PO creation | Mobile-responsive from day 1; POs creatable/sendable from phone | HIGH |
| 6 | 2,048 variants per product hidden in reorder view | No artificial ceiling; reorder view scales to 2,000+ variants per product | HIGH |
| 7 | Reports lack totals; must export to Excel to sum | One-click reports with running totals built-in; no Excel needed | HIGH |
| 8 | Bundle costs double-counted (parent + child); cost sync once daily | Correct bundle/kit cost attribution (once, per component); real-time cost sync | HIGH |
| 9 | No partial PO invoice recording (90% of POs received in shipments) | Partial PO receiving with per-shipment invoice recording | CRITICAL |
| 10 | Support black hole; Shopify staff didn't understand product | In-app help widget; founder personally responds fast | MEDIUM |
| 11 | No supplier export | All data types freely exportable to CSV; unlimited; no paywall | HIGH |
| 12 | "Feels abandoned" | Messaging: "Independently built, actively maintained, not going anywhere" | BRAND |

═══════════════════════════════════════════════════════════════════════════════
THE 6 THINGS STOCKY DID — OUR CLONE TARGET
═══════════════════════════════════════════════════════════════════════════════

1. **Demand Forecasting** — 5 methods:
   - Last X days of sales
   - Custom date range
   - Same period last year
   - Fill shelves (bring stock up to target display level)
   - Target stock level (fixed number per SKU)

2. **Purchase Orders** — create PO → assign supplier → auto-suggested reorder qty → receive stock (partial receiving) → status tracking (draft → sent → partially received → received)

3. **Stocktakes** — manual count sessions → reconcile system vs physical → adjustments applied to Shopify inventory

4. **Stock Transfers** — move inventory between locations → track status (in transit / received)

5. **Supplier/Vendor Management** — contact info, lead times, pack sizes/order multiples, linked products

6. **Min/Max Stock Levels** — set minimum (reorder point) and maximum (target stock) per SKU per location; drives alerts and "fill shelves" forecasting

═══════════════════════════════════════════════════════════════════════════════
COMPETITIVE INTELLIGENCE: STOCKIE
═══════════════════════════════════════════════════════════════════════════════

Stockie (by Plutonian, founders Jake & Meche) — 5.0/5 stars, 103 reviews
- Personally responds to every review, fast, by name
- Ships requested features within ~1 week
- POs locked behind $59.99 Pro Plus tier

| Stockie Tier | Price | Includes |
|-------------|-------|----------|
| Basic | $4.99 | 5 alerts, 8k variants, reorder calc |
| Advanced | $9.99 | Custom thresholds, Slack alerts |
| Pro | $29.99 | Forecasting, sales velocity |
| Pro Plus | $59.99 | POs, PO generation, barcode receiving |

**OUR EDGE:** POs + barcode receiving at $29 (half Stockie's price).
**OUR EDGE:** Consolidated cross-location view (Stockie reviewer complaint: "cannot view complete stock data on single page").
**OUR EDGE:** Bundle cost correction + partial invoicing (no competitor claims these).

═══════════════════════════════════════════════════════════════════════════════
PRICING TIERS
═══════════════════════════════════════════════════════════════════════════════

| Tier | Price | Target | Includes |
|------|-------|--------|----------|
| **Starter** | $15/mo | Single-location, <500 SKUs | Inventory sync, min/max alerts, PO creation, 1 location, CSV export, barcode generation, basic reports |
| **Growth** | $29/mo | Multi-location, <2,000 SKUs | Everything in Starter + unlimited locations, stock transfers, barcode-scan receiving, all 5 forecasting methods, supplier performance reports, consolidated cross-location view |
| **Pro** | $39/mo | High SKU count | Everything in Growth + unlimited SKUs/variants, correct bundle-cost handling, multi-shipment partial invoicing, priority support |

All tiers: no data lock-in, unlimited exports, no per-user fees.

═══════════════════════════════════════════════════════════════════════════════
TECH STACK
═══════════════════════════════════════════════════════════════════════════════

| Layer | Tool | Version |
|-------|------|---------|
| Framework | Next.js | 14.2 App Router |
| Language | TypeScript | 5.3 |
| UI | React | 18.3 |
| Shopify UI | Polaris | 12.x |
| Shopify Bridge | App Bridge | 4.0 |
| Shopify API | GraphQL Admin API | 2026-07 |
| Database | Supabase | PostgreSQL 15 |
| Hosting | Vercel | — |
| Barcodes | html5-qrcode | 2.3 |
| PDFs | jspdf + html2canvas | 2.5 / 1.4 |
| Email | Resend | 3.x |
| Billing (beta) | Stripe | 14.x (optional, manual billing OK) |
| Billing (App Store) | Shopify Billing API | — |
| Validation | Zod | 3.22 |
| Background Jobs | Inngest or QStash | — |

**Scopes:** `read_products,write_products,read_inventory,write_inventory,read_locations,read_orders`

**Webhooks:** `products/update, products/delete, inventory_levels/update, orders/create`

═══════════════════════════════════════════════════════════════════════════════
10-DAY DEVELOPMENT PLAN
═══════════════════════════════════════════════════════════════════════════════

**Day 1-2:** Shopify Partner account, dev store, OAuth, app scaffold, webhook subscriptions, DB schema
**Day 3-4:** Inventory sync engine (full + incremental webhooks), inventory list UI with filters/bulk/select-all, min/max thresholds
**Day 5-6:** Supplier CRUD, PO flow (create → line items → costs → send/export → receive with partial-invoice-per-shipment), 5 forecasting methods
**Day 7:** Stocktakes with barcode scanning, stock transfers, barcode generation
**Day 8:** Reports (low stock, valuation, sell-through, supplier performance, COGS with correct bundle-cost), instant, exportable
**Day 9:** Shopify Billing API (3 tiers), onboarding, empty states, mobile-responsive pass
**Day 10:** Load-test with 1,000-10,000 SKU dataset, bug bash, deploy, submit App Store listing

═══════════════════════════════════════════════════════════════════════════════
DEFINITION OF DONE (Day 10 Checklist)
═══════════════════════════════════════════════════════════════════════════════

- [ ] Inventory list loads <1s with 5,000+ SKUs
- [ ] Select-all + bulk actions on inventory, PO, supplier screens
- [ ] Webhook sync reflects Shopify change within seconds; visible last-synced timestamp
- [ ] Barcode generation + scanning (stocktake + PO receiving)
- [ ] All 5 forecasting methods work
- [ ] Partial PO receiving with per-shipment invoice recording
- [ ] Bundle/kit costs correct; no parent+child double-count
- [ ] All reports: one-click, built-in totals, CSV export
- [ ] CSV export unrestricted for every data type
- [ ] Fully responsive on mobile for stock counts, PO sending, inventory checks
- [ ] Reorder view scales to 2,000+ variants per product
- [ ] 3-tier Shopify Billing works end-to-end
- [ ] App works with 10,000+ variants without failure

═══════════════════════════════════════════════════════════════════════════════
POSITIONING & MESSAGING
═══════════════════════════════════════════════════════════════════════════════

Headline: "Stocky is shutting down. We rebuilt it, fixed, fast, and $15/month."
Trust: "Independently built and actively maintained. We're not going anywhere."
Speed: "No more 30-second load times. No more missing filters."
Data: "Export everything, anytime. Your data is never locked in."
Price: "Everything Stocky did, fixed, at a fraction of what everyone else charges."

═══════════════════════════════════════════════════════════════════════════════
END OF MERGED SPEC
═══════════════════════════════════════════════════════════════════════════════
