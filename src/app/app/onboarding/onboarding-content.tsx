"use client";

import {
  Banner,
  BlockStack,
  Button,
  Card,
  InlineGrid,
  Layout,
  List,
  Page,
  Text,
} from "@shopify/polaris";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { shopFetch, useHost } from "@/lib/hooks/use-shop";
import { PLAN_TIERS, type PlanTier } from "@/lib/constants";

export default function OnboardingPageClient() {
  const searchParams = useSearchParams();
  const shop = searchParams.get("shop") ?? "";
  const host = useHost() || searchParams.get("host");
  const qs = (() => {
    const params = new URLSearchParams();
    if (shop) params.set("shop", shop);
    if (host) params.set("host", host);
    const s = params.toString();
    return s ? `?${s}` : "";
  })();
  const [step, setStep] = useState<"welcome" | "plans">("welcome");
  const [stats, setStats] = useState({ products: 0, locations: 0, synced: false });
  const [syncing, setSyncing] = useState(false);
  const [subscribing, setSubscribing] = useState<PlanTier | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shop) return;
    shopFetch("/api/inventory", shop, host)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setStats({
          products: 0,
          locations: data.locations?.length ?? 0,
          synced: Boolean(data.store?.lastSyncedAt),
        });
      })
      .catch(() => undefined);
  }, [shop, host]);

  const sync = async () => {
    setSyncing(true);
    setError(null);
    try {
      let res = await shopFetch("/api/sync/force", shop, host, { method: "POST" });
      let data = await res.json().catch(() => ({} as { error?: string; hasMore?: boolean }));
      if (!res.ok) {
        setError(data.error ?? `Sync failed (${res.status})`);
        return;
      }
      let guard = 0;
      while (data.hasMore && guard < 500) {
        res = await shopFetch("/api/sync/force?continue=1", shop, host, {
          method: "POST",
        });
        data = await res.json().catch(() => ({} as { error?: string; hasMore?: boolean }));
        if (!res.ok) {
          setError(data.error ?? `Sync failed (${res.status})`);
          return;
        }
        guard += 1;
      }
      setStats((s) => ({ ...s, synced: true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const selectPlan = async (plan: PlanTier) => {
    setSubscribing(plan);
    setError(null);
    try {
      const res = await shopFetch("/api/billing", shop, host, {
        method: "POST",
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not start Shopify billing");
        return;
      }
      if (data.billingBypassed) {
        window.location.assign(`/app${qs}`);
        return;
      }
      if (data.confirmationUrl) {
        window.open(data.confirmationUrl, "_top");
        return;
      }
      window.location.assign(`/app/settings${qs}${qs ? "&" : "?"}billing=confirmed`);
    } finally {
      setSubscribing(null);
    }
  };

  if (step === "welcome") {
    return (
      <Page>
        <Layout>
          <Layout.Section>
            <div style={{ maxWidth: 600, margin: "40px auto" }}>
              <Card>
                <BlockStack gap="400" inlineAlign="center">
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 16,
                      background: "#008060",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 28,
                      fontWeight: 700,
                    }}
                  >
                    S
                  </div>
                  <Text as="h1" variant="headingXl" alignment="center">
                    Welcome to StockMe
                  </Text>
                  <Text as="p" alignment="center" tone="subdued">
                    The Stocky replacement built by merchants, for merchants.
                  </Text>
                  <Banner tone="success">
                    <List type="bullet">
                      <List.Item>Connected to {shop || "your Shopify store"}</List.Item>
                      <List.Item>
                        {stats.synced ? "Catalog synced" : "Ready to sync products"}
                      </List.Item>
                      <List.Item>
                        {stats.locations || "—"} location
                        {stats.locations === 1 ? "" : "s"} detected
                      </List.Item>
                    </List>
                  </Banner>
                  {error && (
                    <Banner tone="critical" onDismiss={() => setError(null)}>
                      {error}
                    </Banner>
                  )}
                  {!stats.synced && (
                    <Button fullWidth onClick={sync} loading={syncing}>
                      Sync catalog now
                    </Button>
                  )}
                  <Button fullWidth variant="primary" onClick={() => setStep("plans")}>
                    Start 14-Day Free Trial
                  </Button>
                  <Button url={`/app/settings${qs}${qs ? "&" : "?"}billing=required`} variant="plain">
                    Choose a plan in Settings
                  </Button>
                </BlockStack>
              </Card>
            </div>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page title="Choose Your Plan">
      <Layout>
        <Layout.Section>
          {error && (
            <div style={{ marginBottom: 16 }}>
              <Banner tone="critical" onDismiss={() => setError(null)}>
                {error}
              </Banner>
            </div>
          )}
          <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
            {(Object.keys(PLAN_TIERS) as PlanTier[]).map((key) => {
              const tier = PLAN_TIERS[key];
              const popular = key === "growth";
              return (
                <Card key={key}>
                  <BlockStack gap="300">
                    <Text as="h2" variant="headingMd">
                      {tier.name.toUpperCase()}
                      {popular ? " · MOST POPULAR" : ""}
                    </Text>
                    <Text as="p" variant="headingXl">
                      ${tier.price}/mo
                    </Text>
                    <List type="bullet">
                      <List.Item>
                        {tier.maxSkus == null ? "Unlimited SKUs" : `Up to ${tier.maxSkus} SKUs`}
                      </List.Item>
                      <List.Item>
                        {tier.locations == null
                          ? "Unlimited locations"
                          : `${tier.locations} location`}
                      </List.Item>
                      <List.Item>Purchase orders & stock takes</List.Item>
                      {key !== "starter" && <List.Item>Barcode receiving & transfers</List.Item>}
                      {key === "pro" && (
                        <List.Item>Bundle cost correction & multi-shipment invoices</List.Item>
                      )}
                    </List>
                    <Button
                      variant={popular ? "primary" : "secondary"}
                      fullWidth
                      loading={subscribing === key}
                      disabled={Boolean(subscribing)}
                      onClick={() => selectPlan(key)}
                    >
                      Subscribe with Shopify
                    </Button>
                  </BlockStack>
                </Card>
              );
            })}
          </InlineGrid>
          <div style={{ marginTop: 16 }}>
            <Banner tone="info">
              Not sure? Start with Growth. All plans include a 14-day trial. You can upgrade or
              downgrade anytime in Settings — billing is handled by Shopify.
            </Banner>
          </div>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
