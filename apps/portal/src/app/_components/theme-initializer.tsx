"use client";

import { useEffect } from "react";

const VALID_THEMES = [
  "purple",
  "green",
  "blue",
  "amber",
  "midnight",
  "light",
  "light-purple",
  "light-blue",
  "light-green"
];

export function ThemeInitializer() {
  useEffect(() => {
    const savedTheme = localStorage.getItem("portal_theme");
    if (savedTheme && VALID_THEMES.includes(savedTheme)) {
      document.documentElement.setAttribute("data-theme", savedTheme);
    }
  }, []);

  return null;
}
