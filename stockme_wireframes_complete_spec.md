# STOCKME — COMPLETE DESIGN SPECIFICATION
# Stocky 1:1 Clone with Bug Fixes
# For Cursor/Claude Code Agent
# Version: 1.0 | July 2026

---

## TABLE OF CONTENTS

1. Design Philosophy & Color System
2. Global Navigation & Layout
3. Page 1: Onboarding Flow
4. Page 2: Dashboard (Home)
5. Page 3: Purchase Orders List
6. Page 4: Purchase Order Detail / Create / Edit
7. Page 5: Receive PO (Partial + Barcode)
8. Page 6: Inventory (Products + Multi-Location)
9. Page 7: Vendors / Suppliers
10. Page 8: Stock Takes / Cycle Counts
11. Page 9: Transfers
12. Page 10: Reports
13. Page 11: Import from Stocky
14. Page 12: Settings
15. Shared Components Library
16. Responsive Behavior
17. File Structure
18. The 10 Critical Rules
19. Stocky Bug Fixes Reference
20. Performance Targets

---

## 1. DESIGN PHILOSOPHY & COLOR SYSTEM

### Core Principle: "Looks Like Shopify Built It"

Every screen must feel native to Shopify Admin. Merchants should not be able to tell where Shopify ends and StockMe begins.

### Color Palette (Stocky Green Accent on Polaris Base)

| Token | Hex | Usage |
|-------|-----|-------|
| `--p-surface` | `#f6f6f7` | Page background (Shopify admin bg) |
| `--p-surface-default` | `#ffffff` | Card backgrounds |
| `--p-text` | `#202223` | Primary text |
| `--p-text-subdued` | `#6d7175` | Secondary text, labels |
| `--p-border` | `#c9cccf` | Borders, dividers |
| `--p-border-subdued` | `#e1e3e5` | Light borders |
| `--stockme-primary` | `#008060` | Stocky green — buttons, active states, badges |
| `--stockme-primary-hover` | `#004c3f` | Primary hover |
| `--stockme-primary-subdued` | `#e3f1df` | Light green backgrounds |
| `--p-critical` | `#d72c0d` | Errors, rejected status |
| `--p-warning` | `#b98900` | Warnings, partially received |
| `--p-success` | `#008060` | Success, received status |
| `--p-highlight` | `#a5e3b9` | Highlight rows |

### Typography

| Element | Polaris Token | Size | Weight |
|---------|--------------|------|--------|
| Page title | `headingXl` | 20px | 600 |
| Card title | `headingMd` | 16px | 600 |
| Section title | `headingSm` | 14px | 600 |
| Body | `bodyMd` | 14px | 400 |
| Body subdued | `bodySm` | 12px | 400 |
| Table header | `headingXs` | 12px | 600 |
| Table cell | `bodyMd` | 14px | 400 |
| Button | `bodyMd` | 14px | 500 |
| Badge text | `bodySm` | 12px | 500 |

### Spacing System (Polaris Tokens)

| Token | Value | Usage |
|-------|-------|-------|
| `--p-space-1` | 4px | Tight padding |
| `--p-space-2` | 8px | Inline spacing |
| `--p-space-3` | 12px | Card padding |
| `--p-space-4` | 16px | Section padding |
| `--p-space-5` | 20px | Page padding |
| `--p-space-6` | 24px | Large gaps |
| `--p-space-8` | 32px | Section separators |

### Shadows & Borders

| Element | Style |
|---------|-------|
| Cards | `box-shadow: 0px 0px 5px var(--p-shadow-from-ambient-light), 0px 1px 2px var(--p-shadow-from-direct-light)` |
| Card border-radius | `var(--p-border-radius-2)` = 8px |
| Button border-radius | `var(--p-border-radius-1)` = 4px |
| Table row hover | `background: var(--p-surface-hovered)` |
| Inline edit field | `border: 2px solid var(--stockme-primary)` on focus |

---

## 2. GLOBAL NAVIGATION & LAYOUT

### App Shell Structure

```
+-----------------------------------------------------------------------------+
|  SHOPIFY ADMIN HEADER (fixed, 56px height)                                  |
|  <- Back to Shopify    Search...    [Notifications]  [Merchant Name v]     |
+-----------------------------------------------------------------------------+
|                                                                             |
|  +---------------------------------------------------------------------+   |
|  |  STOCKME SIDEBAR NAVIGATION (inside iframe, left side)              |   |
|  |                                                                     |   |
|  |  [Package icon] StockMe                                           |   |
|  |                                                                     |   |
|  |  +---------------------------------------------------------------+ |   |
|  |  |  [Home icon] Dashboard                                       | |   |
|  |  |  =========================================================== | |   |
|  |  |  [Clipboard icon] Purchase Orders  <- Active (green border)  | |   |
|  |  |  [Box icon] Inventory                                          | |   |
|  |  |  [Store icon] Vendors                                          | |   |
|  |  |  [Chart icon] Reports                                          | |   |
|  |  |  =========================================================== | |   |
|  |  |  [Arrow icon] Transfers                                        | |   |
|  |  |  [ClipboardList icon] Stock Takes                              | |   |
|  |  |  =========================================================== | |   |
|  |  |  [Cog icon] Settings                                           | |   |
|  |  |  [Download icon] Import from Stocky                            | |   |
|  |  +---------------------------------------------------------------+ |   |
|  |                                                                     |   |
|  |  [Badge: Growth $29/mo]                                           |   |
|  |  [Text: Storage: 1.2 GB / 8 GB]                                   |   |
|  |                                                                     |   |
|  +---------------------------------------------------------------------+   |
|                                                                             |
|  +---------------------------------------------------------------------+   |
|  |  MAIN CONTENT AREA (right side, scrollable)                         |   |
|  |                                                                     |   |
|  |  [Page content goes here]                                           |   |
|  |                                                                     |   |
|  +---------------------------------------------------------------------+   |
|                                                                             |
+-----------------------------------------------------------------------------+
```

### Sidebar Navigation Component

Use Polaris `Navigation` component with sections:
- Section 1: Dashboard
- Section 2: Purchase Orders, Inventory, Vendors, Reports
- Section 3: Transfers, Stock Takes
- Section 4: Settings, Import from Stocky

Active state:
- Left border: 3px solid `#008060`
- Background: `#e3f1df` (light green tint)
- Text: `#008060`
- Icon: `#008060`

Collapsed state (Mobile < 768px):
- Hamburger menu
- Full-width overlay on open

---

## 3. PAGE 1: ONBOARDING FLOW

### Step 1: OAuth Callback -> Welcome Screen

```
+-----------------------------------------------------------------------------+
|                                                                             |
|  +---------------------------------------------------------------------+   |
|  |                                                                     |   |
|  |                    [Package icon, 64px, green]                      |   |
|  |                                                                     |   |
|  |              Welcome to StockMe                                     |   |
|  |                                                                     |   |
|  |      The Stocky replacement built by merchants, for merchants.     |   |
|  |                                                                     |   |
|  |      +---------------------------------------------------------+   |   |
|  |      |  [Check icon] Connected to store-name.myshopify.com   |   |   |
|  |      |  [Check icon] 2,847 products synced                   |   |   |
|  |      |  [Check icon] 3 locations detected                    |   |   |
|  |      +---------------------------------------------------------+   |   |
|  |                                                                     |   |
|  |              [        Start 14-Day Free Trial        ]             |   |
|  |                                                                     |   |
|  |              Already have a subscription? [Sign In]                  |   |
|  |                                                                     |   |
|  +---------------------------------------------------------------------+   |
|                                                                             |
+-----------------------------------------------------------------------------+
```

