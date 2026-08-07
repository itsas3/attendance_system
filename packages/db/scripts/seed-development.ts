import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";

const seedDir = dirname(fileURLToPath(import.meta.url));
const rootEnvPath = resolve(seedDir, "../../../.env");

if (existsSync(rootEnvPath)) {
  loadEnvFile(rootEnvPath);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: getDatabaseUrl() })
});
const devDeviceId = "esp32-dev-001";
const devDeviceSecret = getRequiredEnv("DEV_DEVICE_SECRET");

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

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("The bundled seed creates development-only accounts and devices.");
  }

  await prisma.$transaction(async (tx) => {
    // 1. Setup RBAC Roles and Permissions
    const rolesData = [
      { name: "employee", perms: ["my_attendance", "manual_reports"] },
      {
        name: "manager",
        perms: ["my_attendance", "manual_reports", "team_attendance", "approvals", "my_team"]
      },
      {
        name: "hr",
        perms: [
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
      },
      {
        name: "owner",
        perms: [
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
      }
    ];

    for (const p of [...new Set(rolesData.flatMap((r) => r.perms))]) {
      await tx.permission.upsert({ create: { name: p }, update: {}, where: { name: p } });
    }

    const roles: Record<string, { id: string }> = {};
    for (const r of rolesData) {
      roles[r.name] = await tx.role.upsert({
        create: { name: r.name },
        update: {},
        where: { name: r.name }
      });
      for (const p of r.perms) {
        const perm = await tx.permission.findUnique({ where: { name: p } });
        if (perm) {
          await tx.rolePermission.upsert({
            create: { roleId: roles[r.name]!.id, permissionId: perm.id },
            update: {},
            where: { roleId_permissionId: { roleId: roles[r.name]!.id, permissionId: perm.id } }
          });
        }
      }
    }

    // 2. Setup Employees with generic password123
    const defaultPasswordHash = hashSync("password123", 10);

    const owner = await tx.employee.upsert({
      create: {
        email: "owner@test.com",
        fullName: "Company Owner",
        roleId: roles["owner"]!.id,
        passwordHash: defaultPasswordHash
      },
      update: {},
      where: { email: "owner@test.com" }
    });

    const hr = await tx.employee.upsert({
      create: {
        email: "hr@test.com",
        fullName: "HR Manager",
        roleId: roles["hr"]!.id,
        supervisorId: owner.id,
        passwordHash: defaultPasswordHash
      },
      update: {
        supervisorId: owner.id
      },
      where: { email: "hr@test.com" }
    });

    const manager = await tx.employee.upsert({
      create: {
        email: "manager@test.com",
        fullName: "Team Manager",
        roleId: roles["manager"]!.id,
        supervisorId: owner.id,
        passwordHash: defaultPasswordHash
      },
      update: {
        supervisorId: owner.id
      },
      where: { email: "manager@test.com" }
    });

    const employee = await tx.employee.upsert({
      create: {
        email: "employee@test.com",
        fullName: "Regular Employee",
        roleId: roles["employee"]!.id,
        supervisorId: manager.id,
        passwordHash: defaultPasswordHash
      },
      update: {
        supervisorId: manager.id
      },
      where: { email: "employee@test.com" }
    });

    const shaheer = await tx.employee.upsert({
      create: {
        email: "shaheer@test.com",
        employeeCode: "EMP-07",
        fullName: "Shaheer",
        roleId: roles["employee"]!.id,
        supervisorId: manager.id,
        passwordHash: defaultPasswordHash,
        shiftInTime: "09:00",
        shiftOutTime: "18:00",
        timezone: "Asia/Karachi"
      },
      update: {
        supervisorId: manager.id
      },
      where: { email: "shaheer@test.com" }
    });

    // 3. Setup Dev Device
    const device = await tx.device.upsert({
      create: {
        apiKeyHash: hashDeviceSecret(devDeviceSecret),
        id: devDeviceId,
        location: "Development bench",
        name: "Development ESP32"
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
      await tx.scanEvent.deleteMany({
        where: { employeeId: item.emp.id }
      });

      for (const dayEntry of item.schedule) {
        const scanDay = new Date(lastWeekMonday);
        scanDay.setDate(lastWeekMonday.getDate() + dayEntry.dayOffset);

        for (const timeStr of dayEntry.times) {
          const [hours, minutes, seconds] = timeStr.split(":").map(Number);
          const scanTimestamp = new Date(scanDay);
          scanTimestamp.setHours(hours!, minutes!, seconds!, 0);

          await tx.scanEvent.create({
            data: {
              deviceId: device.id,
              employeeId: item.emp.id,
              scannerTemplateId: item.scannerTemplateId ?? 1,
              serverReceivedAt: scanTimestamp,
              createdAt: scanTimestamp
            }
          });
        }
      }
    }

    // 5. Seed Default Company Settings & Sample Holiday
    await tx.companySetting.upsert({
      create: {
        key: "weekly_off_days",
        value: [0] // Sunday default off-day
      },
      update: {},
      where: { key: "weekly_off_days" }
    });

    const holidayDate = new Date();
    holidayDate.setDate(holidayDate.getDate() + 2); // 2 days from now
    holidayDate.setHours(0, 0, 0, 0);

    await tx.holiday.upsert({
      create: {
        name: "Official Company Holiday",
        date: holidayDate,
        description: "Company-wide annual off-day"
      },
      update: {},
      where: { date: holidayDate }
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
        create: lt,
        update: {
          name: lt.name,
          description: lt.description,
          defaultAllocation: lt.defaultAllocation,
          accrualFrequency: lt.accrualFrequency
        },
        where: { code: lt.code }
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
          update: {},
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
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
