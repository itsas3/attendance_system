"use client";

import { useState, type ReactNode } from "react";
import type { DashboardModule } from "../_lib/dashboard-modules";
import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardTopbar } from "./dashboard-topbar";

type DashboardShellProps = {
  children: ReactNode;
  fullName: string;
  modules: DashboardModule[];
  roleName: string;
};

export function DashboardShell({ children, fullName, modules, roleName }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="dashboard-layout">
      <DashboardSidebar
        modules={modules}
        onNavigate={() => setSidebarOpen(false)}
        open={sidebarOpen}
      />
      {sidebarOpen && (
        <button
          aria-label="Close navigation"
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          type="button"
        />
      )}
      <div className="dashboard-main">
        <DashboardTopbar
          fullName={fullName}
          modules={modules}
          onOpenSidebar={() => setSidebarOpen(true)}
          roleName={roleName}
          sidebarOpen={sidebarOpen}
        />
        <div className="dashboard-content">{children}</div>
      </div>
    </div>
  );
}
