"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import { PLAN_TIERS, type PlanTier } from "@/lib/constants";
import { apiUrl, installUrl, useHost, useShop } from "@/lib/hooks/use-shop";

export function SettingsPageClient() {
  const shop = useShop();
  const host = useHost();
  const searchParams = useSearchParams();
  const billingRequired = searchParams.get("billing") === "required";
  const billingConfirmed = searchParams.get("billing") === "confirmed";

  const [planTier, setPlanTier] = useState<PlanTier>("starter");
  const [hasActivePayment, setHasActivePayment] = useState(false);
  const [needsInstall, setNeedsInstall] = useState(false);
  const [usage, setUsage] = useState<{ skuCount: number; locationCount: number } | null>(null);
  const [email, setEmail] = useState("");
  const [digestEnabled, setDigestEnabled] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState<PlanTier | null>(null);

  const loadBilling = useCallback(
    () =>
      fetch(apiUrl("/api/billing", shop, host))
        .then(async (r) => {
          const billing = await r.json();
          if (r.status === 401 && billing.error?.includes("not installed")) {
            setNeedsInstall(true);
            return billing;
          }
          setNeedsInstall(false);
          return billing;
        })
        .then((billing) => {
          setPlanTier(billing.planTier ?? "starter");
          setHasActivePayment(billing.hasActivePayment ?? false);
          if (billing.usage) {
            setUsage({
              skuCount: billing.usage.skuCount,
              locationCount: billing.usage.locationCount,
            });
          }
          if (billingConfirmed && billing.hasActivePayment) {
            setMessage("Shopify subscription active — thank you!");
          }
        }),
    [shop, host, billingConfirmed],
  );

  useEffect(() => {
    Promise.all([
      loadBilling().catch(() => undefined),
      fetch(apiUrl("/api/settings", shop, host))
        .then((r) => r.ok ? r.json() : Promise.reject(new Error("settings failed")))
        .then((settings) => {
          setEmail(settings.email ?? "");
          setDigestEnabled(settings.lowStockDigestEnabled ?? false);
        })
        .catch(() => {
          // Keep defaults; user can still save.
        }),
    ]);
  }, [shop, host, loadBilling]);

  const subscribe = async (plan: PlanTier) => {
    setSubscribing(plan);
    setMessage(null);
    try {
      const res = await fetch(apiUrl("/api/billing", shop, host), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (res.status === 401 && data.error?.includes("not installed")) {
        setNeedsInstall(true);
        setMessage("Complete app installation first (button below), then subscribe.");
        return;
      }
      if (!res.ok) {
        setMessage(data.error ?? `Billing failed (${res.status})`);
        return;
      }
      if (data.confirmationUrl) {
        window.open(data.confirmationUrl, "_top");
      } else if (data.error) {
        setMessage(data.error);
      } else if (res.ok) {
        setMessage("Subscription updated — refreshing billing…");
        loadBilling();
      } else {
        setMessage("Could not start Shopify billing");
      }
    } finally {
      setSubscribing(null);
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
              Shopify and save your access token, then choose a plan.
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

        {billingRequired && !hasActivePayment && !needsInstall && (
          <Banner tone="warning">
            Choose a plan below to activate Stockme. Billing is handled securely through Shopify.
          </Banner>
        )}

        {message && <Banner onDismiss={() => setMessage(null)}>{message}</Banner>}

        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">Billing (Shopify)</Text>
            <Text as="p" tone="subdued">
              Current plan: {PLAN_TIERS[planTier].name} —{" "}
              {hasActivePayment ? "Active via Shopify" : "Not subscribed"}
            </Text>
            {usage && (
              <Text as="p" tone="subdued">
                Usage: {usage.skuCount} SKUs, {usage.locationCount} location
                {usage.locationCount === 1 ? "" : "s"}
                {PLAN_TIERS[planTier].maxSkus
                  ? ` (limit ${PLAN_TIERS[planTier].maxSkus} SKUs)`
                  : ""}
              </Text>
            )}
            <Text as="p" tone="subdued">
              All plans include a 14-day free trial. Charges appear on your Shopify invoice.
            </Text>
          </BlockStack>
        </Card>

        <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
          {(Object.keys(PLAN_TIERS) as PlanTier[]).map((key) => (
            <Card key={key}>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">{PLAN_TIERS[key].name}</Text>
                <Text as="p" variant="headingLg">${PLAN_TIERS[key].price}/mo</Text>
                <Text as="p" tone="subdued">
                  {PLAN_TIERS[key].maxSkus
                    ? `Up to ${PLAN_TIERS[key].maxSkus} SKUs`
                    : "Unlimited SKUs"}
                </Text>
                <Button
                  variant={planTier === key && hasActivePayment ? "primary" : "secondary"}
                  loading={subscribing === key}
                  disabled={Boolean(subscribing) || needsInstall}
                  onClick={() => subscribe(key)}
                >
                  {planTier === key && hasActivePayment
                    ? "Current plan"
                    : "Subscribe with Shopify"}
                </Button>
              </BlockStack>
            </Card>
          ))}
        </InlineGrid>

        {hasActivePayment && (
          <>
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
                  <TextField label="Alert email" type="email" value={email} onChange={setEmail} autoComplete="email" />
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
          </>
        )}
      </BlockStack>
    </Page>
  );
}
