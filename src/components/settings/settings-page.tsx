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
    ]);
  }, [shop, host, loadStatus]);

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
                label="Send daily low-stock digest"
                checked={digestEnabled}
                onChange={setDigestEnabled}
              />
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
