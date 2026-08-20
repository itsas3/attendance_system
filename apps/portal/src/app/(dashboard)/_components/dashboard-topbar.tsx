"use client";

import { usePathname } from "next/navigation";
import type { DashboardModule } from "../_lib/dashboard-modules";
import { getPageTitle } from "../_lib/dashboard-navigation";
import { UserAccountMenu } from "./user-account-menu";

type DashboardTopbarProps = {
  fullName: string;
  modules: DashboardModule[];
  onOpenSidebar: () => void;
  roleName: string;
  sidebarOpen: boolean;
};

export function DashboardTopbar({
  fullName,
  modules,
  onOpenSidebar,
  roleName,
  sidebarOpen
}: DashboardTopbarProps) {
  const pathname = usePathname();

  return (
    <header className="dashboard-topbar">
      <div className="dashboard-topbar-title">
        <button
          aria-controls="dashboard-navigation"
          aria-expanded={sidebarOpen}
          aria-label="Open navigation"
          className="sidebar-menu-button"
          onClick={onOpenSidebar}
          type="button"
        >
          <span />
          <span />
          <span />
        </button>
        <div>
          <span className="dashboard-topbar-eyebrow">Workforce Portal</span>
          <h1>{getPageTitle(pathname, modules)}</h1>
        </div>
      </div>

      <div className="dashboard-account">
        <UserAccountMenu fullName={fullName} roleName={roleName} />
      </div>
    </header>
  );
}
