import { getCurrentUser } from "../../lib/session";
import { hasPermission, getPendingHRStatusText } from "../../lib/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createPrismaClient } from "@attendance/db";
import type { Prisma } from "@attendance/db";
import { logout } from "../login/actions";
import { ApprovalActionsClient } from "./approval-actions-client";
import { LeaveApprovalActionsClient } from "./leave-approval-actions-client";

export const dynamic = "force-dynamic";

const db = createPrismaClient(process.env.DATABASE_URL as string);

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  }).format(date);
}

export default async function ApprovalsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const isAuthorized = hasPermission(user, "approvals");

  if (!isAuthorized) {
    return (
      <main className="app-shell">
        <header className="topbar">
          <div>
            <Link href="/" className="back-link">
              ← Back to Dashboard
            </Link>
            <h1 style={{ color: "#ef4444", background: "none" }}>403 Access Restricted</h1>
          </div>
          <form action={logout}>
            <button type="submit" className="logout-btn">
              Sign Out
            </button>
          </form>
        </header>

        <div
          className="panel"
          style={{ cursor: "default", borderLeft: "4px solid #ef4444", padding: "24px" }}
        >
          <h2>Approver Privilege Required</h2>
          <p className="muted" style={{ marginTop: "8px" }}>
            The Approvals portal is restricted to Managers, HR, and Company Owners.
          </p>
        </div>
      </main>
    );
  }

  // 1. Where clause for Manual Attendance Requests
  let attWhereClause: Prisma.ManualAttendanceRequestWhereInput = {};
  if (user.roleName === "manager") {
    attWhereClause = {
      employee: { supervisorId: user.employeeId },
      employeeId: { not: user.employeeId }
    };
  } else if (user.roleName === "hr" || user.roleName === "owner" || user.roleName === "admin") {
    attWhereClause = {};
  }

  const attendanceRequests = await db.manualAttendanceRequest.findMany({
    where: attWhereClause,
    include: {
      employee: { include: { role: true, supervisor: true } },
      createdBy: { include: { role: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  // 2. Where clause for Leave Requests
  let leaveWhereClause: Prisma.LeaveRequestWhereInput = {};
  if (user.roleName === "manager") {
    leaveWhereClause = {
      employee: { supervisorId: user.employeeId },
      employeeId: { not: user.employeeId }
    };
  } else if (user.roleName === "hr" || user.roleName === "owner" || user.roleName === "admin") {
    leaveWhereClause = {};
  }

  const leaveRequests = await db.leaveRequest.findMany({
    where: leaveWhereClause,
    include: {
      employee: { include: { role: true, supervisor: true } },
      leaveType: true
    },
    orderBy: { createdAt: "desc" }
  });

  const pendingAttendanceCount = attendanceRequests.filter(
    (r) => r.status === "PENDING_MANAGER" || r.status === "PENDING_HR"
  ).length;
  const pendingLeaveCount = leaveRequests.filter(
    (r) => r.status === "PENDING_MANAGER" || r.status === "PENDING_HR"
  ).length;
  const totalApprovedCount =
    attendanceRequests.filter((r) => r.status === "APPROVED").length +
    leaveRequests.filter((r) => r.status === "APPROVED").length;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }}>
            <Link href="/" className="back-link">
              ← Dashboard
            </Link>
          </div>
          <h1>Approval Management Portal</h1>
          <p className="muted">
            Reviewing requests assigned to <strong>{user.fullName}</strong> ({user.roleName})
          </p>
        </div>
        <form action={logout}>
          <button type="submit" className="logout-btn">
            Sign Out
          </button>
        </form>
      </header>

      {/* KPI Overview Grid */}
      <section
        className="panel-grid"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}
      >
        <article className="panel" style={{ cursor: "default", padding: "20px 24px" }}>
          <p
            className="muted"
            style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em" }}
          >
            Pending Punch Requests
          </p>
          <h2 style={{ fontSize: "2.2rem", margin: "8px 0 0 0", color: "#fbbf24" }}>
            {pendingAttendanceCount}
          </h2>
        </article>

        <article className="panel" style={{ cursor: "default", padding: "20px 24px" }}>
          <p
            className="muted"
            style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em" }}
          >
            Pending Leave Requests
          </p>
          <h2 style={{ fontSize: "2.2rem", margin: "8px 0 0 0", color: "#c084fc" }}>
            {pendingLeaveCount}
          </h2>
        </article>

        <article className="panel" style={{ cursor: "default", padding: "20px 24px" }}>
          <p
            className="muted"
            style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em" }}
          >
            Total Approved History
          </p>
          <h2 style={{ fontSize: "2.2rem", margin: "8px 0 0 0", color: "#4ade80" }}>
            {totalApprovedCount}
          </h2>
        </article>
      </section>

      {/* Section 1: Leave Requests Queue */}
      <section className="panel" style={{ cursor: "default", display: "block" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px"
          }}
        >
          <div>
            <h2>🌴 Leave Applications Queue ({leaveRequests.length})</h2>
            <p className="muted">
              Review and approve time-off applications submitted by team members.
            </p>
          </div>
        </div>

        {leaveRequests.length === 0 ? (
          <p className="muted">No leave requests found for your approval queue.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--border)",
                    color: "var(--muted)",
                    fontSize: "0.85rem",
                    textTransform: "uppercase"
                  }}
                >
                  <th style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>Employee</th>
                  <th style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>Leave Category</th>
                  <th style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                    Date Range & Working Days
                  </th>
                  <th style={{ padding: "12px 16px" }}>Reason</th>
                  <th style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>Approval Stage</th>
                  <th style={{ padding: "12px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {leaveRequests.map((req) => (
                  <tr key={req.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={{ padding: "14px 16px" }}>
                      <strong>{req.employee.fullName}</strong>
                      <div className="muted" style={{ fontSize: "0.85rem" }}>
                        {req.employee.email} ({req.employee.role?.name || "employee"})
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                      <strong style={{ color: "#60a5fa" }}>{req.leaveType.name}</strong>
                      <div className="muted" style={{ fontSize: "0.8rem" }}>
                        {req.leaveType.isPaid ? "Paid Leave" : "Unpaid (LOP)"}
                      </div>
                    </td>

                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ fontWeight: 600, color: "#60a5fa", whiteSpace: "nowrap" }}>
                        {formatDate(new Date(req.startDate))} – {formatDate(new Date(req.endDate))}
                      </span>
                      <div className="muted" style={{ fontSize: "0.8rem" }}>
                        Total: <strong>{req.totalDays} working day(s)</strong>
                      </div>
                      {(req.unpaidDays ?? 0) > 0 && (
                        <div
                          style={{
                            color: "#fbbf24",
                            fontSize: "0.75rem",
                            marginTop: "4px",
                            fontWeight: 600
                          }}
                        >
                          ⚠️ Breakdown: {req.paidDays} Paid + {req.unpaidDays} Unpaid (LOP)
                        </div>
                      )}
                    </td>

                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ fontSize: "0.9rem" }}>{req.reason}</span>
                    </td>

                    <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                      {req.status === "PENDING_MANAGER" && (
                        <span
                          style={{
                            background: "rgba(251, 191, 36, 0.15)",
                            color: "#fbbf24",
                            border: "1px solid rgba(251, 191, 36, 0.3)",
                            padding: "6px 12px",
                            borderRadius: "12px",
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                            display: "inline-block"
                          }}
                        >
                          Stage 1: Awaiting Manager
                        </span>
                      )}
                      {req.status === "PENDING_HR" && (
                        <span
                          style={{
                            background: "rgba(192, 132, 252, 0.15)",
                            color: "#c084fc",
                            border: "1px solid rgba(192, 132, 252, 0.3)",
                            padding: "6px 12px",
                            borderRadius: "12px",
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                            display: "inline-block"
                          }}
                        >
                          {getPendingHRStatusText(user.roleName, req.employee.role?.name, true)}
                        </span>
                      )}
                      {req.status === "APPROVED" && (
                        <span
                          style={{
                            background: "rgba(74, 222, 128, 0.15)",
                            color: "#4ade80",
                            border: "1px solid rgba(74, 222, 128, 0.3)",
                            padding: "6px 12px",
                            borderRadius: "12px",
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                            display: "inline-block"
                          }}
                        >
                          Approved
                        </span>
                      )}
                      {req.status === "REJECTED" && (
                        <span
                          style={{
                            background: "rgba(248, 113, 113, 0.15)",
                            color: "#f87171",
                            border: "1px solid rgba(248, 113, 113, 0.3)",
                            padding: "6px 12px",
                            borderRadius: "12px",
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                            display: "inline-block"
                          }}
                        >
                          Rejected
                        </span>
                      )}
                    </td>

                    <td style={{ padding: "14px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <LeaveApprovalActionsClient
                        requestId={req.id}
                        status={req.status}
                        isSelfRequest={req.employeeId === user.employeeId}
                        hasExcessUnpaid={(req.unpaidDays ?? 0) > 0}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Section 2: Attendance Manual Scan Correction Requests Queue */}
      <section className="panel" style={{ cursor: "default", display: "block" }}>
        <h2>⏱️ Manual Attendance Correction Requests ({attendanceRequests.length})</h2>
        <p className="muted" style={{ marginBottom: "20px" }}>
          Review and approve manual check-in/check-out scan additions or deletions.
        </p>

        {attendanceRequests.length === 0 ? (
          <p className="muted">No pending or completed manual attendance requests found.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--border)",
                    color: "var(--muted)",
                    fontSize: "0.85rem",
                    textTransform: "uppercase"
                  }}
                >
                  <th style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>Employee</th>
                  <th style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>Punch Details</th>
                  <th style={{ padding: "12px 16px" }}>Reason</th>
                  <th style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>Approval Stage</th>
                  <th style={{ padding: "12px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {attendanceRequests.map((req) => (
                  <tr key={req.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={{ padding: "14px 16px" }}>
                      <strong>{req.employee.fullName}</strong>
                      <div className="muted" style={{ fontSize: "0.85rem" }}>
                        {req.employee.email} ({req.employee.role?.name || "employee"})
                      </div>
                    </td>

                    <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                      <span style={{ fontWeight: 600, color: "#60a5fa" }}>
                        {req.requestedTimestamp
                          ? formatDateTime(new Date(req.requestedTimestamp))
                          : "N/A"}
                      </span>
                      <div className="muted" style={{ fontSize: "0.8rem" }}>
                        Type: {req.type}
                      </div>
                    </td>

                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ fontSize: "0.9rem" }}>{req.reason}</span>
                    </td>

                    <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                      {req.status === "PENDING_MANAGER" && (
                        <span
                          style={{
                            background: "rgba(251, 191, 36, 0.15)",
                            color: "#fbbf24",
                            border: "1px solid rgba(251, 191, 36, 0.3)",
                            padding: "6px 12px",
                            borderRadius: "12px",
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                            display: "inline-block"
                          }}
                        >
                          Stage 1: Awaiting Manager
                        </span>
                      )}
                      {req.status === "PENDING_HR" && (
                        <span
                          style={{
                            background: "rgba(192, 132, 252, 0.15)",
                            color: "#c084fc",
                            border: "1px solid rgba(192, 132, 252, 0.3)",
                            padding: "6px 12px",
                            borderRadius: "12px",
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                            display: "inline-block"
                          }}
                        >
                          {getPendingHRStatusText(user.roleName, req.employee.role?.name)}
                        </span>
                      )}
                      {req.status === "APPROVED" && (
                        <span
                          style={{
                            background: "rgba(74, 222, 128, 0.15)",
                            color: "#4ade80",
                            border: "1px solid rgba(74, 222, 128, 0.3)",
                            padding: "6px 12px",
                            borderRadius: "12px",
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                            display: "inline-block"
                          }}
                        >
                          Approved
                        </span>
                      )}
                      {req.status === "REJECTED" && (
                        <span
                          style={{
                            background: "rgba(248, 113, 113, 0.15)",
                            color: "#f87171",
                            border: "1px solid rgba(248, 113, 113, 0.3)",
                            padding: "6px 12px",
                            borderRadius: "12px",
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                            display: "inline-block"
                          }}
                        >
                          Rejected
                        </span>
                      )}
                    </td>

                    <td style={{ padding: "14px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <ApprovalActionsClient
                        requestId={req.id}
                        status={req.status}
                        isSelfRequest={req.employeeId === user.employeeId}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
