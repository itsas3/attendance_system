"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { DashboardModule } from "../_lib/dashboard-modules";
import { getNavigationGroups } from "../_lib/dashboard-navigation";

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
  const [activeSection, setActiveSection] = useState<string>("staff-profile");

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    onNavigate();
  };

  const sections = [
    { id: "staff-profile", label: "Staff Profile" },
    { id: "bio-data", label: "Bio-data" },
    { id: "contact-details", label: "Contact Details" },
    { id: "emergency-contact", label: "Emergency Contact" },
    { id: "theme-settings", label: "Change Theme" }
  ];

  return (
    <>
      <Link className="sidebar-link" href="/" onClick={onNavigate}>
        <span className="sidebar-link-dot" aria-hidden="true" />← Back to Dashboard
      </Link>

      <div className="sidebar-group">
        <p className="sidebar-group-label">Profile Sections</p>
        {sections.map((sec) => {
          const active = activeSection === sec.id;
          return (
            <button
              key={sec.id}
              type="button"
              className={`sidebar-link${active ? " is-active" : ""}`}
              onClick={() => scrollToSection(sec.id)}
            >
              <span className="sidebar-link-dot" aria-hidden="true" />
              {sec.label}
            </button>
          );
        })}
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
