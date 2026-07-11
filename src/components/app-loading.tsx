"use client";

import { BlockStack, Page, Spinner, Text } from "@shopify/polaris";

export function AppLoading({ message = "Loading Stockme…" }: { message?: string }) {
  return (
    <Page title="Stockme">
      <BlockStack gap="300" inlineAlign="center">
        <Spinner accessibilityLabel="Loading" size="large" />
        <Text as="p" tone="subdued">
          {message}
        </Text>
      </BlockStack>
    </Page>
  );
}
