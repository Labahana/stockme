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
import { apiUrl } from "@/lib/hooks/use-shop";
import { PLAN_TIERS } from "@/lib/constants";

export default function OnboardingPageClient() {
  const searchParams = useSearchParams();
  const shop = searchParams.get("shop") ?? "";
  const qs = shop ? `?shop=${encodeURIComponent(shop)}` : "";
  const [step, setStep] = useState<"welcome" | "plans">("welcome");
  const [stats, setStats] = useState({ products: 0, locations: 0, synced: false });
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!shop) return;
    fetch(apiUrl("/api/inventory", shop))
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
  }, [shop]);

  const sync = async () => {
    setSyncing(true);
    try {
      await fetch(apiUrl("/api/sync/force", shop), { method: "POST" });
      setStats((s) => ({ ...s, synced: true }));
    } finally {
      setSyncing(false);
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
                      <List.Item>
                        Connected to {shop || "your Shopify store"}
                      </List.Item>
                      <List.Item>
                        {stats.synced ? "Catalog synced" : "Ready to sync products"}
                      </List.Item>
                      <List.Item>
                        {stats.locations || "—"} location
                        {stats.locations === 1 ? "" : "s"} detected
                      </List.Item>
                    </List>
                  </Banner>
                  {!stats.synced && (
                    <Button fullWidth onClick={sync} loading={syncing}>
                      Sync catalog now
                    </Button>
                  )}
                  <Button fullWidth variant="primary" onClick={() => setStep("plans")}>
                    Start 14-Day Free Trial
                  </Button>
                  <Button url={`/app${qs}`} variant="plain">
                    Skip to Dashboard
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
          <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
            {(Object.keys(PLAN_TIERS) as Array<keyof typeof PLAN_TIERS>).map((key) => {
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
                      {key === "pro" && <List.Item>Bundle cost correction & multi-shipment invoices</List.Item>}
                    </List>
                    <Button
                      variant={popular ? "primary" : "secondary"}
                      url={`/app${qs}`}
                      fullWidth
                    >
                      Select
                    </Button>
                  </BlockStack>
                </Card>
              );
            })}
          </InlineGrid>
          <div style={{ marginTop: 16 }}>
            <Banner tone="info">
              Not sure? Start with Growth. You can change anytime. Billing is currently
              disabled for testing — selecting a plan continues to the dashboard.
            </Banner>
          </div>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