Components:
- Page (no back action, full width)
- Card (centered, max-width 600px)
- Icon: PackageIcon (64px, `#008060`)
- Text: headingXl (welcome), bodyMd (subtitle)
- Banner: tone="success" (sync status)
- Button: variant="primary" (full width, `#008060`)

### Step 2: Plan Selection

```
+-----------------------------------------------------------------------------+
|                                                                             |
|  +---------------------------------------------------------------------+   |
|  |                                                                     |   |
|  |              Choose Your Plan                                       |   |
|  |                                                                     |   |
|  |  +--------------+  +--------------+  +--------------+            |   |
|  |  |   STARTER    |  |   GROWTH     |  |     PRO      |            |   |
|  |  |              |  |  [MOST       |  |              |            |   |
|  |  |   $15/mo     |  |   POPULAR]   |  |   $39/mo     |            |   |
|  |  |              |  |   $29/mo     |  |              |            |   |
|  |  |  ----------- |  |  ----------- |  |  ----------- |            |   |
|  |  |  [Check] Unlimited|  [Check] Everything|  [Check] Everything|            |   |
|  |  |     SKUs     |  |     in Starter|  |     in Growth|            |   |
|  |  |  [Check] Basic POs|  [Check] Fill Shelves|  [Check] Bundle Cost|         |   |
|  |  |  [Check] Stock|     Auto-PO   |  |     Correction |            |   |
|  |  |     Takes    |  |  [Check] Barcode|  [Check] Multi-Shipment|       |   |
|  |  |  [Check] Low |     Scanning  |  |     Invoices   |            |   |
|  |  |     Stock    |  |  [Check] Multi-Loc|  [Check] QBO/Xero   |            |   |
|  |  |     Alerts   |  |     View      |  |     Export     |            |   |
|  |  |              |  |  [Check] Slack |  [Check] White-Label|           |   |
|  |  |              |  |     Alerts    |  |     PDFs       |            |   |
|  |  |              |  |  [Check] Invoice|  [Check] Multi-User|          |   |
|  |  |              |  |     Attachment |  |     (5 seats)  |            |   |
|  |  |              |  |                |  |  [Check] Priority|           |   |
|  |  |              |  |                |  |     Support     |            |   |
|  |  |  [  Select   ]|  |  [  Select   ] |  |  [  Select   ] |            |   |
|  |  +--------------+  +--------------+  +--------------+            |   |
|  |                                                                     |   |
|  |  [Lightbulb icon] Not sure? Start with Growth. You can change anytime.|   |
|  |                                                                     |   |
|  +---------------------------------------------------------------------+   |
|                                                                             |
+-----------------------------------------------------------------------------+
```

Components:
- Page title: "Choose Your Plan"
- Layout with 3 Layout.Section (one-third each on desktop)
- Card for each plan
- Badge: tone="success" on "MOST POPULAR" Growth card
- Button: variant="primary" on Growth, variant="secondary" on others
- List with CheckIcon for each feature

### Step 3: First Sync Complete -> Dashboard

After plan selection, auto-redirect to Dashboard with a success toast:
"Welcome to StockMe! Your inventory is synced and ready."

---

## 4. PAGE 2: DASHBOARD (HOME)

### Layout (Stocky-Style Dashboard)

```
+-----------------------------------------------------------------------------+
|  <- StockMe                                                    [+ New PO] |
+-----------------------------------------------------------------------------+
|                                                                             |
|  +---------------------------------------------------------------------+   |
|  |  [Chart icon] Dashboard                                          [View all ->]   |
|  |                                                                     |   |
|  |  +-------------+ +-------------+ +-------------+ +-------------+ |   |
|  |  |  [Warning   | |  [Box icon] | |  [Clipboard | |  [Dollar    | |   |
|  |  |   icon]     | |             | |   icon]     | |   icon]     | |   |
|  |  |   LOW       | |  INCOMING   | |   OPEN POs  | |  INVENTORY  | |   |
|  |  |   STOCK     | |   POs       | |             | |   VALUE     | |   |
|  |  |             | |             | |             | |             | |   |
|  |  |    23       | |     5       | |     12      | |  $124,500   | |   |
|  |  |   items     | |  shipments  | |  pending    | |             | |   |
|  |  |             | |             | |             | |             | |   |
|  |  | [View all]  | | [Receive]   | | [Manage]    | | [Reports]   | |   |
|  |  +-------------+ +-------------+ +-------------+ +-------------+ |   |
|  |                                                                     |   |
|  +---------------------------------------------------------------------+   |
|                                                                             |
|  +-----------------------------------------+  +-------------------------+ |
|  |  [Warning icon] Low Stock Items          |  |  [Chart icon] Best Sellers| |
|  |  =======================================  |  |  ====================== | |
|  |                                         |  |                         | |
|  |  Product              Location   Stock   |  |  Product         30d Sales| |
|  |  --------------------------------------  |  |  ----------------------- | |
|  |  Organic T-Shirt - M  Warehouse A   3     |  |  Denim Jacket      $4,200 | |
|  |  [Critical badge]                       |  |  Wool Scarf        $3,100 | |
|  |  Leather Boots - 10   Store B       5   |  |  Canvas Tote       $2,800 | |
|  |  [Warning badge]                        |  |  ...                      | |
|  |  ...                                    |  |                         | |
|  |                                         |  |  [View full report ->]    | |
|  |  [Create PO for all]    [View all ->]    |  |                         | |
|  |                                         |  |                         | |
|  +-----------------------------------------+  +-------------------------+ |
|                                                                             |
|  +-----------------------------------------+  +-------------------------+ |
|  |  [Clipboard icon] Recent Purchase Orders |  |  [ClipboardList] Pending  | |
|  |  ======================================== |  |  Stock Takes             | |
|  |                                         |  |                         | |
|  |  PO #     Vendor          Total   Status|  |  Location    Items   Due | |
|  |  -------------------------------------- |  |  ----------------------- | |
|  |  PO-1024  Acme Supplier   $1,240  [Pend]|  |  Warehouse A   250   Today| |
|  |  PO-1025  Widget Co      $890   [Rec]  |  |  Store B       120   +2d  | |
|  |  PO-1023  Global Goods   $3,400  [Over]|  |  ...                      | |
|  |  ...                                    |  |                         | |
|  |                                         |  |  [Start count ->]         | |
|  |  [View all POs ->]                       |  |                         | |
|  |                                         |  |                         | |
|  +-----------------------------------------+  +-------------------------+ |
|                                                                             |
|  +---------------------------------------------------------------------+   |
|  |  [Download icon] Import from Stocky                                 |   |
|  |                                                                     |   |
|  |  Moving from Stocky? Import your suppliers and PO history in one   |   |
|  |  click.                                                             |   |
|  |                                                                     |   |
|  |  [Upload icon] Upload Stocky CSVs                                    |   |
|  |                                                                     |   |
|  +---------------------------------------------------------------------+   |
|                                                                             |
+-----------------------------------------------------------------------------+
```

