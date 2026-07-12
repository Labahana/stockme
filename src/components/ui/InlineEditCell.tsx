"use client";

import { useCallback, useEffect, useState } from "react";

/** Spec §15 — click cell → edit → blur/Enter commits. */
export function InlineEditCell({
  value,
  onChange,
  onSave,
  type = "text",
  prefix,
  suffix,
  min,
  placeholder = "—",
  disabled,
  style,
}: {
  value: string | number | null | undefined;
  /** Spec API */
  onChange?: (value: string) => void;
  /** Back-compat async save used by inventory page */
  onSave?: (value: string) => Promise<void> | void;
  type?: "text" | "number" | "currency";
  prefix?: string;
  suffix?: string;
  min?: number;
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  const display =
    value === null || value === undefined || value === "" ? "" : String(value);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(display);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) setEditValue(display);
  }, [display, isEditing]);

  const commit = useCallback(async () => {
    setIsEditing(false);
    if (editValue === display) return;
    setSaving(true);
    try {
      onChange?.(editValue);
      await onSave?.(editValue);
    } finally {
      setSaving(false);
    }
  }, [editValue, display, onChange, onSave]);

  if (disabled) {
    return (
      <span style={style}>
        {prefix}
        {display || placeholder}
        {suffix}
      </span>
    );
  }

  if (isEditing) {
    return (
      <div style={{ minWidth: 80, ...style }} onClick={(e) => e.stopPropagation()}>
        <input
          className="stockme-inline-input"
          aria-label="Edit value"
          autoFocus
          disabled={saving}
          type={type === "currency" ? "number" : type}
          min={min}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => {
            void commit();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void commit();
            } else if (e.key === "Escape") {
              setEditValue(display);
              setIsEditing(false);
            }
          }}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      className="stockme-inline-cell"
      style={style}
      title="Click to edit"
      onClick={() => {
        setEditValue(display);
        setIsEditing(true);
      }}
    >
      {prefix}
      {display || placeholder}
      {suffix}
    </button>
  );
}
