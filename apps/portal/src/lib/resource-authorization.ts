import { createPrismaClient } from "@attendance/db";
import { currentReportingLineWhere } from "./employment";
import type { SessionUser } from "./session";

const db = createPrismaClient(process.env.DATABASE_URL as string);

/**
 * Resource-scoped authorization checks.
 *
 * These exist because role checks alone ("is this user a manager?") are not enough to authorize
 * an approval/rejection mutation — the caller must also own the specific target resource, i.e. the
 * request's employee must actually report to them. The listing queries in
 * `employee-leave-requests/queries.ts` and `employee-attendance-correction-requests/queries.ts`
 * already scope reads this way; these helpers give mutations the same scoping so a manager cannot
 * approve/reject a request belonging to another manager's report by supplying its ID directly.
 *
 * Call this AFTER role/permission checks and self-approval/HR-escalation rules, as an additional
 * gate — it does not replace those checks.
 */
export async function isDirectReportOf(
  managerEmployeeId: string,
  employeeId: string
): Promise<boolean> {
  const line = await db.reportingLine.findFirst({
    where: {
      subordinateEmploymentId: employeeId,
      supervisorEmploymentId: managerEmployeeId,
      ...currentReportingLineWhere()
    }
  });
  return line !== null;
}

/**
 * Stage-1 ("manager") approval/rejection authorization for attendance-correction and leave
 * requests. Owner/admin/HR/anyone with the `approvals` or `company_attendance` permission is
 * assumed authorized by role (existing behavior, unchanged). A plain "manager" role additionally
 * requires that the target employee actually reports to them.
 */
export async function canManagerActOnEmployeeRequest(
  user: SessionUser,
  employeeId: string
): Promise<boolean> {
  const userRole = user.roleName?.toLowerCase() ?? "";

  if (userRole === "manager" || userRole === "supervisor" || userRole === "team_lead") {
    return isDirectReportOf(user.employeeId, employeeId);
  }

  // Non-manager roles (owner/admin/hr/permission-based approvers) are gated by the existing
  // role/permission checks at the call site — this helper only adds the missing manager-scope
  // check, it doesn't re-decide access for roles that were already correctly authorized by role.
  return true;
}
