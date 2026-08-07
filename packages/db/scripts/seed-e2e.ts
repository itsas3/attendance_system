import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the E2E database.");
}

const parsedDatabaseUrl = new URL(databaseUrl);
const isLocalDatabase = ["127.0.0.1", "localhost"].includes(parsedDatabaseUrl.hostname);

if (
  process.env.NODE_ENV !== "test" ||
  !isLocalDatabase ||
  parsedDatabaseUrl.pathname !== "/attendance_e2e"
) {
  throw new Error("The E2E seed may only run against the attendance_e2e database in test mode.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl })
});

const rolePermissions = {
  employee: ["my_attendance", "manual_reports"],
  manager: ["my_attendance", "manual_reports", "team_attendance", "approvals"],
  hr: [
    "my_attendance",
    "manual_reports",
    "enrollment",
    "reports",
    "company_attendance",
    "approvals"
  ],
  owner: [
    "my_attendance",
    "manual_reports",
    "enrollment",
    "reports",
    "company_attendance",
    "approvals"
  ]
} as const;

async function main() {
  const passwordHash = hashSync("password123", 10);

  await prisma.$transaction(async (tx) => {
    const permissionNames = [...new Set(Object.values(rolePermissions).flat())];
    const permissions = new Map<string, string>();

    for (const name of permissionNames) {
      const permission = await tx.permission.create({ data: { name } });
      permissions.set(name, permission.id);
    }

    const roles = new Map<string, string>();
    for (const [name, assignedPermissions] of Object.entries(rolePermissions)) {
      const role = await tx.role.create({ data: { name } });
      roles.set(name, role.id);
      await tx.rolePermission.createMany({
        data: assignedPermissions.map((permissionName) => ({
          roleId: role.id,
          permissionId: permissions.get(permissionName)!
        }))
      });
    }

    const owner = await tx.employee.create({
      data: {
        email: "owner@e2e.test",
        fullName: "E2E Owner",
        passwordHash,
        roleId: roles.get("owner")!
      }
    });
    const manager = await tx.employee.create({
      data: {
        email: "manager@e2e.test",
        fullName: "E2E Manager",
        supervisorId: owner.id,
        passwordHash,
        roleId: roles.get("manager")!
      }
    });
    const hr = await tx.employee.create({
      data: {
        email: "hr@e2e.test",
        fullName: "E2E HR",
        supervisorId: owner.id,
        passwordHash,
        roleId: roles.get("hr")!
      }
    });
    const employee = await tx.employee.create({
      data: {
        email: "employee@e2e.test",
        fullName: "E2E Employee",
        supervisorId: manager.id,
        passwordHash,
        roleId: roles.get("employee")!
      }
    });

    const annualLeave = await tx.leaveTypeConfig.create({
      data: {
        code: "E2E_ANNUAL",
        name: "E2E Annual Leave",
        defaultAllocation: 10
      }
    });

    await tx.manualAttendanceRequest.createMany({
      data: [
        {
          employeeId: employee.id,
          createdByEmployeeId: employee.id,
          type: "ADD_SCAN",
          reason: "Manager-visible E2E request",
          requestedTimestamp: new Date("2026-01-12T09:00:00.000Z"),
          status: "PENDING_MANAGER"
        },
        {
          employeeId: hr.id,
          createdByEmployeeId: hr.id,
          type: "ADD_SCAN",
          reason: "Organization-visible E2E request",
          requestedTimestamp: new Date("2026-01-13T09:00:00.000Z"),
          status: "PENDING_HR"
        }
      ]
    });

    await tx.leaveRequest.createMany({
      data: [
        {
          employeeId: employee.id,
          leaveTypeId: annualLeave.id,
          startDate: new Date("2026-02-02T00:00:00.000Z"),
          endDate: new Date("2026-02-02T00:00:00.000Z"),
          totalDays: 1,
          reason: "Manager-visible E2E leave",
          status: "PENDING_MANAGER"
        },
        {
          employeeId: manager.id,
          leaveTypeId: annualLeave.id,
          startDate: new Date("2026-02-03T00:00:00.000Z"),
          endDate: new Date("2026-02-03T00:00:00.000Z"),
          totalDays: 1,
          reason: "Organization-visible E2E leave",
          status: "PENDING_HR"
        }
      ]
    });
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
