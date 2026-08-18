import { createPrismaClient } from "@attendance/db";
import type { Prisma } from "@attendance/db";
import type { CompanyAttendanceFilter } from "./types";
import { employmentIdentityInclude, getEmploymentName } from "../../../lib/employment";

const db = createPrismaClient(process.env.DATABASE_URL as string);

export async function getCompanyAttendanceData(
  organizationId: string,
  filter: CompanyAttendanceFilter
) {
  const scanWhere: Prisma.ScanEventWhereInput = { organizationId };

  if (filter.startRange) {
    scanWhere.serverReceivedAt = { gte: filter.startRange };
  }
  if (filter.selectedEmployeeId !== "all") {
    scanWhere.employeeId = filter.selectedEmployeeId;
  }

  const [activeEmployees, activeDevicesCount, periodScans] = await Promise.all([
    db.employment.findMany({
      where: { organizationId, status: "ACTIVE" },
      include: {
        ...employmentIdentityInclude,
        assignments: {
          where: { validUntil: null },
          take: 1,
          include: {
            position: { include: { defaultRoleMappings: { include: { role: true } } } }
          }
        }
      },
      orderBy: { employeeCode: "asc" }
    }),
    db.device.count({ where: { organizationId, status: "ACTIVE" } }),
    db.scanEvent.findMany({
      where: scanWhere,
      include: { employee: { include: employmentIdentityInclude }, device: true },
      orderBy: { serverReceivedAt: "desc" }
    })
  ]);

  return {
    activeEmployees: activeEmployees.map((employee) => ({
      id: employee.id,
      fullName: getEmploymentName(employee),
      roleName: employee.assignments[0]?.position.defaultRoleMappings[0]?.role.name ?? "Employee"
    })),
    activeDevicesCount,
    periodScans: periodScans.map((scan) => ({
      ...scan,
      employee: scan.employee ? { fullName: getEmploymentName(scan.employee) } : null
    }))
  };
}