### Components Breakdown

#### Stats Cards Row

Use Layout with 4 oneQuarter sections on desktop, 2 on tablet, 1 on mobile.
Each card:
- Card.Section with HorizontalStack (space-between)
- Left: VerticalStack with Text "bodySm subdued" (label), Text "headingXl" (value), Text "bodySm subdued" (sub-label)
- Right: Icon (AlertTriangleIcon for low stock, etc.)
- Bottom: Button plain "View all"

#### Low Stock Items Table

Use IndexTable with:
- resourceName: { singular: 'product', plural: 'products' }
- Headings: Product, Location, Stock, Min, Suggested Qty
- selectable: false
- Each row:
  - Product cell: HorizontalStack with Thumbnail (small) + VerticalStack (title + sku)
  - Stock cell: Text with tone "critical" if stock <= min * 0.5, "warning" otherwise
  - Suggested Qty: InlineEditCell

---

## 5. PAGE 3: PURCHASE ORDERS LIST

### Layout (Stocky-Style PO List)

```
+-----------------------------------------------------------------------------+
|  <- Purchase Orders                    [+ Create Purchase Order]            |
+-----------------------------------------------------------------------------+
|                                                                             |
|  +---------------------------------------------------------------------+   |
|  |  Filters & Search                                                   |   |
|  |                                                                     |   |
|  |  [Search POs, vendors, products...    ]  [Status v] [Vendor v] [Date v]|   |
|  |                                                                     |   |
|  |  [Download icon] Export CSV  [Refresh icon] Refresh  Last synced: 2 min ago|
|  |                                                                     |   |
|  +---------------------------------------------------------------------+   |
|                                                                             |
|  +---------------------------------------------------------------------+   |
|  |                                                                     |   |
|  |  [Checkbox]  PO #      Vendor          Location    Total    Status   Date  |   |
|  |  ------------------------------------------------------------------  |   |
|  |  [ ]   PO-1027   Acme Supplier   Warehouse A  $2,400   [Pending]  Jul 12|   |
|  |  [ ]   PO-1026   Widget Co       Store B      $890    [Received] Jul 10|   |
|  |  [ ]   PO-1025   Global Goods    Warehouse A  $3,400   [Partial] Jul 8 |   |
|  |  [ ]   PO-1024   Acme Supplier   Store B      $1,240   [Overdue] Jul 5 |   |
|  |  [ ]   PO-1023   Local Vendor    Warehouse A  $560    [Received] Jul 3 |   |
|  |  ...                                                                |   |
|  |                                                                     |   |
|  |  ------------------------------------------------------------------  |   |
|  |  TOTAL: 47 POs  |  $89,450  |  12 Pending  |  28 Received  |  7 Overdue|   |
|  |                                                                     |   |
|  |  [< Prev]  Page 1 of 5  [Next >]  [1][2][3][4][5]                  |   |
|  |                                                                     |   |
|  +---------------------------------------------------------------------+   |
|                                                                             |
+-----------------------------------------------------------------------------+
```

### Components Breakdown

#### Filters Bar

Use Card sectioned with HorizontalStack:
- TextField with SearchIcon prefix (placeholder: "Search POs, vendors, products...")
- Select for Status (All Statuses, Draft, Pending, Partially Received, Received, Cancelled)
- Select for Vendor (dynamic options)
- ButtonGroup: Export CSV, Refresh
- Below: Text "bodySm subdued" (Last synced) + Button plain "Force resync"

#### PO Table with Inline Editing

Use IndexTable with:
- resourceName: { singular: 'purchase order', plural: 'purchase orders' }
- itemCount, selectedItemsCount, onSelectionChange
- bulkActions: Export selected, Print selected, Cancel selected (destructive)
- Headings: PO #, Vendor, Location, Total (end), Status, Date, Actions (end)
- Each row:
  - PO #: Link to detail page, Text "bodyMd" fontWeight="semibold"
  - Vendor: plain text
  - Location: plain text
  - Total: Text alignment="end" fontWeight="semibold"
  - Status: StatusBadge component
  - Date: formatDate
  - Actions: HorizontalStack with Button plain (Receive if pending, Edit, Print)

#### Footer Totals

Use Box with background="bg-surface-secondary", borderTopWidth="1", borderColor="border", padding="4"
HorizontalStack align="space-between":
- Left: Text "bodyMd" fontWeight="semibold" (TOTAL: count POs | amount | pending | received | overdue)
- Right: Pagination component

---

## 6. PAGE 4: PURCHASE ORDER DETAIL / CREATE / EDIT

### Layout (Stocky-Style PO Detail)

```
+-----------------------------------------------------------------------------+
|  <- Purchase Order #1027                                               [Edit]|
+-----------------------------------------------------------------------------+
|                                                                             |
|  +---------------------------------------------------------------------+   |
|  |  PO-1027                                    [Pending badge]         |   |
|  |  From: Acme Supplier                                                |   |
|  |  To: Warehouse A                                                    |   |
|  |                                                                     |   |
|  |  [Email icon] Send  [Print icon] Print PDF  [Download icon] Download CSV  [More actions v]|   |
|  |                                                                     |   |
|  |  ---------------------------------------------------------------- |   |
|  |                                                                     |   |
|  |  [Clipboard icon] Line Items                              [+ Add]   |   |
|  |                                                                     |   |
|  |  [Checkbox]  Product              SKU        Cost    Qty    Total    Status |   |
|  |  ------------------------------------------------------------------ |   |
|  |  [ ]   Organic T-Shirt - M  TS-M-001   $12.00   50    $600.00 [Pending]|   |
|  |  [ ]   Denim Jacket - L     DJ-L-002   $45.00   20    $900.00 [Pending]|   |
|  |  [ ]   Wool Scarf - Red     WS-R-003   $8.00    100   $800.00 [Pending]|   |
|  |  [ ]   Canvas Tote - Blue   CT-B-004   $15.00   40    $600.00 [Pending]|   |
|  |  ...                                                                |   |
|  |                                                                     |   |
|  |  ------------------------------------------------------------------ |   |
|  |  Subtotal:                                    $2,900.00            |   |
|  |  Shipping:                              $45.00                      |   |
|  |  Tax (8%):                              $232.00                    |   |
|  |  ---------------------------------------------------------------- |   |
|  |  TOTAL:                                       $3,177.00            |   |
|  |                                                                     |   |
|  +---------------------------------------------------------------------+   |
|                                                                             |
|  +---------------------------------------------------------------------+   |
|  |  [Box icon] Receive Items                                           |   |
|  |                                                                     |   |
|  |  [Camera icon] Scan Barcode  or  [Receive All]  or  [Receive Selected]|   |
|  |                                                                     |   |
|  |  Product              Ordered  Received  Remaining  Qty to Receive  |   |
|  |  ------------------------------------------------------------------ |   |
|  |  Organic T-Shirt - M    50       0         50       [    50    ]    |   |
|  |  Denim Jacket - L       20       0         20       [    20    ]    |   |
|  |  ...                                                                |   |
|  |                                                                     |   |
|  |  [Download icon] Receive & Sync to Shopify                            |   |
|  |                                                                     |   |
|  +---------------------------------------------------------------------+   |
|                                                                             |
|  +---------------------------------------------------------------------+   |
|  |  [Note icon] Notes & History                                        |   |
|  |                                                                     |   |
|  |  Jul 12, 10:30 AM - PO created by John                              |   |
|  |  Jul 12, 10:35 AM - Sent to supplier via email                      |   |
|  |  ...                                                                |   |
|  |                                                                     |   |
|  +---------------------------------------------------------------------+   |
|                                                                             |
+-----------------------------------------------------------------------------+
```

