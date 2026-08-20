"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { DashboardModule } from "../_lib/dashboard-modules";
import { getNavigationGroups } from "../_lib/dashboard-navigation";

type ThemeKey =
  | "purple"
  | "green"
  | "blue"
  | "amber"
  | "midnight"
  | "light"
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

type DashboardSidebarProps = {
  modules: DashboardModule[];
  onNavigate: () => void;
  open: boolean;
};

function isCurrentRoute(pathname: string, href: string): boolean {
  if (href === "/") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function ProfileSidebarMenu({ onNavigate }: { onNavigate: () => void }) {
  const [activeTheme, setActiveTheme] = useState<ThemeKey>("purple");
  const [showThemePicker, setShowThemePicker] = useState(true);

  useEffect(() => {
    const savedTheme = localStorage.getItem("portal_theme") as ThemeKey | null;
    if (savedTheme && themes.some((t) => t.key === savedTheme)) {
      setActiveTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    }
  }, []);

  const changeTheme = (theme: ThemeKey) => {
    setActiveTheme(theme);
    localStorage.setItem("portal_theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    onNavigate();
  };

  return (
    <>
      <Link className="sidebar-link" href="/" onClick={onNavigate}>
        <span className="sidebar-link-dot" aria-hidden="true" />
        ← Back to Dashboard
      </Link>

      <div className="sidebar-group">
        <p className="sidebar-group-label">Profile Sections</p>
        <button type="button" className="sidebar-link" onClick={() => scrollToSection("staff-profile")}>
          <span className="sidebar-link-dot" aria-hidden="true" />
          Staff Profile
        </button>
        <button type="button" className="sidebar-link" onClick={() => scrollToSection("bio-data")}>
          <span className="sidebar-link-dot" aria-hidden="true" />
          Bio-data
        </button>
        <button type="button" className="sidebar-link" onClick={() => scrollToSection("contact-details")}>
          <span className="sidebar-link-dot" aria-hidden="true" />
          Contact Details
        </button>
        <button type="button" className="sidebar-link" onClick={() => scrollToSection("emergency-contact")}>
          <span className="sidebar-link-dot" aria-hidden="true" />
          Emergency Contact
        </button>
      </div>

      <div className="sidebar-group">
        <p className="sidebar-group-label">Theme Settings</p>
        <button
          type="button"
          className="sidebar-link"
          onClick={() => setShowThemePicker(!showThemePicker)}
          style={{ justifyContent: "space-between" }}
        >
          <span>Change Theme</span>
          <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>{showThemePicker ? "▲" : "▼"}</span>
        </button>

        {showThemePicker && (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "4px" }}>
            {themes.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => changeTheme(t.key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "7px 10px",
                  borderRadius: "8px",
                  border: "none",
                  background: activeTheme === t.key ? "var(--sidebar-active-bg-start)" : "transparent",
                  color: "var(--text)",
                  fontSize: "0.82rem",
                  fontWeight: activeTheme === t.key ? 700 : 500,
                  cursor: "pointer",
                  width: "100%"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      backgroundColor: t.color,
                      display: "inline-block"
                    }}
                  />
                  <span>{t.label}</span>
                </div>
                {activeTheme === t.key && <span style={{ color: "var(--accent)", fontSize: "0.8rem" }}>✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export function DashboardSidebar({ modules, onNavigate, open }: DashboardSidebarProps) {
  const pathname = usePathname();
  const groups = getNavigationGroups(modules);
  const isProfilePage = pathname === "/my-profile";

  return (
    <aside
      className={`dashboard-sidebar${open ? " is-open" : ""}`}
      aria-label="Main navigation"
      id="dashboard-navigation"
    >
      <div className="sidebar-brand">
        <span className="sidebar-brand-mark" aria-hidden="true">
          W
        </span>
        <div>
          <strong>Workforce</strong>
          <span>Portal</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {isProfilePage ? (
          <ProfileSidebarMenu onNavigate={onNavigate} />
        ) : (
          <>
            <Link
              aria-current={pathname === "/" ? "page" : undefined}
              className={`sidebar-link${pathname === "/" ? " is-active" : ""}`}
              href="/"
              onClick={onNavigate}
            >
              <span className="sidebar-link-dot" aria-hidden="true" />
              Home
            </Link>

            {groups.map((group) => (
              <div className="sidebar-group" key={group.label}>
                <p className="sidebar-group-label">{group.label}</p>
                {group.modules.map((module) => {
                  const active = isCurrentRoute(pathname, module.href);
                  return (
                    <Link
                      aria-current={active ? "page" : undefined}
                      className={`sidebar-link${active ? " is-active" : ""}`}
                      href={module.href}
                      key={module.href}
                      onClick={onNavigate}
                    >
                      <span className="sidebar-link-dot" aria-hidden="true" />
                      {module.name}
                    </Link>
                  );
                })}
              </div>
            ))}
          </>
        )}
      </nav>

      <div className="sidebar-footer">Secure Workforce Portal</div>
    </aside>
  );
}
