"use client";

import { Badge } from "@shopify/polaris";

type Tone = "success" | "attention" | "warning" | "critical" | "info" | undefined;

const STATUS_MAP: Record<string, { label: string; tone: Tone; icon: string }> = {
  draft: { label: "Draft", tone: "info", icon: "○" },
  pending: { label: "Pending", tone: "warning", icon: "◐" },
  sent: { label: "Sent", tone: "attention", icon: "↗" },
  partially_received: { label: "Partially received", tone: "warning", icon: "◑" },
  received: { label: "Received", tone: "success", icon: "✓" },
  cancelled: { label: "Cancelled", tone: "critical", icon: "✕" },
  in_transit: { label: "In transit", tone: "attention", icon: "→" },
  in_progress: { label: "In progress", tone: "attention", icon: "…" },
  completed: { label: "Completed", tone: "success", icon: "✓" },
  low: { label: "Low stock", tone: "warning", icon: "!" },
  out: { label: "Out of stock", tone: "critical", icon: "!" },
  ok: { label: "In stock", tone: "success", icon: "✓" },
};

/** Status = color + text + icon (never color alone) — Stocky muscle memory. */
export function StatusBadge({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  const key = status.toLowerCase().replace(/\s+/g, "_");
  const mapped = STATUS_MAP[key];
  const display = label ?? mapped?.label ?? status.replace(/_/g, " ");
  const tone = mapped?.tone;
  const icon = mapped?.icon ?? "•";

  return <Badge tone={tone}>{`${icon} ${display}`}</Badge>;
}
