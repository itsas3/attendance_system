import { createPrismaClient } from "@attendance/db";
import {
  currentReportingLineWhere,
  employmentAccessInclude,
  getEmploymentEmail,
  getEmploymentName,
  getEmploymentRoleKey
} from "../../../lib/employment";
import type { SessionUser } from "../../../lib/session";
import type { EmployeeAttendanceCorrectionRequest } from "./types";

const db = createPrismaClient(process.env.DATABASE_URL as string);

export async function getEmployeeAttendanceCorrectionRequests(
  user: SessionUser
): Promise<EmployeeAttendanceCorrectionRequest[]> {
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

  const requests = await db.manualAttendanceRequest.findMany({
    where,
    include: { employee: { include: employmentAccessInclude() } },
    orderBy: { createdAt: "desc" }
  });

  return requests.map((request) => ({
    id: request.id,
    employeeId: request.employeeId,
    type: request.type,
    requestedTimestamp: request.requestedTimestamp,
    reason: request.reason,
    status: request.status,
    employee: {
      fullName: getEmploymentName(request.employee),
      email: getEmploymentEmail(request.employee),
      role: { name: getEmploymentRoleKey(request.employee) }
    }
  }));
}
