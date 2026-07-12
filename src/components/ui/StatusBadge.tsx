"use client";

import { Badge } from "@shopify/polaris";

type Status =
  | "draft"
  | "pending"
  | "sent"
  | "partially_received"
  | "received"
  | "cancelled"
  | "in_progress"
  | "in_transit"
  | "completed"
  | "critical"
  | "warning"
  | "success"
  | "low"
  | "out"
  | "ok"
  | string;

type Tone = "success" | "attention" | "warning" | "critical" | "info" | undefined;

const STATUS_MAP: Record<string, { tone: Tone; label: string }> = {
  draft: { tone: undefined, label: "Draft" },
  pending: { tone: "warning", label: "Pending" },
  sent: { tone: "attention", label: "Sent" },
  partially_received: { tone: "attention", label: "Partially Received" },
  received: { tone: "success", label: "Received" },
  cancelled: { tone: "critical", label: "Cancelled" },
  in_progress: { tone: "attention", label: "In Progress" },
  in_transit: { tone: "attention", label: "In Transit" },
  completed: { tone: "success", label: "Completed" },
  critical: { tone: "critical", label: "Critical" },
  warning: { tone: "warning", label: "Warning" },
  success: { tone: "success", label: "Good" },
  low: { tone: "warning", label: "Low stock" },
  out: { tone: "critical", label: "Out of stock" },
  ok: { tone: "success", label: "In stock" },
};

/** Spec §15 — status = label + color (never color alone). */
export function StatusBadge({
  status,
  size = "small",
  label,
}: {
  status: Status;
  size?: "small" | "medium" | "large";
  label?: string;
}) {
  const key = String(status).toLowerCase().replace(/\s+/g, "_");
  const mapped = STATUS_MAP[key];
  const display = label ?? mapped?.label ?? String(status).replace(/_/g, " ");
  const badgeSize = size === "large" ? "medium" : size;
  return (
    <Badge tone={mapped?.tone} size={badgeSize}>
      {display}
    </Badge>
  );
}
