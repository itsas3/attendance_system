import { getCurrentUser } from "../lib/session";
import { hasPermission, type Permission } from "../lib/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";
import { logout } from "./login/actions";
import { createPrismaClient } from "@attendance/db";
import type { Route } from "next";
import { HeroSearch } from "./hero-search";
import { ThemeToggle } from "./theme-toggle";

export const dynamic = "force-dynamic";

// Force Next.js server cache re-evaluation for Prisma Client models
const db = createPrismaClient(process.env.DATABASE_URL as string);

const allModules: { name: string; permission: Permission; description: string; href?: string }[] = [
  {
    name: "My attendance",
    permission: "my_attendance",
    description: "View and manage your daily check-in/check-out timestamps and shift logs.",
    href: "/my-attendance"
  },
  {
    name: "Apply for Leave",
    permission: "my_attendance",
    description: "Submit time-off applications, track leave quotas, and view approval workflow status.",
    href: "/leave-requests"
  },
  {
    name: "Leave",
    permission: "reports",
    description: "Configure HR leave categories, quotas, and annual accrual rules.",
    href: "/leave-settings"
  },
  {
    name: "List all employees",
    permission: "enrollment",
    description: "Browse the complete directory of registered staff members and official details.",
    href: "/employees"
  },
  {
    name: "Team attendance",
    permission: "team_attendance",
    description: "Monitor real-time attendance logs and status of your entire team.",
    href: "/team-attendance"
  },
  {
    name: "My Team",
    permission: "my_team",
    description: "View direct reports, manage employee notes, and perform evaluations.",
    href: "/my-team"
  },
  {
    name: "Performance Tracking & Analysis",
    permission: "reports",
    description: "HR performance evaluation builder, manager scheduling, and organizational analytics.",
    href: "/performance"
  },
  {
    name: "Manual requests",
    permission: "manual_reports",
    description: "Submit manual requests for missing scans or punch corrections.",
    href: "/manual-requests"
  },
  {
    name: "Approvals",
    permission: "approvals",
    description: "Review and process pending leave and punch correction applications.",
    href: "/approvals"
  },
  {
    name: "Enrollment",
    permission: "enrollment",
    description: "Register new staff members and configure access credentials.",
    href: "/enrollment"
  },
  {
    name: "Reports",
    permission: "reports",
    description: "Generate detailed organization attendance reports for payroll and compliance."
  },
  {
    name: "Workdays & Holidays",
    permission: "reports",
    description: "Configure weekly off-days and manage official company holiday calendars.",
    href: "/holidays"
  },
  {
    name: "Company Attendance",
    permission: "company_attendance",
    description: "Executive organization-wide attendance metrics and live punch streams.",
    href: "/company-attendance"
  },
  {
    name: "Jobs",
    permission: "my_attendance",
    description: "Browse internal career postings, apply, or create new recruitment listings.",
    href: "/jobs"
  },
  {
    name: "Announcements",
    permission: "my_attendance",
    description: "Company-wide notices, policy updates, and HR bulletins.",
    href: "/announcements"
  }
];

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const roleName = user.roleName?.toLowerCase() || "";

  // Filter modules based on user role permissions & role fallback
  const allowedModules = allModules.filter((m) => {
    if (m.name === "Jobs" || m.name === "Announcements") {
      return true;
    }

    if (roleName === "owner") {
      // Company Owners cannot apply for leave, submit manual requests, or view personal attendance
      if (
        m.href === "/leave-requests" ||
        m.href === "/manual-requests" ||
        m.href === "/my-attendance"
      ) {
        return false;
      }
    }

    if (m.permission === "approvals") {
      return (
        hasPermission(user, "my_team") ||
        hasPermission(user, "company_attendance") ||
        hasPermission(user, "team_attendance") ||
        ["manager", "hr", "owner", "admin"].includes(roleName)
      );
    }

    return hasPermission(user, m.permission);
  });

  // Query live pending approvals count for users with approval privileges
  let pendingApprovalsCount = 0;
  const canApprove = hasPermission(user, "approvals");

  if (canApprove) {
    if (roleName === "manager") {
      const attCount = await db.manualAttendanceRequest.count({
        where: {
          status: "PENDING_MANAGER",
          employee: { supervisorId: user.employeeId },
          employeeId: { not: user.employeeId }
        }
      });
      const leaveCount = await db.leaveRequest.count({
        where: {
          status: "PENDING_MANAGER",
          employee: { supervisorId: user.employeeId },
          employeeId: { not: user.employeeId }
        }
      });
      pendingApprovalsCount = attCount + leaveCount;
    } else {
      const attCount = await db.manualAttendanceRequest.count({
        where: { status: { in: ["PENDING_MANAGER", "PENDING_HR"] } }
      });
      const leaveCount = await db.leaveRequest.count({
        where: { status: { in: ["PENDING_MANAGER", "PENDING_HR"] } }
      });
      pendingApprovalsCount = attCount + leaveCount;
    }
  }

  const currentEmployee = await db.employee.findUnique({
    where: { id: user.employeeId },
    select: { lastAnnouncementsViewedAt: true }
  });

  const unreadAnnouncementsCount = await db.announcement.count({
    where: { createdAt: { gt: currentEmployee?.lastAnnouncementsViewedAt ?? new Date(0) } }
  });

  return (
    <div className="hero-ambient-mesh">
      <main style={{ maxWidth: "1280px", margin: "0 auto", padding: "16px 24px 64px 24px" }}>
        {/* Glass Header Navigation */}
        <header className="mymind-header">
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #a855f7, #ec4899)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.2rem",
                boxShadow: "0 4px 16px rgba(168, 85, 247, 0.4)"
              }}
            >
              {"✦"}
            </div>
            <div>
              <span className="brand-title">
                Mindful Workspace
              </span>
              <div className="brand-subtitle">
                Attendance & Team Intelligence
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <ThemeToggle />

            <Link
              href={("/personal-records" as Route)}
              className="profile-pill-badge"
            >
              <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#10b981" }} />
              <span>{user.fullName}</span>
              <span className="role-tag">
                ({user.roleName})
              </span>
            </Link>

            <form action={logout}>
              <button type="submit" className="logout-btn">
                Sign Out
              </button>
            </form>
          </div>
        </header>

        {/* Relaxing Hero Banner */}
        <section className="hero-title-section">
          <div className="hero-pill-badge">
            <span style={{ color: "#a855f7" }}>{"✨"}</span>
            <span>Welcome back, {user.fullName}</span>
            <span style={{ color: "#38bdf8" }}>{"•"}</span>
            <span style={{ opacity: 0.8 }}>{user.roleName.toUpperCase()} Portal</span>
          </div>

          <h1 className="hero-title">
            Your mindful hub for <br />
            <span className="hero-title-gradient">time, attendance & growth.</span>
          </h1>

          <p className="hero-subtitle">
            Organize daily logs, review team approvals, track performance, and explore career opportunities in one beautiful, relaxing space.
          </p>
        </section>

        {/* Interactive Search & Colorful Grid */}
        <HeroSearch
          allowedModules={allowedModules}
          pendingApprovalsCount={pendingApprovalsCount}
          unreadAnnouncementsCount={unreadAnnouncementsCount}
        />
      </main>
    </div>
  );
}
