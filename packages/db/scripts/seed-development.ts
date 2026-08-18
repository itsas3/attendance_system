import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@prisma/client";
import { hashSync } from "bcryptjs";

const seedDir = dirname(fileURLToPath(import.meta.url));
const rootEnvPath = resolve(seedDir, "../../../.env");

if (existsSync(rootEnvPath)) {
  loadEnvFile(rootEnvPath);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: getDatabaseUrl() }),
  transactionOptions: { timeout: 30_000 }
});
const devDeviceId = "esp32-dev-001";
const devDeviceSecret = getRequiredEnv("DEV_DEVICE_SECRET");
const seededScanPayload = { source: "development-seed" } as const;

const developmentRolePermissions = {
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

const developmentUnits = [
  { code: "EXEC", name: "Executive", type: "DEPARTMENT" as const },
  { code: "HR", name: "Human Resources", type: "DEPARTMENT" as const },
  { code: "ENG", name: "Engineering", type: "DEPARTMENT" as const },
  { code: "OPS", name: "Operations", type: "DEPARTMENT" as const }
];

const developmentPositions = [
  { code: "OWNER", title: "Owner", roleKey: "owner", scope: "ORGANIZATION" as const },
  { code: "HR_OFFICER", title: "HR Officer", roleKey: "hr", scope: "ORGANIZATION" as const },
  {
    code: "MANAGER",
    title: "Manager",
    roleKey: "manager",
    scope: "ORGANIZATION_UNIT_TREE" as const
  },
  { code: "EMPLOYEE", title: "Employee", roleKey: "employee", scope: "SELF" as const }
];

function hashDeviceSecret(secret: string) {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

function getRequiredEnv(name: "DATABASE_URL" | "DEV_DEVICE_SECRET") {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `${name} is required to seed the database. Create .env from .env.dev.example or set ${name}.`
    );
  }

  return value;
}

function getDatabaseUrl() {
  return getRequiredEnv("DATABASE_URL");
}

async function seedDevelopmentAccessFoundation(tx: Prisma.TransactionClient) {
  const organization = await tx.organization.upsert({
    where: { slug: "default" },
    create: {
      name: "99xAutomation",
      slug: "default",
      timezone: "Asia/Karachi"
    },
    update: { name: "99xAutomation", isActive: true }
  });

  const permissionKeys = [...new Set(Object.values(developmentRolePermissions).flat())];
  const permissions = new Map<string, string>();
  for (const key of permissionKeys) {
    const permission = await tx.permission.upsert({
      where: { key },
      create: { key, name: titleCase(key), category: key.split("_")[0] ?? "general" },
      update: { isActive: true }
    });
    permissions.set(key, permission.id);
  }

  const roles = new Map<string, { id: string }>();
  for (const [key, assignedPermissions] of Object.entries(developmentRolePermissions)) {
    const role = await tx.role.upsert({
      where: { organizationId_key: { organizationId: organization.id, key } },
      create: {
        organizationId: organization.id,
        key,
        name: titleCase(key),
        isSystem: true
      },
      update: { isActive: true, name: titleCase(key) }
    });
    roles.set(key, role);

    await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
    await tx.rolePermission.createMany({
      data: assignedPermissions.map((permissionKey) => ({
        roleId: role.id,
        permissionId: permissions.get(permissionKey)!
      }))
    });
  }

  const units = new Map<string, { id: string }>();
  for (const definition of developmentUnits) {
    const unit = await tx.organizationUnit.upsert({
      where: {
        organizationId_code: { organizationId: organization.id, code: definition.code }
      },
      create: { ...definition, organizationId: organization.id },
      update: { name: definition.name, type: definition.type, isActive: true }
    });
    units.set(definition.code, unit);
  }

  const positions = new Map<string, { id: string }>();
  for (const definition of developmentPositions) {
    const position = await tx.position.upsert({
      where: {
        organizationId_code: { organizationId: organization.id, code: definition.code }
      },
      create: {
        organizationId: organization.id,
        code: definition.code,
        title: definition.title
      },
      update: { title: definition.title, isActive: true }
    });
    positions.set(definition.code, position);

    await tx.positionRoleMapping.upsert({
      where: {
        positionId_roleId_scope: {
          positionId: position.id,
          roleId: roles.get(definition.roleKey)!.id,
          scope: definition.scope
        }
      },
      create: {
        positionId: position.id,
        roleId: roles.get(definition.roleKey)!.id,
        scope: definition.scope
      },
      update: {}
    });
  }

  return { organization, units, positions };
}

