"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = (localStorage.getItem("theme") as "dark" | "light") || "dark";
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  if (!mounted) {
    return (
      <div
        style={{
          width: "86px",
          height: "36px",
          borderRadius: "9999px",
          background: "rgba(255, 255, 255, 0.05)"
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        background: theme === "dark" ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.06)",
        border: theme === "dark" ? "1px solid rgba(255, 255, 255, 0.14)" : "1px solid rgba(0, 0, 0, 0.12)",
        color: theme === "dark" ? "#f8fafc" : "#0f172a",
        padding: "6px 14px",
        borderRadius: "9999px",
        fontSize: "0.85rem",
        fontWeight: 600,
        cursor: "pointer",
        backdropFilter: "blur(12px)",
        transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)"
      }}
    >
      <span>{theme === "dark" ? "☀️ Light" : "🌙 Dark"}</span>
    </button>
  );
}
