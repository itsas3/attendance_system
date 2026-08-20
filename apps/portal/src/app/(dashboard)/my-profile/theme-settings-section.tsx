"use client";

import { useEffect, useState } from "react";
import { ThemeCard } from "./theme-card";

export type ThemeKey =
  | "purple"
  | "green"
  | "blue"
  | "amber"
  | "midnight"
  | "light"
  | "light-purple"
  | "light-blue"
  | "light-green";

export type ThemeOption = {
  category: "Light" | "Dark";
  color: string;
  key: ThemeKey;
  label: string;
  description: string;
};

const themes: ThemeOption[] = [
  {
    key: "light",
    label: "White",
    color: "#2563eb",
    category: "Light",
    description: "Clean white background with blue accents"
  },
  {
    key: "light-purple",
    label: "Lavender Light",
    color: "#7c3aed",
    category: "Light",
    description: "Soft lavender tone with purple accents"
  },
  {
    key: "light-blue",
    label: "Sky Blue Light",
    color: "#0284c7",
    category: "Light",
    description: "Crisp sky blue appearance"
  },
  {
    key: "light-green",
    label: "Mint Green Light",
    color: "#10b981",
    category: "Light",
    description: "Refreshing mint green style"
  },
  {
    key: "green",
    label: "Emerald Dark",
    color: "#10b981",
    category: "Dark",
    description: "Rich dark mode with emerald green highlights"
  },
  {
    key: "blue",
    label: "Ocean Blue Dark",
    color: "#3b82f6",
    category: "Dark",
    description: "Deep navy dark mode with blue highlights"
  },
  {
    key: "amber",
    label: "Amber Sunset Dark",
    color: "#f59e0b",
    category: "Dark",
    description: "Warm dark mode with glowing amber highlights"
  },
  {
    key: "midnight",
    label: "Midnight Dark",
    color: "#64748b",
    category: "Dark",
    description: "Sleek slate gray dark mode"
  },
  {
    key: "purple",
    label: "Purple Dusk Dark",
    color: "#8b5cf6",
    category: "Dark",
    description: "Deep violet dark mode with purple accents"
  }
];

function ThemeGroupGrid({
  activeTheme,
  onSelect,
  themeList,
  title
}: {
  activeTheme: ThemeKey;
  onSelect: (key: ThemeKey) => void;
  themeList: ThemeOption[];
  title: string;
}) {
  return (
    <div>
      <h4
        style={{
          fontSize: "0.75rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--muted)",
          marginBottom: "12px"
        }}
      >
        {title}
      </h4>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: "12px"
        }}
      >
        {themeList.map((t) => (
          <ThemeCard key={t.key} isActive={activeTheme === t.key} onSelect={onSelect} theme={t} />
        ))}
      </div>
    </div>
  );
}

export function ThemeSettingsSection() {
  const [activeTheme, setActiveTheme] = useState<ThemeKey>("purple");

  useEffect(() => {
    const savedTheme = localStorage.getItem("portal_theme") as ThemeKey | null;
    if (savedTheme && themes.some((t) => t.key === savedTheme)) {
      setActiveTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    }
  }, []);

  const changeTheme = (themeKey: ThemeKey) => {
    setActiveTheme(themeKey);
    localStorage.setItem("portal_theme", themeKey);
    document.documentElement.setAttribute("data-theme", themeKey);
  };

  const lightThemes = themes.filter((t) => t.category === "Light");
  const darkThemes = themes.filter((t) => t.category === "Dark");

  return (
    <section
      id="theme-settings"
      style={{
        marginTop: "12px",
        padding: "24px",
        borderRadius: "16px",
        background: "var(--background-secondary)",
        border: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        gap: "20px"
      }}
    >
      <div>
        <h3
          style={{
            color: "var(--accent)",
            margin: "0 0 6px 0",
            fontSize: "1.2rem",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <span>🎨</span> Theme & Appearance
        </h3>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.88rem" }}>
          Select a theme to customize the color palette and visual look of your workforce portal.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <ThemeGroupGrid
          activeTheme={activeTheme}
          onSelect={changeTheme}
          themeList={lightThemes}
          title="Light Themes"
        />
        <ThemeGroupGrid
          activeTheme={activeTheme}
          onSelect={changeTheme}
          themeList={darkThemes}
          title="Dark Themes"
        />
      </div>
    </section>
  );
}
