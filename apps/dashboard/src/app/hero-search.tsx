"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { Route } from "next";

export interface DashboardModule {
  name: string;
  permission: string;
  description: string;
  href?: string;
}

const MODULE_STYLING: Record<
  string,
  {
    category: "attendance" | "team" | "career" | "admin";
    icon: string;
    tag: string;
    gradient: string;
    hoverBorder: string;
    hoverShadow: string;
    iconBg: string;
    iconBorder: string;
    tagColor: string;
  }
> = {
  "My attendance": {
    category: "attendance",
    icon: "⏱️",
    tag: "Personal Log",
    gradient: "linear-gradient(90deg, #10b981, #06b6d4)",
    hoverBorder: "rgba(16, 185, 129, 0.5)",
    hoverShadow: "0 0 35px rgba(16, 185, 129, 0.25)",
    iconBg: "rgba(16, 185, 129, 0.15)",
    iconBorder: "rgba(16, 185, 129, 0.3)",
    tagColor: "#34d399"
  },
  "Apply for Leave": {
    category: "attendance",
    icon: "🌴",
    tag: "Time Off",
    gradient: "linear-gradient(90deg, #f43f5e, #fb923c)",
    hoverBorder: "rgba(244, 63, 94, 0.5)",
    hoverShadow: "0 0 35px rgba(244, 63, 94, 0.25)",
    iconBg: "rgba(244, 63, 94, 0.15)",
    iconBorder: "rgba(244, 63, 94, 0.3)",
    tagColor: "#fb7185"
  },
  "Team attendance": {
    category: "attendance",
    icon: "👥",
    tag: "Real-time Team",
    gradient: "linear-gradient(90deg, #3b82f6, #6366f1)",
    hoverBorder: "rgba(59, 130, 246, 0.5)",
    hoverShadow: "0 0 35px rgba(59, 130, 246, 0.25)",
    iconBg: "rgba(59, 130, 246, 0.15)",
    iconBorder: "rgba(59, 130, 246, 0.3)",
    tagColor: "#60a5fa"
  },
  "Company Attendance": {
    category: "attendance",
    icon: "🏢",
    tag: "Organization Metric",
    gradient: "linear-gradient(90deg, #0284c7, #38bdf8)",
    hoverBorder: "rgba(56, 189, 248, 0.5)",
    hoverShadow: "0 0 35px rgba(56, 189, 248, 0.25)",
    iconBg: "rgba(56, 189, 248, 0.15)",
    iconBorder: "rgba(56, 189, 248, 0.3)",
    tagColor: "#38bdf8"
  },
  "Approvals": {
    category: "team",
    icon: "⚡",
    tag: "Manager Portal",
    gradient: "linear-gradient(90deg, #f59e0b, #eab308)",
    hoverBorder: "rgba(245, 158, 11, 0.5)",
    hoverShadow: "0 0 35px rgba(245, 158, 11, 0.25)",
    iconBg: "rgba(245, 158, 11, 0.15)",
    iconBorder: "rgba(245, 158, 11, 0.3)",
    tagColor: "#fbbf24"
  },
  "My Team": {
    category: "team",
    icon: "💜",
    tag: "People & Performance",
    gradient: "linear-gradient(90deg, #a855f7, #ec4899)",
    hoverBorder: "rgba(168, 85, 247, 0.5)",
    hoverShadow: "0 0 35px rgba(168, 85, 247, 0.25)",
    iconBg: "rgba(168, 85, 247, 0.15)",
    iconBorder: "rgba(168, 85, 247, 0.3)",
    tagColor: "#c084fc"
  },
  "Performance Tracking & Analysis": {
    category: "team",
    icon: "📈",
    tag: "HR Analytics",
    gradient: "linear-gradient(90deg, #8b5cf6, #d946ef)",
    hoverBorder: "rgba(217, 70, 239, 0.5)",
    hoverShadow: "0 0 35px rgba(217, 70, 239, 0.25)",
    iconBg: "rgba(217, 70, 239, 0.15)",
    iconBorder: "rgba(217, 70, 239, 0.3)",
    tagColor: "#e879f9"
  },
  "List all employees": {
    category: "team",
    icon: "📇",
    tag: "Staff Directory",
    gradient: "linear-gradient(90deg, #06b6d4, #3b82f6)",
    hoverBorder: "rgba(6, 182, 212, 0.5)",
    hoverShadow: "0 0 35px rgba(6, 182, 212, 0.25)",
    iconBg: "rgba(6, 182, 212, 0.15)",
    iconBorder: "rgba(6, 182, 212, 0.3)",
    tagColor: "#22d3ee"
  },
  "Jobs": {
    category: "career",
    icon: "💼",
    tag: "Recruitment Portal",
    gradient: "linear-gradient(90deg, #14b8a6, #0ea5e9)",
    hoverBorder: "rgba(20, 184, 166, 0.5)",
    hoverShadow: "0 0 35px rgba(20, 184, 166, 0.25)",
    iconBg: "rgba(20, 184, 166, 0.15)",
    iconBorder: "rgba(20, 184, 166, 0.3)",
    tagColor: "#2dd4bf"
  },
  "Announcements": {
    category: "career",
    icon: "📢",
    tag: "Company Policy",
    gradient: "linear-gradient(90deg, #3b82f6, #8b5cf6)",
    hoverBorder: "rgba(96, 165, 250, 0.5)",
    hoverShadow: "0 0 35px rgba(96, 165, 250, 0.25)",
    iconBg: "rgba(96, 165, 250, 0.15)",
    iconBorder: "rgba(96, 165, 250, 0.3)",
    tagColor: "#60a5fa"
  },
  "Manual requests": {
    category: "attendance",
    icon: "✍️",
    tag: "Punch Correction",
    gradient: "linear-gradient(90deg, #f97316, #fbbf24)",
    hoverBorder: "rgba(249, 115, 22, 0.5)",
    hoverShadow: "0 0 35px rgba(249, 115, 22, 0.25)",
    iconBg: "rgba(249, 115, 22, 0.15)",
    iconBorder: "rgba(249, 115, 22, 0.3)",
    tagColor: "#fb923c"
  },
  "Leave": {
    category: "admin",
    icon: "⚙️",
    tag: "HR Quota Rules",
    gradient: "linear-gradient(90deg, #ec4899, #8b5cf6)",
    hoverBorder: "rgba(236, 72, 153, 0.5)",
    hoverShadow: "0 0 35px rgba(236, 72, 153, 0.25)",
    iconBg: "rgba(236, 72, 153, 0.15)",
    iconBorder: "rgba(236, 72, 153, 0.3)",
    tagColor: "#f472b6"
  },
  "Enrollment": {
    category: "admin",
    icon: "🔑",
    tag: "Credentials & Access",
    gradient: "linear-gradient(90deg, #6366f1, #a855f7)",
    hoverBorder: "rgba(99, 102, 241, 0.5)",
    hoverShadow: "0 0 35px rgba(99, 102, 241, 0.25)",
    iconBg: "rgba(99, 102, 241, 0.15)",
    iconBorder: "rgba(99, 102, 241, 0.3)",
    tagColor: "#818cf8"
  },
  "Workdays & Holidays": {
    category: "admin",
    icon: "🗓️",
    tag: "Schedule & Calendar",
    gradient: "linear-gradient(90deg, #10b981, #3b82f6)",
    hoverBorder: "rgba(16, 185, 129, 0.5)",
    hoverShadow: "0 0 35px rgba(16, 185, 129, 0.25)",
    iconBg: "rgba(16, 185, 129, 0.15)",
    iconBorder: "rgba(16, 185, 129, 0.3)",
    tagColor: "#34d399"
  },
  "Reports": {
    category: "admin",
    icon: "📊",
    tag: "Payroll Export",
    gradient: "linear-gradient(90deg, #64748b, #94a3b8)",
    hoverBorder: "rgba(148, 163, 184, 0.5)",
    hoverShadow: "0 0 35px rgba(148, 163, 184, 0.25)",
    iconBg: "rgba(148, 163, 184, 0.15)",
    iconBorder: "rgba(148, 163, 184, 0.3)",
    tagColor: "#cbd5e1"
  }
};

