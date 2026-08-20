"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logout } from "../../(auth)/login/actions";

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

function UserAccountDropdown({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        right: 0,
        width: "190px",
        background: "var(--background-secondary)",
        border: "1px solid var(--border)",
        borderRadius: "14px",
        boxShadow: "0 16px 36px rgba(0, 0, 0, 0.4)",
        padding: "8px",
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        gap: "4px"
      }}
    >
      <Link
        href="/my-profile"
        onClick={onClose}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "10px 12px",
          borderRadius: "10px",
          background: "transparent",
          color: "var(--text)",
          textDecoration: "none",
          fontSize: "0.88rem",
          fontWeight: 500,
          transition: "background 0.15s ease"
        }}
        className="dropdown-menu-item"
      >
        <span>⚙️</span>
        <span>Settings</span>
      </Link>

      <form action={logout} style={{ width: "100%" }}>
        <button
          type="submit"
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px 12px",
            borderRadius: "10px",
            background: "rgba(239, 68, 68, 0.1)",
            border: "none",
            color: "#ef4444",
            fontSize: "0.88rem",
            fontWeight: 600,
            cursor: "pointer",
            textAlign: "left",
            transition: "background 0.15s ease"
          }}
          className="dropdown-menu-signout"
        >
          <span>🚪</span>
          <span>Sign Out</span>
        </button>
      </form>
    </div>
  );
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
          padding: "6px 10px",
          borderRadius: "10px",
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
        <span
          style={{
            fontSize: "0.7rem",
            color: "var(--muted)",
            opacity: 0.7,
            transform: isOpen ? "rotate(180deg)" : "none",
            transition: "transform 0.2s ease"
          }}
        >
          ▼
        </span>
      </button>

      {isOpen && <UserAccountDropdown onClose={() => setIsOpen(false)} />}
    </div>
  );
}