async function upsertDevelopmentEmployment(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    legalName: string;
    loginEmail: string;
    passwordHash: string;
    employeeCode: string;
    unitId: string;
    positionId: string;
    timezone?: string;
    shiftInTime?: string;
    shiftOutTime?: string;
  }
) {
  const account = await tx.userAccount.upsert({
    where: { loginEmail: input.loginEmail },
    create: {
      loginEmail: input.loginEmail,
      passwordHash: input.passwordHash,
      status: "ACTIVE",
      person: {
        create: { legalName: input.legalName, personalEmail: input.loginEmail }
      }
    },
    update: {
      passwordHash: input.passwordHash,
      status: "ACTIVE",
      person: {
        update: { legalName: input.legalName, personalEmail: input.loginEmail }
      }
    },
    include: { person: true }
  });

  const membership = await tx.organizationMembership.upsert({
    where: {
      organizationId_personId: {
        organizationId: input.organizationId,
        personId: account.personId
      }
    },
    create: {
      organizationId: input.organizationId,
      personId: account.personId,
      status: "ACTIVE",
      joinedAt: new Date()
    },
    update: { status: "ACTIVE", endedAt: null }
  });

  const existingEmployment =
    (await tx.employment.findUnique({
      where: {
        organizationId_employeeCode: {
          organizationId: input.organizationId,
          employeeCode: input.employeeCode
        }
      }
    })) ??
    (await tx.employment.findFirst({
      where: { organizationId: input.organizationId, membershipId: membership.id, endedAt: null },
      orderBy: { hiredAt: "desc" }
    }));

  const employment = existingEmployment
    ? await tx.employment.update({
        where: { id: existingEmployment.id },
        data: {
          membershipId: membership.id,
          employeeCode: input.employeeCode,
          status: "ACTIVE",
          endedAt: null
        }
      })
    : await tx.employment.create({
        data: {
          organizationId: input.organizationId,
          membershipId: membership.id,
          employeeCode: input.employeeCode,
          status: "ACTIVE",
          hiredAt: new Date()
        }
      });

  await tx.employmentAssignment.deleteMany({ where: { employmentId: employment.id } });
  await tx.employmentAssignment.create({
    data: {
      employmentId: employment.id,
      organizationUnitId: input.unitId,
      positionId: input.positionId,
      validFrom: new Date(),
      timezone: input.timezone ?? "Asia/Karachi"
    }
  });

  let shift = await tx.shift.findFirst({
    where: {
      name: `${input.employeeCode} default shift`,
      startTime: input.shiftInTime ?? "09:00",
      endTime: input.shiftOutTime ?? "17:00"
    }
  });
  shift ??= await tx.shift.create({
    data: {
      organizationId: input.organizationId,
      name: `${input.employeeCode} default shift`,
      timezone: input.timezone ?? "Asia/Karachi",
      startTime: input.shiftInTime ?? "09:00",
      endTime: input.shiftOutTime ?? "17:00",
      workdays: [1, 2, 3, 4, 5]
    }
  });

  await tx.shiftAssignment.deleteMany({ where: { employeeId: employment.id } });
  await tx.shiftAssignment.create({
    data: { employeeId: employment.id, shiftId: shift.id, effectiveFrom: new Date() }
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
  if (process.env.NODE_ENV !== "development") {
    throw new Error("The development seed may only run when NODE_ENV=development.");
  }

  await prisma.$transaction(async (tx) => {
    // 1. Setup organization, structure, roles, and position defaults.
    const access = await seedDevelopmentAccessFoundation(tx);

    // 2. Setup people, accounts, memberships, employments, and assignments.
    const defaultPasswordHash = hashSync("password123", 10);
    const createSeededEmployment = (input: {
      legalName: string;
      loginEmail: string;
      employeeCode: string;
      unitCode: string;
      positionCode: string;
      shiftOutTime?: string;
    }) =>
      upsertDevelopmentEmployment(tx, {
        organizationId: access.organization.id,
        legalName: input.legalName,
        loginEmail: input.loginEmail,
        passwordHash: defaultPasswordHash,
        employeeCode: input.employeeCode,
        unitId: access.units.get(input.unitCode)!.id,
        positionId: access.positions.get(input.positionCode)!.id,
        shiftOutTime: input.shiftOutTime
      });

    const ownerRecord = await createSeededEmployment({
      legalName: "Company Owner",
      loginEmail: "owner@test.com",
      employeeCode: "OWNER-001",
      unitCode: "EXEC",
      positionCode: "OWNER"
    });
    const hrRecord = await createSeededEmployment({
      legalName: "HR Manager",
      loginEmail: "hr@test.com",
      employeeCode: "HR-001",
      unitCode: "HR",
      positionCode: "HR_OFFICER"
    });
    const managerRecord = await createSeededEmployment({
      legalName: "Team Manager",
      loginEmail: "manager@test.com",
      employeeCode: "MGR-001",
      unitCode: "ENG",
      positionCode: "MANAGER"
    });
    const employeeRecord = await createSeededEmployment({
      legalName: "Regular Employee",
      loginEmail: "employee@test.com",
      employeeCode: "EMP-001",
      unitCode: "ENG",
      positionCode: "EMPLOYEE"
    });
    const shaheerRecord = await createSeededEmployment({
      legalName: "Shaheer",
      loginEmail: "shaheer@test.com",
      employeeCode: "EMP-07",
      unitCode: "ENG",
      positionCode: "EMPLOYEE",
      shiftOutTime: "18:00"
    });
    const owner = ownerRecord.employment;
    const hr = hrRecord.employment;
    const manager = managerRecord.employment;
    const employee = employeeRecord.employment;
    const shaheer = shaheerRecord.employment;

    await tx.reportingLine.deleteMany({
      where: { subordinateEmploymentId: { in: [hr.id, manager.id, employee.id, shaheer.id] } }
    });
    await tx.reportingLine.createMany({
      data: [
        { subordinateEmploymentId: hr.id, supervisorEmploymentId: owner.id, validFrom: new Date() },
        {
          subordinateEmploymentId: manager.id,
          supervisorEmploymentId: owner.id,
          validFrom: new Date()
        },
        {
          subordinateEmploymentId: employee.id,
          supervisorEmploymentId: manager.id,
          validFrom: new Date()
        },
        {
          subordinateEmploymentId: shaheer.id,
          supervisorEmploymentId: manager.id,
          validFrom: new Date()
        }
      ]
    });

    // 3. Setup Dev Device
    const device = await tx.device.upsert({
      create: {
        apiKeyHash: hashDeviceSecret(devDeviceSecret),
        id: devDeviceId,
        location: "Development bench",
        name: "Development ESP32",
        organizationId: access.organization.id
      },
      update: {
        apiKeyHash: hashDeviceSecret(devDeviceSecret),
        status: "ACTIVE"
      },
      where: {
        id: devDeviceId
      }
    });

    // 4. Seed Last Week Sample Scans with unique schedules for each employee role
    const now = new Date();
    const currentDayOfWeek = now.getDay();
    const distanceToCurrentMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
    const lastWeekMonday = new Date(now);
    lastWeekMonday.setDate(now.getDate() - distanceToCurrentMonday - 7);
    lastWeekMonday.setHours(0, 0, 0, 0);

    const employeeSchedules = [
      {
        emp: shaheer,
        scannerTemplateId: 107,
        schedule: [
          { dayOffset: 0, times: ["08:55:00", "18:10:00"] },
          { dayOffset: 1, times: ["09:02:00", "17:55:00"] },
          { dayOffset: 2, times: ["08:58:00", "18:05:00"] },
          { dayOffset: 3, times: ["08:55:00", "18:10:00"] },
          { dayOffset: 4, times: ["09:18:00", "14:30:00"] }
        ]
      },
      {
        emp: employee,
        scannerTemplateId: 101,
        schedule: [
          { dayOffset: 0, times: ["08:58:00", "13:05:00", "17:32:00"] }, // Monday
          { dayOffset: 1, times: ["09:02:00", "17:15:00"] }, // Tuesday
          { dayOffset: 2, times: ["08:55:00", "13:00:00", "17:45:00"] }, // Wednesday
          { dayOffset: 3, times: ["09:10:00", "17:00:00"] }, // Thursday
          { dayOffset: 4, times: ["08:50:00", "16:45:00"] } // Friday
        ]
      },
      {
        emp: manager,
        scannerTemplateId: 102,
        schedule: [
          { dayOffset: 0, times: ["08:30:00", "13:15:00", "18:05:00"] }, // Monday
          { dayOffset: 1, times: ["08:42:00", "12:45:00", "18:12:00"] }, // Tuesday
          { dayOffset: 2, times: ["08:35:00", "17:55:00"] }, // Wednesday
          { dayOffset: 3, times: ["08:40:00", "13:10:00", "18:30:00"] }, // Thursday
          { dayOffset: 4, times: ["08:25:00", "17:30:00"] } // Friday
        ]
      },
      {
        emp: hr,
        scannerTemplateId: 103,
        schedule: [
          { dayOffset: 0, times: ["09:15:00", "17:45:00"] }, // Monday
          { dayOffset: 1, times: ["09:00:00", "13:30:00", "17:30:00"] }, // Tuesday
          { dayOffset: 2, times: ["09:10:00", "17:40:00"] }, // Wednesday
          { dayOffset: 3, times: ["08:55:00", "13:20:00", "17:50:00"] }, // Thursday
          { dayOffset: 4, times: ["09:05:00", "17:00:00"] } // Friday
        ]
      },
      {
        emp: owner,
        scannerTemplateId: 104,
        schedule: [
          { dayOffset: 0, times: ["08:15:00", "12:00:00", "14:30:00", "19:10:00"] }, // Monday (4 scans)
          { dayOffset: 1, times: ["08:20:00", "18:45:00"] }, // Tuesday
          { dayOffset: 2, times: ["08:10:00", "13:00:00", "19:30:00"] }, // Wednesday
          { dayOffset: 3, times: ["08:25:00", "18:50:00"] }, // Thursday
          { dayOffset: 4, times: ["08:05:00", "16:30:00"] } // Friday
        ]
      }
    ];

    for (const item of employeeSchedules) {
      await tx.fingerprintEnrollment.upsert({
        create: {
          deviceId: device.id,
          employeeId: item.emp.id,
          scannerTemplateId: item.scannerTemplateId
        },
        update: {
          revokedAt: null,
          scannerTemplateId: item.scannerTemplateId,
          status: "ACTIVE"
        },
        where: {
          employeeId_deviceId: {
            deviceId: device.id,
            employeeId: item.emp.id
          }
        }
      });
    }

    await tx.scanEvent.deleteMany({
      where: {
        deviceId: device.id,
        rawPayload: { equals: seededScanPayload }
      }
    });

    const seededScans = [];
    for (const item of employeeSchedules) {
      for (const dayEntry of item.schedule) {
        const scanDay = new Date(lastWeekMonday);
        scanDay.setDate(lastWeekMonday.getDate() + dayEntry.dayOffset);

        for (const timeStr of dayEntry.times) {
          const [hours, minutes, seconds] = timeStr.split(":").map(Number);
          const scanTimestamp = new Date(scanDay);
          scanTimestamp.setHours(hours!, minutes!, seconds!, 0);

          seededScans.push({
            createdAt: scanTimestamp,
            deviceId: device.id,
            employeeId: item.emp.id,
            rawPayload: seededScanPayload,
            scannerTemplateId: item.scannerTemplateId,
            serverReceivedAt: scanTimestamp
          });
        }
      }
    }

    await tx.scanEvent.createMany({ data: seededScans });

    // 5. Seed Default Company Settings & Sample Holiday
    await tx.companySetting.upsert({
      create: {
        organizationId: access.organization.id,
        key: "weekly_off_days",
        value: [0] // Sunday default off-day
      },
      update: {},
      where: {
        organizationId_key: { organizationId: access.organization.id, key: "weekly_off_days" }
      }
    });

    const holidayDate = new Date();
    holidayDate.setDate(holidayDate.getDate() + 2); // 2 days from now
    holidayDate.setHours(0, 0, 0, 0);

    await tx.holiday.deleteMany({
      where: {
        organizationId: access.organization.id,
        description: "Company-wide annual off-day",
        name: "Official Company Holiday",
        NOT: { date: holidayDate }
      }
    });

    await tx.holiday.upsert({
      create: {
        organizationId: access.organization.id,
        name: "Official Company Holiday",
        date: holidayDate,
        description: "Company-wide annual off-day"
      },
      update: {
        description: "Company-wide annual off-day",
        name: "Official Company Holiday"
      },
      where: { organizationId_date: { organizationId: access.organization.id, date: holidayDate } }
    });

    // 6. Seed Default HR Leave Types & Employee Balances
    const defaultLeaveTypes = [
      {
        code: "ANNUAL",
        name: "Annual Leave",
        description: "Paid annual vacation days",
        accrualFrequency: "MONTHLY" as const,
        defaultAllocation: 14,
        allowCarryForward: true,
        maxCarryForwardDays: 5,
        isPaid: true
      },
      {
        code: "SICK",
        name: "Sick Leave",
        description: "Paid medical & health leave",
        accrualFrequency: "MONTHLY" as const,
        defaultAllocation: 8,
        allowCarryForward: false,
        maxCarryForwardDays: 0,
        isPaid: true
      },
      {
        code: "CASUAL",
        name: "Casual Leave",
        description: "Short notice casual time off",
        accrualFrequency: "MONTHLY" as const,
        defaultAllocation: 10,
        allowCarryForward: false,
        maxCarryForwardDays: 0,
        isPaid: true
      },
      {
        code: "UNPAID",
        name: "Unpaid Leave",
        description: "Leave without pay (LOP)",
        accrualFrequency: "ANNUALLY" as const,
        defaultAllocation: 0,
        allowCarryForward: false,
        maxCarryForwardDays: 0,
        isPaid: false
      }
    ];

    const seededLeaveTypes: Record<string, { id: string }> = {};
    for (const lt of defaultLeaveTypes) {
      const created = await tx.leaveTypeConfig.upsert({
        create: { ...lt, organizationId: access.organization.id },
        update: {
          accrualFrequency: lt.accrualFrequency,
          allowCarryForward: lt.allowCarryForward,
          defaultAllocation: lt.defaultAllocation,
          description: lt.description,
          isActive: true,
          isPaid: lt.isPaid,
          maxCarryForwardDays: lt.maxCarryForwardDays,
          name: lt.name
        },
        where: {
          organizationId_code: {
            organizationId: access.organization.id,
            code: lt.code
          }
        }
      });
      seededLeaveTypes[lt.code] = created;
    }

    const currentYear = new Date().getFullYear();
    const allEmps = [owner, hr, manager, employee, shaheer];

    for (const emp of allEmps) {
      for (const lt of defaultLeaveTypes) {
        const typeConfig = seededLeaveTypes[lt.code]!;
        const accrued = lt.defaultAllocation;

        await tx.leaveBalance.upsert({
          create: {
            employeeId: emp.id,
            year: currentYear,
            leaveTypeId: typeConfig.id,
            allocated: lt.defaultAllocation,
            accrued,
            used: 0,
            carriedOver: 0
          },
          update: {
            accrued,
            allocated: lt.defaultAllocation
          },
          where: {
            employeeId_year_leaveTypeId: {
              employeeId: emp.id,
              year: currentYear,
              leaveTypeId: typeConfig.id
            }
          }
        });
      }
    }
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