### Components Breakdown

#### PO Header Card

Use Card with Card.Section:
- HorizontalStack align="space-between" blockAlign="start"
- Left: VerticalStack gap="2"
  - HorizontalStack gap="2": Text "headingLg" (PO number) + StatusBadge size="large"
  - HorizontalStack gap="4": Text "bodyMd" (From, To, Date)
- Right: ButtonGroup
  - Button icon={EmailIcon} "Send"
  - Button icon={PrinterIcon} "Print PDF"
  - Button icon={DownloadIcon} "Download CSV"
  - Button disclosure icon={ChevronDownIcon} "More actions"

#### PO Line Items Table (Inline Editable)

Use IndexTable with:
- resourceName: { singular: 'line item', plural: 'line items' }
- Headings: Product, SKU, Cost (end), Qty (end), Total (end), Status, (empty)
- Each row:
  - Product: HorizontalStack with Thumbnail (small) + Text "bodyMd" fontWeight="semibold"
  - SKU: plain text
  - Cost: InlineEditCell type="currency" prefix="$"
  - Qty: InlineEditCell type="number"
  - Total: Text alignment="end" fontWeight="semibold" (qty * cost)
  - Status: StatusBadge
  - Actions: Button plain icon={DeleteIcon} destructive

#### Footer Totals

Use Box with background="bg-surface-secondary", borderTopWidth="1", borderColor="border", padding="4"
VerticalStack align="end" gap="2":
- HorizontalStack align="end" gap="4": Text "bodyMd" "Subtotal:" + Text "bodyMd" fontWeight="semibold" (fixed width 120px)
- HorizontalStack align="end" gap="4": Text "bodyMd" "Shipping:" + InlineEditCell type="currency" (fixed width 120px)
- HorizontalStack align="end" gap="4": Text "bodyMd" "Tax (X%):" + Text "bodyMd" fontWeight="semibold"
- Box borderTopWidth="1" borderColor="border" width="100%" paddingBlockStart="2"
  - HorizontalStack align="end" gap="4": Text "headingMd" "TOTAL:" + Text "headingMd" fontWeight="bold"

---

## 7. PAGE 5: RECEIVE PO (PARTIAL + BARCODE)

### Layout

```
+-----------------------------------------------------------------------------+
|  <- Receive PO #1027                                                       |
+-----------------------------------------------------------------------------+
|                                                                             |
|  +---------------------------------------------------------------------+   |
|  |  Receiving Progress: 4 / 10 items (40%)                            |   |
|  |  [Progress bar: 40% filled]                                        |   |
|  |                                                                     |   |
|  |  Acme Corp | Warehouse A                                            |   |
|  |                                                                     |   |
|  |  +----------------------------------------------------------------+ |   |
|  |  |  [Camera icon] Scan Barcode or type SKU...    [Scan with Camera]| |   |
|  |  +----------------------------------------------------------------+ |   |
|  |                                                                     |   |
|  |  Product           SKU      Ordered  Received  Remaining  Qty    |   |
|  |  ---------------------------------------------------------------- |   |
|  |  Organic T-Shirt   TS-001     50       20         30      [  30  ] |   |
|  |  Denim Jacket      DJ-002     30       30          0      [   0  ] |   |
|  |  [Check icon] Completed                                             |   |
|  |  Wool Scarf        WS-003     25       10         15      [  15  ] |   |
|  |  Canvas Tote       CT-004     40       5          35      [  35  ] |   |
|  |  Leather Bag       LB-005     20       0          20      [  20  ] |   |
|  |  ...                                                                |   |
|  |                                                                     |   |
|  |  [Receive All]  [Receive Selected]  [Save Draft]                   |   |
|  |                                                                     |   |
|  +---------------------------------------------------------------------+   |
|                                                                             |
|  +---------------------------------------------------------------------+   |
|  |  [Clipboard icon] Receipt History                                   |   |
|  |                                                                     |   |
|  |  Receipt #    Date          Items    Notes                          |   |
|  |  ------------------------------------------------------------------ |   |
|  |  RC-001       Jul 10        20       First shipment                |   |
|  |  RC-002       Jul 12        15       Partial - backordered 15      |   |
|  |  ...                                                                |   |
|  |                                                                     |   |
|  +---------------------------------------------------------------------+   |
|                                                                             |
+-----------------------------------------------------------------------------+
```

### Barcode Scanner Modal

When "Scan with Camera" clicked, open Modal:
- title: "Scan Barcodes"
- primaryAction: { content: 'Done', onAction: close }
- Modal.Section with BarcodeScannerModal component
- Below scanner: Text "bodyMd" alignment="center" (Scanned: SKU - Title)
- Text "bodyMd" alignment="center" tone="success" (Quantity updated: X)

---

## 8. PAGE 6: INVENTORY (PRODUCTS + MULTI-LOCATION)

### Layout (Stocky-Style Inventory with Multi-Location Consolidated View)

```
+-----------------------------------------------------------------------------+
|  <- Inventory                                                          [+ New]|
+-----------------------------------------------------------------------------+
|                                                                             |
|  +---------------------------------------------------------------------+   |
|  |  [Search products, SKUs, barcodes...    ]  [Location v] [Low Stock v]|   |
|  |                                                                     |   |
|  |  [Download icon] Export CSV  [Refresh icon] Refresh  [Gear icon] Column Settings|   |
|  |                                                                     |   |
|  +---------------------------------------------------------------------+   |
|                                                                             |
|  +---------------------------------------------------------------------+   |
|  |  [Checkbox]  Product         SKU      | WH-A | StoreB | WH-B | Total | Min | Max | Status |   |
|  |  ------------------------------------------------------------------ |   |
|  |  [ ]   Organic T-Shirt  TS-001    |  45  |   12   |  23  |  80   |  20 | 100 |  [Good]  |   |
|  |  [ ]   Denim Jacket     DJ-002    |   3  |    5   |   2  |  10   |  10 |  50 |  [Warn]  |   |
|  |  [ ]   Wool Scarf       WS-003    |   0  |    0   |   5  |   5   |  10 |  60 |  [Crit]  |   |
|  |  [ ]   Canvas Tote      CT-004    |  78  |   34   |  45  | 157   |  30 | 200 |  [Good]  |   |
|  |  ...                                                                |   |
|  |                                                                     |   |
|  |  ------------------------------------------------------------------ |   |
|  |  TOTAL: 2,847 products  |  $124,500 inventory value                  |   |
|  |                                                                     |   |
|  |  [< Prev]  Page 1 of 6  [Next >]                                    |   |
|  |                                                                     |   |
|  +---------------------------------------------------------------------+   |
|                                                                             |
|  +---------------------------------------------------------------------+   |
|  |  [Bell icon] Low Stock Alerts                                       |   |
|  |                                                                     |   |
|  |  Product              Location   Stock   Min   Suggested   Action    |   |
|  |  ------------------------------------------------------------------ |   |
|  |  Wool Scarf - Red     WH-A       0      10    50         [Create PO]|   |
|  |  Denim Jacket - L     Store B    3      10    30         [Create PO]|   |
|  |  ...                                                                |   |
|  |                                                                     |   |
|  +---------------------------------------------------------------------+   |
|                                                                             |
+-----------------------------------------------------------------------------+
```

