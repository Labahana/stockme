"use client";

import { useEffect, useState } from "react";

/**
 * Click cell → edit → blur/Enter commits. Spec: inline everything for dense
 * inventory tables (min/max thresholds).
 */
export function InlineEditCell({
  value,
  onSave,
  type = "number",
  min,
  placeholder = "—",
  disabled,
}: {
  value: string | number | null | undefined;
  onSave: (next: string) => Promise<void> | void;
  type?: "text" | "number";
  min?: number;
  placeholder?: string;
  disabled?: boolean;
}) {
  const display = value === null || value === undefined || value === "" ? "" : String(value);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(display);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(display);
  }, [display, editing]);

  const commit = async () => {
    if (draft === display) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (disabled) {
    return <span className="stockme-inline-cell">{display || placeholder}</span>;
  }

  if (!editing) {
    return (
      <button
        type="button"
        className="stockme-inline-cell stockme-inline-cell--editable"
        onClick={() => setEditing(true)}
        title="Click to edit"
      >
        {display || placeholder}
      </button>
    );
  }

  return (
    <div className="stockme-inline-edit" onClick={(e) => e.stopPropagation()}>
      <input
        className="stockme-inline-input"
        aria-label="Edit value"
        autoFocus
        type={type}
        min={min}
        value={draft}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          void commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void commit();
          }
          if (e.key === "Escape") {
            setDraft(display);
            setEditing(false);
          }
        }}
      />
    </div>
  );
}
