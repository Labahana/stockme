import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "stockme" });

export type WebhookSyncEvent = {
  name: "shopify/webhook.received";
  data: {
    shop: string;
    topic: string;
    payload: Record<string, unknown>;
    webhookId?: string;
  };
};

export type FullSyncEvent = {
  name: "shopify/sync.full";
  data: {
    shop: string;
    force?: boolean;
  };
};
