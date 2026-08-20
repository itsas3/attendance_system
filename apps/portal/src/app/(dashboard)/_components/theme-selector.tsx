"use client";

import { useEffect, useRef, useState } from "react";

export type ThemeKey =
  | "purple"
  | "green"
  | "blue"
  | "amber"
  | "midnight"
  | "light"
  | "light-white"
  | "light-purple"
  | "light-blue"
  | "light-green";

type ThemeOption = {
  category: "Light" | "Dark";
  color: string;
  key: ThemeKey;
  label: string;
};

const themes: ThemeOption[] = [
  { key: "light", label: "White", color: "#2563eb", category: "Light" },
  { key: "light-purple", label: "Lavender Light", color: "#7c3aed", category: "Light" },
  { key: "light-blue", label: "Sky Blue Light", color: "#0284c7", category: "Light" },
  { key: "light-green", label: "Mint Green Light", color: "#10b981", category: "Light" },
  { key: "green", label: "Emerald Dark", color: "#10b981", category: "Dark" },
  { key: "blue", label: "Ocean Blue Dark", color: "#3b82f6", category: "Dark" },
  { key: "amber", label: "Amber Sunset Dark", color: "#f59e0b", category: "Dark" },
  { key: "midnight", label: "Midnight Dark", color: "#64748b", category: "Dark" },
  { key: "purple", label: "Purple Dusk Dark", color: "#8b5cf6", category: "Dark" }
];

function ThemeMenuItem({
  active,
  option,
  onSelect
}: {
  active: boolean;
  onSelect: (key: ThemeKey) => void;
  option: ThemeOption;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(option.key)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 12px",
        borderRadius: "8px",
        border: "none",
        background: active ? "var(--sidebar-active-bg-start)" : "transparent",
        color: "var(--text)",
        fontSize: "0.85rem",
        fontWeight: active ? 700 : 500,
        cursor: "pointer",
        textAlign: "left",
        width: "100%"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span
          style={{
            width: "12px",
            height: "12px",
            borderRadius: "50%",
            backgroundColor: option.color,
            display: "inline-block"
          }}
        />
        <span>{option.label}</span>
      </div>
      {active && <span style={{ color: "var(--accent)", fontSize: "0.85rem" }}>✓</span>}
    </button>
  );
}

function ThemeMenuDropdown({
  activeTheme,
  onSelect
}: {
  activeTheme: ThemeKey;
  onSelect: (key: ThemeKey) => void;
}) {
  const lightThemes = themes.filter((t) => t.category === "Light");
  const darkThemes = themes.filter((t) => t.category === "Dark");

  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        right: 0,
        width: "230px",
        background: "var(--background-secondary)",
        border: "1px solid var(--border)",
        borderRadius: "14px",
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)",
        padding: "8px",
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        gap: "2px"
      }}
    >
      <div
        style={{
          padding: "4px 8px",
          fontSize: "0.7rem",
          fontWeight: 700,
          color: "var(--muted)",
          textTransform: "uppercase"
        }}
      >
        Light Themes
      </div>
      {lightThemes.map((t) => (
        <ThemeMenuItem key={t.key} active={activeTheme === t.key} option={t} onSelect={onSelect} />
      ))}

      <div
        style={{
          padding: "8px 8px 4px",
          fontSize: "0.7rem",
          fontWeight: 700,
          color: "var(--muted)",
          textTransform: "uppercase",
          borderTop: "1px solid var(--border)",
          marginTop: "4px"
        }}
      >
        Dark Themes
      </div>
      {darkThemes.map((t) => (
        <ThemeMenuItem key={t.key} active={activeTheme === t.key} option={t} onSelect={onSelect} />
      ))}
    </div>
  );
}

export function ThemeSelector() {
  const [activeTheme, setActiveTheme] = useState<ThemeKey>("purple");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem("portal_theme") as ThemeKey | null;
    if (savedTheme && themes.some((t) => t.key === savedTheme)) {
      setActiveTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const changeTheme = (theme: ThemeKey) => {
    setActiveTheme(theme);
    localStorage.setItem("portal_theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
    setIsOpen(false);
  };

  const activeOption = themes.find((t) => t.key === activeTheme) ?? themes[0]!;

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 14px",
          borderRadius: "10px",
          background: "rgba(255, 255, 255, 0.08)",
          border: "1px solid var(--border)",
          color: "var(--text)",
          fontSize: "0.85rem",
          fontWeight: 600,
          cursor: "pointer"
        }}
        aria-expanded={isOpen}
        aria-label="Change Theme Menu"
      >
        <span
          style={{
            width: "12px",
            height: "12px",
            borderRadius: "50%",
            backgroundColor: activeOption.color,
            boxShadow: `0 0 6px ${activeOption.color}`
          }}
        />
        <span>Change Theme</span>
        <span style={{ fontSize: "0.7rem", opacity: 0.7 }}>{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && <ThemeMenuDropdown activeTheme={activeTheme} onSelect={changeTheme} />}
    </div>
  );
}
