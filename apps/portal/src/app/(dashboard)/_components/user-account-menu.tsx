"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logout } from "../../(auth)/login/actions";
import { ThemeSelector } from "./theme-selector";

type UserAccountMenuProps = {
  fullName: string;
  roleName: string;
};

function getInitials(fullName: string): string {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function UserAccountMenu({ fullName, roleName }: UserAccountMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="dashboard-user"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label="User Account Menu"
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: 0,
          display: "flex",
          alignItems: "center",
          gap: "10px"
        }}
      >
        <span className="dashboard-avatar" aria-hidden="true">
          {getInitials(fullName)}
        </span>
        <span className="dashboard-user-copy" style={{ textAlign: "left" }}>
          <strong>{fullName}</strong>
          <span>{roleName}</span>
        </span>
        <span style={{ fontSize: "0.7rem", color: "var(--muted)", opacity: 0.7, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s ease" }}>
          ▼
        </span>
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 12px)",
            right: 0,
            width: "260px",
            background: "var(--background-secondary)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.45)",
            padding: "16px",
            zIndex: 100,
            display: "flex",
            flexDirection: "column",
            gap: "14px"
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", paddingBottom: "12px", borderBottom: "1px solid var(--border)" }}>
            <span className="dashboard-avatar" aria-hidden="true" style={{ width: "34px", height: "34px", fontSize: "0.75rem" }}>
              {getInitials(fullName)}
            </span>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <strong style={{ fontSize: "0.9rem", color: "var(--text)" }}>{fullName}</strong>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "capitalize" }}>{roleName}</span>
            </div>
          </div>

          {/* Profile Link */}
          <Link
            href="/my-profile"
            onClick={() => setIsOpen(false)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 12px",
              borderRadius: "10px",
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              textDecoration: "none",
              fontSize: "0.88rem",
              fontWeight: 600
            }}
          >
            <span>👤</span>
            <span>My Profile & Settings</span>
          </Link>

          {/* Theme Selector */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Theme Settings
            </span>
            <ThemeSelector />
          </div>

          {/* Sign Out Action */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
            <form action={logout}>
              <button
                type="submit"
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #ef4444, #dc2626)",
                  border: "none",
                  color: "#ffffff",
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(239, 68, 68, 0.25)",
                  transition: "transform 0.15s ease, opacity 0.15s ease"
                }}
              >
                <span>Sign Out</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