### Multi-Location Consolidated View (THE KEY DIFFERENTIATOR)

This is the "all locations on one page" feature Stockie does not have.

Use DataTable with:
- columnContentTypes: text, text, numeric, numeric, numeric, numeric, numeric, numeric, text
- Headings: Product, SKU, then one heading per location (alignment="end"), then Total (end), Min (end), Max (end), Status
- Each row:
  - Product: HorizontalStack with Thumbnail (small) + Text "bodyMd" fontWeight="semibold"
  - SKU: plain text
  - Each location: InlineEditCell type="number" (width: 60px)
  - Total: Text fontWeight="bold"
  - Min: InlineEditCell type="number"
  - Max: InlineEditCell type="number"
  - Status: StatusBadge
- footerContent: ['TOTAL:', f'{products.length} products', ...locations.map(() => ''), formatCurrency(totalValue), '', '', '']
- showTotalsInFooter: true

---

## 9. PAGE 7: VENDORS / SUPPLIERS

### Layout

```
+-----------------------------------------------------------------------------+
|  <- Vendors                                                        [+ New]|
+-----------------------------------------------------------------------------+
|                                                                             |
|  +---------------------------------------------------------------------+   |
|  |  [Search vendors...    ]  [Download icon] Export CSV  [Refresh icon] Refresh|   |
|  |                                                                     |   |
|  |  [Checkbox]  Name           Email           Phone     Lead Time  Total Spend|   |
|  |  ------------------------------------------------------------------ |   |
|  |  [ ]   Acme Supplier  acme@email.com  555-0100   7 days   $45,200   |   |
|  |  [ ]   Widget Co      widgets@co.com  555-0101   14 days  $12,800   |   |
|  |  [ ]   Global Goods   global@gg.com   555-0102   21 days  $89,400   |   |
|  |  ...                                                                |   |
|  |                                                                     |   |
|  |  TOTAL: 47 vendors  |  $147,400 total spend                         |   |
|  |                                                                     |   |
|  +---------------------------------------------------------------------+   |
|                                                                             |
|  +---------------------------------------------------------------------+   |
|  |  [Chart icon] Vendor Performance                                    |   |
|  |                                                                     |   |
|  |  [Bar chart: Spend by vendor, last 90 days]                         |   |
|  |                                                                     |   |
|  +---------------------------------------------------------------------+   |
|                                                                             |
+-----------------------------------------------------------------------------+
```

---

## 10. PAGE 8: STOCK TAKES / CYCLE COUNTS

### Layout

```
+-----------------------------------------------------------------------------+
|  <- Stock Takes                                                  [+ New Count]|
+-----------------------------------------------------------------------------+
|                                                                             |
|  +---------------------------------------------------------------------+   |
|  |  Active Stock Takes                                                   |   |
|  |                                                                     |   |
|  |  Location      Items    Status      Started      Actions            |   |
|  |  ------------------------------------------------------------------ |   |
|  |  Warehouse A   250     [In Progress]  Jul 12   [Continue]      |   |
|  |  Store B       120     [In Progress]  Jul 11   [Continue]      |   |
|  |                                                                     |   |
|  +---------------------------------------------------------------------+   |
|                                                                             |
|  +---------------------------------------------------------------------+   |
|  |  Start New Stock Take                                               |   |
|  |                                                                     |   |
|  |  Location: [Warehouse A    v]                                     |   |
|  |  Include:  [x] All products [ ] Low stock only [ ] Specific SKUs   |   |
|  |                                                                     |   |
|  |  [Camera icon] Scan Barcode  or  [Pencil icon] Manual Count        |   |
|  |                                                                     |   |
|  |  Product           Expected   Counted   Variance   Action          |   |
|  |  ------------------------------------------------------------------ |   |
|  |  Organic T-Shirt      45        [  45  ]     0       [Match]     |   |
|  |  Denim Jacket          3        [   2  ]    -1       [Adjust]   |   |
|  |  Wool Scarf            0        [   5  ]    +5       [Adjust]   |   |
|  |  ...                                                                |   |
|  |                                                                     |   |
|  |  [Save Progress]  [Upload icon] Post Adjustments to Shopify        |   |
|  |                                                                     |   |
|  +---------------------------------------------------------------------+   |
|                                                                             |
+-----------------------------------------------------------------------------+
```

---

## 11. PAGE 9: TRANSFERS

### Layout (Growth Tier Feature)

```
+-----------------------------------------------------------------------------+
|  <- Transfers                                                    [+ New]    |
+-----------------------------------------------------------------------------+
|                                                                             |
|  +---------------------------------------------------------------------+   |
|  |  [Search transfers...    ]  [Status v] [From v] [To v]              |   |
|  |                                                                     |   |
|  |  Transfer #    From          To          Items    Status    Date   |   |
|  |  ------------------------------------------------------------------ |   |
|  |  TR-005        Warehouse A   Store B      50      [Shipped]   Jul 12 |   |
|  |  TR-004        Store B       Warehouse A  25      [Received]  Jul 10 |   |
|  |  ...                                                                |   |
|  |                                                                     |   |
|  +---------------------------------------------------------------------+   |
|                                                                             |
|  +---------------------------------------------------------------------+   |
|  |  Create Transfer                                                    |   |
|  |                                                                     |   |
|  |  From: [Warehouse A    v]    To: [Store B    v]                    |   |
|  |                                                                     |   |
|  |  [+ Add Products]                                                   |   |
|  |                                                                     |   |
|  |  Product           SKU      Qty    [Remove]                         |   |
|  |  ------------------------------------------------------------------ |   |
|  |  Organic T-Shirt   TS-001   20     [Trash icon]                    |   |
|  |  ...                                                                |   |
|  |                                                                     |   |
|  |  [Upload icon] Ship Transfer                                        |   |
|  |                                                                     |   |
|  +---------------------------------------------------------------------+   |
|                                                                             |
+-----------------------------------------------------------------------------+
```

---

## 12. PAGE 10: REPORTS

### Layout