export function HeroSearch({
  allowedModules,
  pendingApprovalsCount,
  unreadAnnouncementsCount
}: {
  allowedModules: { name: string; permission: string; description: string; href?: string }[];
  pendingApprovalsCount: number;
  unreadAnnouncementsCount: number;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<"all" | "attendance" | "team" | "career" | "admin">("all");

  const styledModules = useMemo(() => {
    return allowedModules.map((mod) => {
      const style = MODULE_STYLING[mod.name] || {
        category: "admin",
        icon: "⚡",
        tag: "Module",
        gradient: "linear-gradient(90deg, #8b5cf6, #ec4899)",
        hoverBorder: "rgba(139, 92, 246, 0.5)",
        hoverShadow: "0 0 35px rgba(139, 92, 246, 0.25)",
        iconBg: "rgba(139, 92, 246, 0.15)",
        iconBorder: "rgba(139, 92, 246, 0.3)",
        tagColor: "#c084fc"
      };
      return { ...mod, ...style };
    });
  }, [allowedModules]);

  const filteredModules = useMemo(() => {
    return styledModules.filter((mod) => {
      const matchesSearch =
        mod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mod.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mod.tag.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = activeCategory === "all" || mod.category === activeCategory;

      return matchesSearch && matchesCategory;
    });
  }, [styledModules, searchQuery, activeCategory]);

  return (
    <div>
      {/* Search Input Dock */}
      <div className="mymind-search-wrapper">
        <div className="mymind-search-box">
          <span style={{ fontSize: "1.2rem", color: "#a855f7", display: "flex", alignItems: "center" }}>
            {"🔍"}
          </span>
          <input
            type="text"
            className="mymind-search-input"
            placeholder="Search modules, attendance logs, leave balances, jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              style={{
                background: "rgba(255, 255, 255, 0.1)",
                border: "none",
                color: "#94a3b8",
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.75rem"
              }}
            >
              {"✕"}
            </button>
          )}
        </div>
      </div>

      {/* Category Filter Bar */}
      <div className="mymind-category-bar">
        <button
          type="button"
          className={`mymind-chip ${activeCategory === "all" ? "active" : ""}`}
          onClick={() => setActiveCategory("all")}
        >
          <span>{"✨ All Modules"}</span>
          <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>({allowedModules.length})</span>
        </button>
        <button
          type="button"
          className={`mymind-chip ${activeCategory === "attendance" ? "active" : ""}`}
          onClick={() => setActiveCategory("attendance")}
        >
          <span>{"⏱️ Attendance & Leave"}</span>
        </button>
        <button
          type="button"
          className={`mymind-chip ${activeCategory === "team" ? "active" : ""}`}
          onClick={() => setActiveCategory("team")}
        >
          <span>{"👥 Team & HR"}</span>
        </button>
        <button
          type="button"
          className={`mymind-chip ${activeCategory === "career" ? "active" : ""}`}
          onClick={() => setActiveCategory("career")}
        >
          <span>{"💼 Jobs & Notices"}</span>
        </button>
        <button
          type="button"
          className={`mymind-chip ${activeCategory === "admin" ? "active" : ""}`}
          onClick={() => setActiveCategory("admin")}
        >
          <span>{"⚙️ Setup & Admin"}</span>
        </button>
      </div>

      {/* Grid of Visual Module Cards */}
      <div className="mymind-grid">
        {filteredModules.length === 0 ? (
          <div
            style={{
              gridColumn: "1 / -1",
              textAlign: "center",
              padding: "48px",
              background: "rgba(255, 255, 255, 0.02)",
              borderRadius: "24px",
              border: "1px dashed rgba(255, 255, 255, 0.1)"
            }}
          >
            <p style={{ fontSize: "1.2rem", color: "#94a3b8", margin: 0 }}>
              No matching modules found for "{searchQuery}"
            </p>
          </div>
        ) : (
          filteredModules.map((module) => {
            const isApprovals = module.name === "Approvals";
            const isAnnouncements = module.name === "Announcements";

            const cardInner = (
              <div
                className="mymind-card"
                style={
                  {
                    "--card-accent-gradient": module.gradient,
                    "--card-hover-border": module.hoverBorder,
                    "--card-hover-shadow": module.hoverShadow,
                    "--icon-bg": module.iconBg,
                    "--icon-border": module.iconBorder,
                    "--tag-color": module.tagColor
                  } as React.CSSProperties
                }
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start"
                    }}
                  >
                    <div className="mymind-card-icon-box">{module.icon}</div>
                    {isApprovals && pendingApprovalsCount > 0 && (
                      <span
                        style={{
                          background: "rgba(251, 191, 36, 0.2)",
                          color: "#fbbf24",
                          border: "1px solid rgba(251, 191, 36, 0.4)",
                          padding: "4px 12px",
                          borderRadius: "12px",
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          boxShadow: "0 0 16px rgba(251, 191, 36, 0.2)"
                        }}
                      >
                        ⚡ {pendingApprovalsCount} Pending
                      </span>
                    )}
                    {isAnnouncements && unreadAnnouncementsCount > 0 && (
                      <span
                        style={{
                          background: "rgba(96, 165, 250, 0.2)",
                          color: "#60a5fa",
                          border: "1px solid rgba(96, 165, 250, 0.4)",
                          padding: "4px 12px",
                          borderRadius: "12px",
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          boxShadow: "0 0 16px rgba(96, 165, 250, 0.2)"
                        }}
                      >
                        📢 {unreadAnnouncementsCount} New
                      </span>
                    )}
                  </div>
                  <h3 className="mymind-card-title">{module.name}</h3>
                  <p className="mymind-card-desc">{module.description}</p>
                </div>

                <div className="mymind-card-footer">
                  <span className="mymind-card-tag">{module.tag}</span>
                  <span className="mymind-card-arrow">{"→"}</span>
                </div>
              </div>
            );

            if (module.href) {
              return (
                <Link key={module.name} href={(module.href as Route)} style={{ textDecoration: "none" }}>
                  {cardInner}
                </Link>
              );
            }

            return <div key={module.name}>{cardInner}</div>;
          })
        )}
      </div>
    </div>
  );
}
