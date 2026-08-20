import { createPrismaClient } from "@attendance/db";
import {
  currentReportingLineWhere,
  employmentAccessInclude,
  getEmploymentEmail,
  getEmploymentName,
  getEmploymentRoleKey
} from "../../../lib/employment";
import type { SessionUser } from "../../../lib/session";
import type { EmployeeLeaveRequest } from "./types";

const db = createPrismaClient(process.env.DATABASE_URL as string);

export async function getEmployeeLeaveRequests(user: SessionUser): Promise<EmployeeLeaveRequest[]> {
  const where =
    user.roleName === "manager"
      ? {
          employee: {
            subordinateLines: {
              some: {
                supervisorEmploymentId: user.employeeId,
                ...currentReportingLineWhere()
              }
            }
          },
          employeeId: { not: user.employeeId }
        }
      : { employee: { organizationId: user.organizationId } };

  const requests = await db.leaveRequest.findMany({
    where,
    include: { employee: { include: employmentAccessInclude() }, leaveType: true },
    orderBy: { createdAt: "desc" }
  });

  return requests.map((request) => ({
    id: request.id,
    employeeId: request.employeeId,
    startDate: request.startDate,
    endDate: request.endDate,
    totalDays: request.totalDays,
    paidDays: request.paidDays,
    unpaidDays: request.unpaidDays,
    reason: request.reason,
    status: request.status,
    employee: {
      fullName: getEmploymentName(request.employee),
      email: getEmploymentEmail(request.employee),
      role: { name: getEmploymentRoleKey(request.employee) }
    },
    leaveType: { name: request.leaveType.name, isPaid: request.leaveType.isPaid }
  }));
}