```
+-----------------------------------------------------------------------------+
|  <- Reports                                                                |
+-----------------------------------------------------------------------------+
|                                                                             |
|  +---------------------------------------------------------------------+   |
|  |  Report Type: [Low Stock v]  Date Range: [Last 30 days v]          |   |
|  |                                                                     |   |
|  |  [Download icon] Export CSV  [Print icon] Print  [Email icon] Email Report|   |
|  |                                                                     |   |
|  |  Product           SKU      Location   Stock   Min   Suggested   Reorder|   |
|  |  ------------------------------------------------------------------ |   |
|  |  Wool Scarf        WS-003   WH-A       0      10    50          [Yes]  |   |
|  |  Denim Jacket      DJ-002   Store B    3      10    30          [Yes]  |   |
|  |  ...                                                                |   |
|  |                                                                     |   |
|  |  TOTAL: 23 items need reordering  |  Estimated cost: $1,240        |   |
|  |                                                                     |   |
|  +---------------------------------------------------------------------+   |
|                                                                             |
|  +---------------------------------------------------------------------+   |
|  |  Available Reports                                                  |   |
|  |                                                                     |   |
|  |  [Chart icon] Low Stock        [Chart icon] Best Sellers    [Dollar icon] COGS & Valuation|   |
|  |  [Box icon] Inventory Value  [Refresh icon] Sell-Through   [Store icon] Supplier Performance|   |
|  |                                                                     |   |
|  +---------------------------------------------------------------------+   |
|                                                                             |
+-----------------------------------------------------------------------------+
```

---

## 13. PAGE 11: IMPORT FROM STOCKY

### Layout (Two-Step Preview/Confirm Flow)

```
+-----------------------------------------------------------------------------+
|  <- Import from Stocky                                                     |
+-----------------------------------------------------------------------------+
|                                                                             |
|  +---------------------------------------------------------------------+   |
|  |  [Download icon] Import Your Stocky Data                            |   |
|  |                                                                     |   |
|  |  Stocky shuts down August 31, 2026. Preserve your history by      |   |
|  |  uploading your Stocky CSV exports.                                 |   |
|  |                                                                     |   |
|  |  Step 1: Upload Suppliers CSV                                     |   |
|  |  +----------------------------------------------------------------+ |   |
|  |  |  [Upload icon] Drop stocky_suppliers.csv here or click to    | |   |
|  |  |   browse                                                     | |   |
|  |  |                                                             | |   |
|  |  |  Expected columns: name, email, phone, address, lead_time,  | |   |
|  |  |  payment_terms                                              | |   |
|  |  +----------------------------------------------------------------+ |   |
|  |                                                                     |   |
|  |  Step 2: Upload Purchase Orders CSV                                 |   |
|  |  +----------------------------------------------------------------+ |   |
|  |  |  [Upload icon] Drop stocky_purchase_orders.csv here or      | |   |
|  |  |   click to browse                                             | |   |
|  |  |                                                             | |   |
|  |  |  Expected columns: po_number, vendor_name, date, status,  | |   |
|  |  |  total, line_items                                          | |   |
|  |  +----------------------------------------------------------------+ |   |
|  |                                                                     |   |
|  |  [        Preview Import        ]                                   |   |
|  |                                                                     |   |
|  +---------------------------------------------------------------------+   |
|                                                                             |
|  +---------------------------------------------------------------------+   |
|  |  [Warning icon] Important Notes                                    |   |
|  |                                                                     |   |
|  |  - Historical purchase orders cannot be imported into Shopify      |   |
|  |    Admin. StockMe preserves them for your records.                  |   |
|  |  - Supplier details from Stocky are not included in exports.       |   |
|  |    You will need to re-enter contact info.                            |   |
|  |  - We recommend exporting before August 31, 2026.                  |   |
|  |                                                                     |   |
|  +---------------------------------------------------------------------+   |
|                                                                             |
+-----------------------------------------------------------------------------+
```

### Preview Step

```
+-----------------------------------------------------------------------------+
|  <- Import Preview                                                       |
+-----------------------------------------------------------------------------+
|                                                                             |
|  +---------------------------------------------------------------------+   |
|  |  Import Preview                                                     |   |
|  |                                                                     |   |
|  |  Suppliers:  47 total  |  45 valid  |  2 errors                     |   |
|  |  POs:        128 total |  120 valid |  8 errors                     |   |
|  |  Line Items: 1,240 total| 1,200 valid|  40 errors                   |   |
|  |                                                                     |   |
|  |  [View Errors]  [        Confirm Import        ]                   |   |
|  |                                                                     |   |
|  +---------------------------------------------------------------------+   |
|                                                                             |
|  +---------------------------------------------------------------------+   |
|  |  Sample Data (First 5 rows)                                         |   |
|  |                                                                     |   |
|  |  PO #      Vendor          Total    Status    Line Items           |   |
|  |  ------------------------------------------------------------------ |   |
|  |  PO-001    Acme Supplier   $1,200   Pending   5                    |   |
|  |  PO-002    Widget Co       $890     Received  3                    |   |
|  |  ...                                                                |   |
|  |                                                                     |   |
|  +---------------------------------------------------------------------+   |
|                                                                             |
+-----------------------------------------------------------------------------+
```

---

## 14. PAGE 12: SETTINGS

### Layout

```
+-----------------------------------------------------------------------------+
|  <- Settings                                                               |
+-----------------------------------------------------------------------------+
|                                                                             |
|  +---------------------------------------------------------------------+   |
|  |  [Cog icon] General Settings                                        |   |
|  |                                                                     |   |
|  |  Default Currency:     [USD    v]                                 |   |
|  |  Default Location:       [Warehouse A    v]                         |   |
|  |  Date Format:           [MM/DD/YYYY    v]                         |   |
|  |                                                                     |   |
|  |  [Save Changes]                                                     |   |
|  |                                                                     |   |
|  +---------------------------------------------------------------------+   |
|                                                                             |
|  +---------------------------------------------------------------------+   |
|  |  [Bell icon] Notification Settings                                   |   |
|  |                                                                     |   |
|  |  [x] Email me when stock is low                                     |   |
|  |  [x] Email me when PO is received                                   |   |
|  |  [ ] Email me weekly summary                                        |   |
|  |                                                                     |   |
|  |  Slack Webhook: [https://hooks.slack.com/...    ]  [Test]          |   |
|  |                                                                     |   |
|  |  [Save Changes]                                                     |   |
|  |                                                                     |   |
|  +---------------------------------------------------------------------+   |
|                                                                             |
|  +---------------------------------------------------------------------+   |
|  |  [CreditCard icon] Plan & Billing                                   |   |
|  |                                                                     |   |
|  |  Current Plan: Growth ($29/mo)                                     |   |
|  |  Next billing: August 12, 2026                                      |   |
|  |                                                                     |   |
|  |  [Upgrade to Pro]  [Cancel Subscription]                            |   |
|  |                                                                     |   |
|  +---------------------------------------------------------------------+   |
|                                                                             |
|  +---------------------------------------------------------------------+   |
|  |  [Building icon] Locations                                          |   |
|  |                                                                     |   |
|  |  Name            Address                    Type                     |   |
|  |  ------------------------------------------------------------------ |   |
|  |  Warehouse A     123 Main St, NY            Warehouse              |   |
|  |  Store B         456 Oak Ave, LA            Retail                 |   |
|  |  ...                                                                |   |
|  |                                                                     |   |
|  |  [+ Add Location]                                                   |   |
|  |                                                                     |   |
|  +---------------------------------------------------------------------+   |
|                                                                             |
+-----------------------------------------------------------------------------+
```

---

## 15. SHARED COMPONENTS LIBRARY

### StatusBadge

