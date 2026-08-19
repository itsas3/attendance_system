import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@prisma/client";
import { hashSync } from "bcryptjs";

const e2eRolePermissions = {
  employee: ["my_attendance", "manual_reports"],
  manager: ["my_attendance", "manual_reports", "team_attendance", "approvals", "my_team"],
  hr: [
    "my_attendance",
    "manual_reports",
    "enrollment",
    "reports",
    "company_attendance",
    "approvals",
    "my_team",
    "jobs_manage",
    "announcements_manage"
  ],
  owner: [
    "my_attendance",
    "manual_reports",
    "enrollment",
    "reports",
    "company_attendance",
    "approvals",
    "my_team",
    "jobs_manage",
    "announcements_manage"
  ]
} as const;

const e2eEffectiveDate = new Date("2026-01-01T00:00:00.000Z");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required to seed the E2E database.");

const parsedDatabaseUrl = new URL(databaseUrl);
const isLocalDatabase = ["127.0.0.1", "localhost"].includes(parsedDatabaseUrl.hostname);
if (
  process.env.NODE_ENV !== "test" ||
  !isLocalDatabase ||
  parsedDatabaseUrl.pathname !== "/attendance_e2e"
) {
  throw new Error("The E2E seed may only run against the attendance_e2e database in test mode.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

async function seedE2eAccessFoundation(tx: Prisma.TransactionClient, slug: string, name: string) {
  const organization = await tx.organization.create({
    data: { name, slug, timezone: "Asia/Karachi" }
  });

  const permissionKeys = [...new Set(Object.values(e2eRolePermissions).flat())];
  const permissions = new Map<string, string>();
  for (const key of permissionKeys) {
    const permission = await tx.permission.upsert({
      where: { key },
      create: { key, name: titleCase(key), category: key.split("_")[0] ?? "general" },
      update: {}
    });
    permissions.set(key, permission.id);
  }

  const roles = new Map<string, { id: string }>();
  for (const [key, assignedPermissions] of Object.entries(e2eRolePermissions)) {
    const role = await tx.role.create({
      data: {
        organizationId: organization.id,
        key,
        name: titleCase(key),
        isSystem: true
      }
    });
    roles.set(key, role);
    await tx.rolePermission.createMany({
      data: assignedPermissions.map((permissionKey) => ({
        roleId: role.id,
        permissionId: permissions.get(permissionKey)!
      }))
    });
  }

  const units = new Map<string, { id: string }>();
  for (const definition of [
    { code: "EXEC", name: "Executive" },
    { code: "HR", name: "Human Resources" },
    { code: "ENG", name: "Engineering" },
    { code: "OPS", name: "Operations" }
  ]) {
    const unit = await tx.organizationUnit.create({
      data: { ...definition, organizationId: organization.id, type: "DEPARTMENT" }
    });
    units.set(definition.code, unit);
  }

  const positions = new Map<string, { id: string }>();
  for (const definition of [
    { code: "OWNER", title: "Owner", roleKey: "owner", scope: "ORGANIZATION" as const },
    { code: "HR_OFFICER", title: "HR Officer", roleKey: "hr", scope: "ORGANIZATION" as const },
    {
      code: "MANAGER",
      title: "Manager",
      roleKey: "manager",
      scope: "ORGANIZATION_UNIT_TREE" as const
    },
    { code: "EMPLOYEE", title: "Employee", roleKey: "employee", scope: "SELF" as const }
  ]) {
    const position = await tx.position.create({
      data: { organizationId: organization.id, code: definition.code, title: definition.title }
    });
    positions.set(definition.code, position);
    await tx.positionRoleMapping.create({
      data: {
        positionId: position.id,
        roleId: roles.get(definition.roleKey)!.id,
        scope: definition.scope
      }
    });
  }

  return { organization, units, positions };
}

async function createE2eEmployment(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    legalName: string;
    loginEmail: string;
    passwordHash: string;
    employeeCode: string;
    unitId: string;
    positionId: string;
  }
) {
  const account = await tx.userAccount.create({
    data: {
      loginEmail: input.loginEmail,
      passwordHash: input.passwordHash,
      status: "ACTIVE",
      person: {
        create: { legalName: input.legalName, personalEmail: input.loginEmail }
      }
    }
  });
  const membership = await tx.organizationMembership.create({
    data: {
      organizationId: input.organizationId,
      personId: account.personId,
      status: "ACTIVE",
      joinedAt: e2eEffectiveDate
    }
  });
  const employment = await tx.employment.create({
    data: {
      organizationId: input.organizationId,
      membershipId: membership.id,
      employeeCode: input.employeeCode,
      status: "ACTIVE",
      hiredAt: e2eEffectiveDate,
      assignments: {
        create: {
          organizationUnitId: input.unitId,
          positionId: input.positionId,
          validFrom: e2eEffectiveDate,
          timezone: "Asia/Karachi"
        }
      }
    }
  });
  const shift = await tx.shift.create({
    data: {
      name: `${input.employeeCode} E2E shift`,
      timezone: "Asia/Karachi",
      startTime: "09:00",
      endTime: "17:00",
      workdays: [1, 2, 3, 4, 5]
    }
  });
  await tx.shiftAssignment.create({
    data: { employeeId: employment.id, shiftId: shift.id, effectiveFrom: e2eEffectiveDate }
  });

  return { account, employment };
}

function titleCase(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function main() {
  const passwordHash = hashSync("password123", 10);

  await prisma.$transaction(async (tx) => {
    // -------------------------------------------------------------
    // Organization 1: e2e ("E2E Organization")
    // -------------------------------------------------------------
    const access = await seedE2eAccessFoundation(tx, "e2e", "E2E Organization");
    const createEmployment = (input: {
      legalName: string;
      loginEmail: string;
      employeeCode: string;
      unitCode: string;
      positionCode: string;
    }) =>
      createE2eEmployment(tx, {
        organizationId: access.organization.id,
        legalName: input.legalName,
        loginEmail: input.loginEmail,
        passwordHash,
        employeeCode: input.employeeCode,
        unitId: access.units.get(input.unitCode)!.id,
        positionId: access.positions.get(input.positionCode)!.id
      });

    const owner = await createEmployment({
      legalName: "E2E Owner",
      loginEmail: "owner@e2e.test",
      employeeCode: "OWNER-001",
      unitCode: "EXEC",
      positionCode: "OWNER"
    });
    const manager = await createEmployment({
      legalName: "E2E Manager",
      loginEmail: "manager@e2e.test",
      employeeCode: "MGR-001",
      unitCode: "ENG",
      positionCode: "MANAGER"
    });
    const manager2 = await createEmployment({
      legalName: "E2E Manager 2",
      loginEmail: "manager-2@e2e.test",
      employeeCode: "MGR-002",
      unitCode: "OPS",
      positionCode: "MANAGER"
    });
    const hr = await createEmployment({
      legalName: "E2E HR",
      loginEmail: "hr@e2e.test",
      employeeCode: "HR-001",
      unitCode: "HR",
      positionCode: "HR_OFFICER"
    });
    const employee = await createEmployment({
      legalName: "E2E Employee",
      loginEmail: "employee@e2e.test",
      employeeCode: "EMP-001",
      unitCode: "ENG",
      positionCode: "EMPLOYEE"
    });
    const employee2 = await createEmployment({
      legalName: "E2E Employee 2",
      loginEmail: "employee-2@e2e.test",
      employeeCode: "EMP-002",
      unitCode: "OPS",
      positionCode: "EMPLOYEE"
    });

    await tx.reportingLine.createMany({
      data: [
        {
          subordinateEmploymentId: manager.employment.id,
          supervisorEmploymentId: owner.employment.id,
          validFrom: e2eEffectiveDate
        },
        {
          subordinateEmploymentId: manager2.employment.id,
          supervisorEmploymentId: owner.employment.id,
          validFrom: e2eEffectiveDate
        },
        {
          subordinateEmploymentId: hr.employment.id,
          supervisorEmploymentId: owner.employment.id,
          validFrom: e2eEffectiveDate
        },
        {
          subordinateEmploymentId: employee.employment.id,
          supervisorEmploymentId: manager.employment.id,
          validFrom: e2eEffectiveDate
        },
        {
          subordinateEmploymentId: employee2.employment.id,
          supervisorEmploymentId: manager2.employment.id,
          validFrom: e2eEffectiveDate
        }
      ]
    });

    await tx.companySetting.create({
      data: {
        organizationId: access.organization.id,
        key: "weekly_off_days",
        value: [0]
      }
    });

    const annualLeave = await tx.leaveTypeConfig.create({
      data: {
        organizationId: access.organization.id,
        code: "E2E_ANNUAL",
        name: "E2E Annual Leave",
        defaultAllocation: 10,
        accrualFrequency: "ANNUALLY",
        allowCarryForward: false,
        maxCarryForwardDays: 0,
        isPaid: true,
        isActive: true
      }
    });

    await tx.manualAttendanceRequest.createMany({
      data: [
        {
          employeeId: employee.employment.id,
          createdByUserAccountId: employee.account.id,
          type: "ADD_SCAN",
          reason: "Manager-visible E2E request",
          requestedTimestamp: new Date("2026-01-12T09:00:00.000Z"),
          status: "PENDING_MANAGER"
        },
        {
          employeeId: employee2.employment.id,
          createdByUserAccountId: employee2.account.id,
          type: "ADD_SCAN",
          reason: "Manager 2-visible E2E request",
          requestedTimestamp: new Date("2026-01-12T10:00:00.000Z"),
          status: "PENDING_MANAGER"
        },
        {
          employeeId: hr.employment.id,
          createdByUserAccountId: hr.account.id,
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
          employeeId: employee.employment.id,
          leaveTypeId: annualLeave.id,
          startDate: new Date("2026-02-02T00:00:00.000Z"),
          endDate: new Date("2026-02-02T00:00:00.000Z"),
          totalDays: 1,
          reason: "Manager-visible E2E leave",
          status: "PENDING_MANAGER"
        },
        {
          employeeId: employee2.employment.id,
          leaveTypeId: annualLeave.id,
          startDate: new Date("2026-02-02T00:00:00.000Z"),
          endDate: new Date("2026-02-02T00:00:00.000Z"),
          totalDays: 1,
          reason: "Manager 2-visible E2E leave",
          status: "PENDING_MANAGER"
        },
        {
          employeeId: manager.employment.id,
          leaveTypeId: annualLeave.id,
          startDate: new Date("2026-02-03T00:00:00.000Z"),
          endDate: new Date("2026-02-03T00:00:00.000Z"),
          totalDays: 1,
          reason: "Organization-visible E2E leave",
          status: "PENDING_HR"
        }
      ]
    });

    // -------------------------------------------------------------
    // Organization 2: e2e-2 ("Second E2E Organization")
    // -------------------------------------------------------------
    const access2 = await seedE2eAccessFoundation(tx, "e2e-2", "Second E2E Organization");
    const createEmployment2 = (input: {
      legalName: string;
      loginEmail: string;
      employeeCode: string;
      unitCode: string;
      positionCode: string;
    }) =>
      createE2eEmployment(tx, {
        organizationId: access2.organization.id,
        legalName: input.legalName,
        loginEmail: input.loginEmail,
        passwordHash,
        employeeCode: input.employeeCode,
        unitId: access2.units.get(input.unitCode)!.id,
        positionId: access2.positions.get(input.positionCode)!.id
      });

    const owner3 = await createEmployment2({
      legalName: "E2E Owner 3",
      loginEmail: "owner-2@e2e.test",
      employeeCode: "OWNER-003",
      unitCode: "EXEC",
      positionCode: "OWNER"
    });
    const manager3 = await createEmployment2({
      legalName: "E2E Manager 3",
      loginEmail: "manager-3@e2e.test",
      employeeCode: "MGR-003",
      unitCode: "ENG",
      positionCode: "MANAGER"
    });
    const employee3 = await createEmployment2({
      legalName: "E2E Employee 3",
      loginEmail: "employee-3@e2e.test",
      employeeCode: "EMP-003",
      unitCode: "ENG",
      positionCode: "EMPLOYEE"
    });

    await tx.reportingLine.createMany({
      data: [
        {
          subordinateEmploymentId: manager3.employment.id,
          supervisorEmploymentId: owner3.employment.id,
          validFrom: e2eEffectiveDate
        },
        {
          subordinateEmploymentId: employee3.employment.id,
          supervisorEmploymentId: manager3.employment.id,
          validFrom: e2eEffectiveDate
        }
      ]
    });

    await tx.companySetting.create({
      data: {
        organizationId: access2.organization.id,
        key: "weekly_off_days",
        value: [0]
      }
    });

    const annualLeave2 = await tx.leaveTypeConfig.create({
      data: {
        organizationId: access2.organization.id,
        code: "E2E_ANNUAL",
        name: "E2E Annual Leave",
        defaultAllocation: 10,
        accrualFrequency: "ANNUALLY",
        allowCarryForward: false,
        maxCarryForwardDays: 0,
        isPaid: true,
        isActive: true
      }
    });

    await tx.manualAttendanceRequest.createMany({
      data: [
        {
          employeeId: employee3.employment.id,
          createdByUserAccountId: employee3.account.id,
          type: "ADD_SCAN",
          reason: "Organization 2 E2E request",
          requestedTimestamp: new Date("2026-01-12T09:00:00.000Z"),
          status: "PENDING_MANAGER"
        }
      ]
    });

    await tx.leaveRequest.createMany({
      data: [
        {
          employeeId: employee3.employment.id,
          leaveTypeId: annualLeave2.id,
          startDate: new Date("2026-02-02T00:00:00.000Z"),
          endDate: new Date("2026-02-02T00:00:00.000Z"),
          totalDays: 1,
          reason: "Organization 2 E2E leave",
          status: "PENDING_MANAGER"
        }
      ]
    });
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
