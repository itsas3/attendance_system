"use client";

import type { ThemeKey, ThemeOption } from "./theme-settings-section";

export function ThemeCard({
  isActive,
  onSelect,
  theme
}: {
  isActive: boolean;
  onSelect: (key: ThemeKey) => void;
  theme: ThemeOption;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(theme.key)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        padding: "14px 16px",
        borderRadius: "12px",
        border: isActive ? "2px solid var(--accent)" : "1px solid var(--border)",
        background: isActive ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.02)",
        cursor: "pointer",
        textAlign: "left",
        transition: "all 0.2s ease",
        boxShadow: isActive ? "0 4px 16px rgba(0, 0, 0, 0.2)" : "none"
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          marginBottom: "8px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              width: "16px",
              height: "16px",
              borderRadius: "50%",
              backgroundColor: theme.color,
              boxShadow: `0 0 8px ${theme.color}`
            }}
          />
          <strong style={{ color: "var(--text)", fontSize: "0.92rem" }}>{theme.label}</strong>
        </div>
        {isActive && (
          <span
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: "20px",
              background: "var(--accent)",
              color: "#ffffff"
            }}
          >
            Active ✓
          </span>
        )}
      </div>
      <span style={{ fontSize: "0.78rem", color: "var(--muted)", lineHeight: "1.3" }}>
        {theme.description}
      </span>
    </button>
  );
}
