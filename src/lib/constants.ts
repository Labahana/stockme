export const APP_NAME = "Stockme";

/**
 * When true, billing is bypassed and every store is treated as Pro.
 * Must stay `false` for App Store review and live charging.
 */
export const BILLING_DISABLED_FOR_DEMO = false;

export const SHOPIFY_SCOPES = [
  "read_products",
  "write_products",
  "read_inventory",
  "write_inventory",
  "read_locations",
  "read_orders",
] as const;

export const WEBHOOK_TOPICS = [
  "PRODUCTS_CREATE",
  "PRODUCTS_UPDATE",
  "PRODUCTS_DELETE",
  "INVENTORY_LEVELS_UPDATE",
  "APP_UNINSTALLED",
  "APP_SUBSCRIPTIONS_UPDATE",
] as const;

export const FORECAST_METHODS = [
  "last_x_days",
  "custom_range",
  "same_period_last_year",
  "fill_shelves",
  "target_stock_level",
] as const;

export type ForecastMethod = (typeof FORECAST_METHODS)[number];

export const PLAN_TIERS = {
  starter: {
    name: "Starter",
    price: 15,
    maxSkus: 500,
    locations: 1,
  },
  growth: {
    name: "Growth",
    price: 29,
    maxSkus: 2000,
    locations: null,
  },
  pro: {
    name: "Pro",
    price: 39,
    maxSkus: null,
    locations: null,
  },
} as const;

export type PlanTier = keyof typeof PLAN_TIERS;

export const PO_STATUSES = [
  "draft",
  "sent",
  "partially_received",
  "received",
  "cancelled",
] as const;

export const TRANSFER_STATUSES = [
  "draft",
  "in_transit",
  "received",
  "cancelled",
] as const;

export const STOCKTAKE_STATUSES = [
  "in_progress",
  "completed",
  "cancelled",
] as const;
