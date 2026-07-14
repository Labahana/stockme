"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  Checkbox,
  FormLayout,
  InlineGrid,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import { apiUrl, installUrl, useHost, useShop } from "@/lib/hooks/use-shop";

export function SettingsPageClient() {
  const shop = useShop();
  const host = useHost();

  const [needsInstall, setNeedsInstall] = useState(false);
  const [email, setEmail] = useState("");
  const [digestEnabled, setDigestEnabled] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [health, setHealth] = useState<{
    estimatedDbMb: number;
    alert: string;
    tip: string;
    counts: Record<string, number>;
  } | null>(null);
  const [archiving, setArchiving] = useState(false);

  const loadStatus = useCallback(
    () =>
      fetch(apiUrl("/api/billing", shop, host))
        .then(async (r) => {
          const data = await r.json();
          if (r.status === 401 && data.error?.includes("not installed")) {
            setNeedsInstall(true);
          } else {
            setNeedsInstall(false);
          }
        })
        .catch(() => {
          setNeedsInstall(false);
        }),
    [shop, host],
  );

  useEffect(() => {
    Promise.all([
      loadStatus().catch(() => undefined),
      fetch(apiUrl("/api/settings", shop, host))
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("settings failed"))))
        .then((settings) => {
          setEmail(settings.email ?? "");
          setDigestEnabled(settings.lowStockDigestEnabled ?? false);
        })
        .catch(() => {
          // Keep defaults; user can still save.
        }),
      fetch(apiUrl("/api/maintenance", shop, host))
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.estimatedDbMb != null) setHealth(data);
        })
        .catch(() => undefined),
    ]);
  }, [shop, host, loadStatus]);

  const runArchive = async () => {
    setArchiving(true);
    setMessage(null);
    try {
      const res = await fetch(apiUrl("/api/maintenance", shop, host), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daysOld: 90 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Archive failed");
        return;
      }
      setMessage(
        data.archived
          ? `Archived ${data.archived} POs (~${Math.round((data.bytesFreed ?? 0) / 1024)} KB freed)`
          : "No POs older than 90 days to archive",
      );
      const healthRes = await fetch(apiUrl("/api/maintenance", shop, host));
      if (healthRes.ok) setHealth(await healthRes.json());
    } catch {
      setMessage("Archive failed");
    } finally {
      setArchiving(false);
    }
  };

  const saveAlerts = async (sendNow = false) => {
    const res = await fetch(apiUrl("/api/settings", shop, host), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        lowStockDigestEnabled: digestEnabled,
        sendDigestNow: sendNow,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Failed to save settings");
      return;
    }
    if (data.digestResult?.sent) {
      setMessage("Low-stock digest sent");
    } else if (sendNow) {
      setMessage(data.digestResult?.reason ?? "Digest settings saved");
    } else {
      setMessage("Alert settings saved");
    }
  };

  return (
    <Page title="Settings">
      <BlockStack gap="400">
        {needsInstall && (
          <Banner tone="critical" title="Installation required">
            <p>
              Stockme is not fully installed on this store yet. Click below to connect
              Shopify and save your access token.
            </p>
            <div style={{ marginTop: 12 }}>
              <Button
                variant="primary"
                onClick={() => {
                  const href = installUrl(shop, host);
                  if (href) window.open(href, "_top");
                }}
              >
                Install / reconnect Stockme
              </Button>
            </div>
          </Banner>
        )}

        {message && <Banner onDismiss={() => setMessage(null)}>{message}</Banner>}

        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd">Migrate from Stocky</Text>
            <Text as="p" tone="subdued">
              Import Stocky purchase order CSVs and your supplier spreadsheet.
            </Text>
            <Button url={`/app/import${shop ? `?shop=${encodeURIComponent(shop)}` : ""}`}>
              Import from Stocky
            </Button>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd">Help</Text>
            <Text as="p">
              Stockme is independently built and actively maintained — not going anywhere.
            </Text>
            <Text as="p" tone="subdued">
              Questions or bugs? Email{" "}
              <a href="mailto:support@stockme.gentletap.co">support@stockme.gentletap.co</a>
              {" "}— we respond fast, by name.
            </Text>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">Free-tier storage</Text>
            {health ? (
              <>
                <Text as="p">
                  Estimated shop data: ~{health.estimatedDbMb} MB
                  {health.alert === "red"
                    ? " (critical)"
                    : health.alert === "yellow"
                      ? " (watch)"
                      : " (ok)"}
                </Text>
                <Text as="p" tone="subdued">
                  {health.tip}
                </Text>
                <Text as="p" tone="subdued" variant="bodySm">
                  Variants {health.counts.variants ?? 0} · Inventory levels{" "}
                  {health.counts.inventory_levels ?? 0} · POs{" "}
                  {health.counts.purchase_orders ?? 0} · Webhook logs{" "}
                  {health.counts.webhook_logs ?? 0}
                </Text>
              </>
            ) : (
              <Text as="p" tone="subdued">
                Loading storage estimate…
              </Text>
            )}
            <Button onClick={runArchive} loading={archiving}>
              Archive POs older than 90 days
            </Button>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">Low-stock email digest</Text>
            <FormLayout>
              <TextField
                label="Alert email"
                type="email"
                value={email}
                onChange={setEmail}
                autoComplete="email"
              />
              <Checkbox
                label="Enable low-stock digest emails"
                checked={digestEnabled}
                onChange={setDigestEnabled}
              />
              <Text as="p" tone="subdued" variant="bodySm">
                Frequency follows your plan (Starter weekly, Growth every 3 days, Pro
                daily) to stay within free-tier email limits.
              </Text>
              <InlineGrid columns={2} gap="200">
                <Button onClick={() => saveAlerts(false)}>Save alerts</Button>
                <Button onClick={() => saveAlerts(true)}>Send test digest</Button>
              </InlineGrid>
            </FormLayout>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
