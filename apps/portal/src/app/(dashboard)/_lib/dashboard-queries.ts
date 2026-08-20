import { createPrismaClient } from "@attendance/db";
import { currentReportingLineWhere } from "../../../lib/employment";
import { hasPermission } from "../../../lib/rbac";
import type { SessionUser } from "../../../lib/session";

const db = createPrismaClient(process.env.DATABASE_URL as string);

export async function getDashboardCounts(user: SessionUser) {
  const role = user.roleName.toLowerCase();
  const managerWhere = {
    employee: {
      organizationId: user.organizationId,
      subordinateLines: {
        some: {
          supervisorEmploymentId: user.employeeId,
          ...currentReportingLineWhere()
        }
      }
    },
    employeeId: { not: user.employeeId }
  };
  const pendingWhere =
    role === "manager"
      ? { status: "PENDING_MANAGER" as const, ...managerWhere }
      : {
          status: { in: ["PENDING_MANAGER" as const, "PENDING_HR" as const] },
          employee: { organizationId: user.organizationId }
        };

  const [pendingAttendance, pendingLeave, employee] = await Promise.all([
    hasPermission(user, "approvals")
      ? db.manualAttendanceRequest.count({ where: pendingWhere })
      : 0,
    hasPermission(user, "approvals") ? db.leaveRequest.count({ where: pendingWhere }) : 0,
    db.employment.findUnique({
      where: { id: user.employeeId },
      select: { lastAnnouncementsViewedAt: true }
    })
  ]);
  const unreadAnnouncements = await db.announcement.count({
    where: {
      organizationId: user.organizationId,
      createdAt: { gt: employee?.lastAnnouncementsViewedAt ?? new Date(0) }
    }
  });

  return { pendingAttendance, pendingLeave, unreadAnnouncements };
}