```tsx
// components/ui/StatusBadge.tsx
import { Badge } from '@shopify/polaris';

interface StatusBadgeProps {
  status: 'draft' | 'pending' | 'partially_received' | 'received' | 'cancelled' | 'in_progress' | 'completed' | 'critical' | 'warning' | 'success';
  size?: 'small' | 'large';
}

const statusMap = {
  draft: { tone: 'default', label: 'Draft' },
  pending: { tone: 'warning', label: 'Pending' },
  partially_received: { tone: 'attention', label: 'Partially Received' },
  received: { tone: 'success', label: 'Received' },
  cancelled: { tone: 'critical', label: 'Cancelled' },
  in_progress: { tone: 'attention', label: 'In Progress' },
  completed: { tone: 'success', label: 'Completed' },
  critical: { tone: 'critical', label: 'Critical' },
  warning: { tone: 'warning', label: 'Warning' },
  success: { tone: 'success', label: 'Good' },
};

export function StatusBadge({ status, size = 'small' }: StatusBadgeProps) {
  const config = statusMap[status];
  return <Badge tone={config.tone} size={size}>{config.label}</Badge>;
}
```

### InlineEditCell

```tsx
// components/ui/InlineEditCell.tsx
import { useState, useCallback } from 'react';
import { TextField } from '@shopify/polaris';

interface InlineEditCellProps {
  value: string | number;
  onChange: (value: string) => void;
  type?: 'text' | 'number' | 'currency';
  prefix?: string;
  suffix?: string;
  style?: React.CSSProperties;
}

export function InlineEditCell({ value, onChange, type = 'text', prefix, suffix, style }: InlineEditCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));

  const handleClick = useCallback(() => {
    setIsEditing(true);
    setEditValue(String(value));
  }, [value]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    if (editValue !== String(value)) {
      onChange(editValue);
    }
  }, [editValue, value, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleBlur();
    else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(String(value));
    }
  }, [handleBlur, value]);

  if (isEditing) {
    return (
      <div style={{ minWidth: '80px', ...style }}>
        <TextField
          value={editValue}
          onChange={setEditValue}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          type={type === 'currency' ? 'number' : type}
          prefix={prefix}
          suffix={suffix}
          autoFocus
          monospaced
        />
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      style={{
        cursor: 'pointer',
        padding: '4px 8px',
        borderRadius: '4px',
        minWidth: '80px',
        textAlign: type === 'number' || type === 'currency' ? 'end' : 'start',
        ...style,
      }}
      className="inline-edit-cell"
    >
      {prefix}{value}{suffix}
    </div>
  );
}
```

### DataTableWithTotals

```tsx
// components/ui/DataTableWithTotals.tsx
import { DataTable, Box } from '@shopify/polaris';

interface DataTableWithTotalsProps {
  headings: any[];
  rows: any[][];
  footerContent: React.ReactNode[];
  showTotalsInFooter?: boolean;
}

export function DataTableWithTotals({ headings, rows, footerContent, showTotalsInFooter = true }: DataTableWithTotalsProps) {
  return (
    <Box>
      <DataTable
        columnContentTypes={headings.map(() => 'text')}
        headings={headings}
        rows={rows}
      />
      {showTotalsInFooter && (
        <Box padding="4" background="bg-surface-secondary" borderTopWidth="1" borderColor="border">
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${headings.length}, 1fr)`, gap: '16px' }}>
            {footerContent.map((content, i) => (
              <div key={i} style={{ textAlign: i > 0 ? 'end' : 'start' }}>
                {content}
              </div>
            ))}
          </div>
        </Box>
      )}
    </Box>
  );
}
```

### BarcodeScannerModal

```tsx
// components/ui/BarcodeScannerModal.tsx
import { useEffect, useRef, useState } from 'react';
import { Modal, Box, Text, Banner } from '@shopify/polaris';
import { Html5Qrcode } from 'html5-qrcode';

interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (decodedText: string) => void;
}

export function BarcodeScannerModal({ open, onClose, onScan }: BarcodeScannerModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (open) {
      const scanner = new Html5Qrcode('barcode-scanner-container');
      scannerRef.current = scanner;
      scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => { onScan(decodedText); setScanning(false); },
        () => {}
      ).then(() => setScanning(true))
       .catch(() => { setError('Camera access denied or not available.'); setScanning(false); });
      return () => { scanner.stop().catch(() => {}); };
    }
  }, [open, onScan]);

  return (
    <Modal open={open} onClose={onClose} title="Scan Barcodes" primaryAction={{ content: 'Done', onAction: onClose }}>
      <Modal.Section>
        {error && <Banner tone="critical" onDismiss={() => setError(null)}>{error}</Banner>}
        <Box id="barcode-scanner-container" style={{ width: '100%', minHeight: '300px' }}>
          {!scanning && !error && <Text variant="bodyMd" alignment="center" tone="subdued">Initializing camera...</Text>}
        </Box>
        <Text variant="bodySm" tone="subdued" alignment="center">
          Point your camera at a barcode. Compatible with Code 128, EAN-13, UPC-A.
        </Text>
      </Modal.Section>
    </Modal>
  );
}
```

### PlanGate

```tsx
// components/ui/PlanGate.tsx
import { Banner, Button } from '@shopify/polaris';
import { useShop } from '@/lib/shop-context';

interface PlanGateProps {
  requiredPlan: 'starter' | 'growth' | 'pro';
  featureName: string;
  children: React.ReactNode;
}

const planLevels = { starter: 1, growth: 2, pro: 3 };

export function PlanGate({ requiredPlan, featureName, children }: PlanGateProps) {
  const { plan } = useShop();
  if (planLevels[plan] >= planLevels[requiredPlan]) return <>{children}</>;
  return (
    <Banner
      tone="info"
      title={`${featureName} requires ${requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)} plan`}
      action={{ content: 'Upgrade now', url: '/app/settings?tab=billing' }}
    >
      Upgrade to unlock {featureName} and more advanced features.
    </Banner>
  );
}
```

---

## 16. RESPONSIVE BEHAVIOR

### Desktop (> 1024px)
- Sidebar: 240px fixed width
- Main content: Flexible, max-width 1200px
- Tables: Full width, all columns visible
- Cards: 3-column grid for stats, 2-column for content

### Tablet (768px - 1024px)
- Sidebar: Collapsible, icon-only mode
- Main content: Full width
- Tables: Horizontal scroll for wide tables
- Cards: 2-column grid

### Mobile (< 768px)
- Sidebar: Hidden, hamburger menu
- Main content: Full width, single column
- Tables: Card-based list view (ResourceList, not table)
- Actions: Stacked buttons, full width
- Barcode scanner: Full screen modal

```tsx
const isMobile = useMediaQuery('(max-width: 768px)');

