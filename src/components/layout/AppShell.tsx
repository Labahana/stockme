"use client";

import { Modal, Text, BlockStack, Button } from "@shopify/polaris";
import { Suspense, useState, type ReactNode } from "react";
import { SidebarNav } from "@/components/layout/SidebarNav";

export function AppFooter() {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <>
      <button type="button" className="stockme-help-fab" onClick={() => setHelpOpen(true)}>
        Help
      </button>
      <Modal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="Need help?"
        primaryAction={{
          content: "Email support",
          onAction: () => {
            window.location.href = "mailto:support@stockme.gentletap.co";
          },
        }}
        secondaryActions={[{ content: "Close", onAction: () => setHelpOpen(false) }]}
      >
        <Modal.Section>
          <BlockStack gap="200">
            <Text as="p">
              StockMe is independently built and actively maintained — we&apos;re not going
              anywhere.
            </Text>
            <Text as="p" tone="subdued">
              Founder support:{" "}
              <Button url="mailto:support@stockme.gentletap.co" variant="plain">
                support@stockme.gentletap.co
              </Button>
              . We respond fast, by name.
            </Text>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="stockme-app-shell">
      <div className="stockme-mobile-bar">
        <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open menu">
          ☰ Menu
        </button>
        <strong>StockMe</strong>
        <span />
      </div>

      <Suspense fallback={null}>
        <SidebarNav open={mobileOpen} onNavigate={() => setMobileOpen(false)} />
      </Suspense>

      {mobileOpen && (
        <button
          type="button"
          className="stockme-overlay"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
          style={{
            display: "block",
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            zIndex: 40,
            border: "none",
          }}
        />
      )}

      <div className="stockme-main">
        <div className="stockme-main__content">{children}</div>
        <AppFooter />
      </div>
    </div>
  );
}