{isMobile ? (
  <ResourceList
    items={products}
    renderItem={(product) => (
      <ResourceList.Item
        id={product.id}
        media={<Thumbnail source={product.image} alt={product.title} />}
        onClick={() => router.push(`/app/inventory/${product.id}`)}
      >
        <Text variant="bodyMd" fontWeight="semibold">{product.title}</Text>
        <Text variant="bodySm" tone="subdued">{product.sku}</Text>
        <HorizontalStack gap="2">
          <Text variant="bodySm">Stock: {product.totalStock}</Text>
          <StatusBadge status={getStockStatus(product)} />
        </HorizontalStack>
      </ResourceList.Item>
    )}
  />
) : (
  <DataTable /* full table */ />
)}
```

---

## 17. FILE STRUCTURE

```
stockme/
|-- app/
|   |-- api/
|   |   |-- auth/
|   |   |   |-- route.ts              # OAuth start
|   |   |   |-- callback/
|   |   |   |   |-- route.ts          # OAuth callback
|   |   |-- webhooks/
|   |   |   |-- route.ts              # Webhook receiver
|   |   |-- products/
|   |   |   |-- sync/
|   |   |   |   |-- route.ts          # Manual sync trigger
|   |   |-- purchase-orders/
|   |   |   |-- route.ts              # List/create POs
|   |   |   |-- [id]/
|   |   |   |   |-- route.ts          # Get/update/delete PO
|   |   |   |   |-- receive/
|   |   |   |   |   |-- route.ts      # Partial receive
|   |   |   |   |-- print/
|   |   |   |   |   |-- route.ts      # PDF generation
|   |   |-- inventory/
|   |   |   |-- route.ts              # Inventory list/update
|   |   |-- vendors/
|   |   |   |-- route.ts              # Vendor CRUD
|   |   |-- stock-takes/
|   |   |   |-- route.ts              # Stock take CRUD
|   |   |-- transfers/
|   |   |   |-- route.ts              # Transfer CRUD
|   |   |-- reports/
|   |   |   |-- route.ts              # Report generation
|   |   |-- import/
|   |   |   |-- preview/
|   |   |   |   |-- route.ts          # CSV preview
|   |   |   |-- confirm/
|   |   |   |   |-- route.ts          # CSV import
|   |   |-- billing/
|   |   |   |-- route.ts              # Shopify Billing
|   |-- page.tsx                        # Dashboard (Home)
|   |-- layout.tsx                      # Root layout (Polaris + App Bridge)
|   |-- purchase-orders/
|   |   |-- page.tsx                    # PO List
|   |   |-- new/
|   |   |   |-- page.tsx                # Create PO
|   |   |-- [id]/
|   |   |   |-- page.tsx                # PO Detail
|   |-- inventory/
|   |   |-- page.tsx                    # Inventory List
|   |-- vendors/
|   |   |-- page.tsx                    # Vendors List
|   |-- stock-takes/
|   |   |-- page.tsx                    # Stock Takes
|   |-- transfers/
|   |   |-- page.tsx                    # Transfers
|   |-- reports/
|   |   |-- page.tsx                    # Reports
|   |-- import/
|   |   |-- page.tsx                    # Import from Stocky
|   |-- settings/
|   |   |-- page.tsx                    # Settings
|-- components/
|   |-- layout/
|   |   |-- SidebarNav.tsx              # App navigation
|   |   |-- AppShell.tsx                # App shell wrapper
|   |   |-- AppFooter.tsx               # Footer with plan badge
|   |-- ui/
|   |   |-- StatusBadge.tsx             # Status badge component
|   |   |-- InlineEditCell.tsx          # Click-to-edit cell
|   |   |-- DataTableWithTotals.tsx     # Table with footer sums
|   |   |-- BarcodeScannerModal.tsx     # Barcode scanner
|   |   |-- PlanGate.tsx                # Feature gating
|   |-- inventory/
|   |   |-- ProductTable.tsx            # Inventory table
|   |   |-- LowStockAlert.tsx           # Low stock banner
|   |-- purchase-orders/
|   |   |-- POList.tsx                  # PO list table
|   |   |-- PODetail.tsx                # PO detail view
|   |   |-- POCreateForm.tsx            # PO creation form
|   |   |-- POReceiveForm.tsx           # PO receiving form
|   |-- reports/
|   |   |-- ReportTable.tsx             # Report data table
|-- lib/
|   |-- shopify.ts                      # Shopify GraphQL client
|   |-- supabase.ts                     # Supabase client
|   |-- csv-chunk-reader.ts             # 200k+ CSV streaming
|   |-- cost-engine.ts                  # Bundle cost correction
|   |-- export-csv.ts                   # CSV export utility
|   |-- shop-context.tsx                # Shop context provider
|-- types/
|   |-- index.ts                        # TypeScript interfaces
|-- styles/
|   |-- globals.css                     # Global styles + tokens
|-- public/
|   |-- stockme-logo.svg                # App logo
|-- .env.local                          # Environment variables
|-- shopify.app.toml                    # Shopify app config
|-- next.config.js                      # Next.js config
|-- tailwind.config.js                  # Tailwind config
|-- tsconfig.json                       # TypeScript config
|-- package.json                        # Dependencies
```

---

## 18. THE 10 CRITICAL RULES

1. **Polaris ONLY** - No custom CSS. Every component must be from `@shopify/polaris`.
2. **Inline editing everywhere** - Click cell -> edit -> save. Zero "Edit" buttons.
3. **Status badges: text + icon + color** - Never color alone. Colorblind-friendly.
4. **Footer totals on every numeric table** - No Excel export needed for quick sums.
5. **Mobile responsive** - Works on iPhone Safari inside Shopify Mobile app.
6. **No AI/ML** - Simple math only. Merchants explicitly rejected AI forecasting.
7. **Error handling** - Every API call wrapped. Never show raw errors to users.
8. **Performance** - p95 <500ms. Paginate at 500 SKUs. Virtualize at 5,000+.
9. **Security** - RLS on all tables. HMAC verify on every webhook.
10. **Feature gating** - Show upgrade banner, not silent failure or crash.

---

## 19. STOCKY BUG FIXES REFERENCE

| # | Stocky Bug | StockMe Fix | Component |
|---|-----------|-------------|-----------|
| 1 | 30+ second load times | Server-side pagination + virtualization | ProductTable.tsx |
| 2 | No select-all, no filters | IndexTable with onSelectionChange + Filters | Every list page |
| 3 | Data feed misaligned | Webhook-driven + Force Resync button | webhooks/route.ts |
| 4 | No barcodes | html5-qrcode + Code128 generation | BarcodeScannerModal.tsx |
| 5 | No mobile POs | Responsive Page + Layout | All PO pages |
| 6 | 2,048 variant ceiling | Virtualized list, no hard cap | ProductTable.tsx |
| 7 | Reports lack totals | DataTable with totals prop | DataTableWithTotals.tsx |
| 8 | Bundle costs double-counted | Cost attributed to components only | cost-engine.ts |
| 9 | No partial PO invoices | receipts table with per-shipment invoices | receive/route.ts |
| 10 | Support black hole | In-app help widget | AppFooter.tsx |
| 11 | No supplier export | Export CSV button on every list | export-csv.ts |
| 12 | Feels abandoned | Brand messaging + founder support | App Store listing |

---

## 20. PERFORMANCE TARGETS

| Metric | Target | Test |
|--------|--------|------|
| First paint | < 1.5s | Lighthouse |
| API response p95 | < 500ms | Vercel analytics |
| 10k SKU sync | < 10s | Manual test |
| 50k SKU sync | < 30s | Manual test |
| CSV import 200k rows | < 60s | Chunked upload test |
| Barcode scan -> product | < 2s | Manual test |
| PO PDF generation | < 3s | Manual test |
| Mobile scroll | 60fps | DevTools |

---

END OF SPECIFICATION
