import { evaluateShiftAttendance } from "@attendance/attendance-core";
import { createPrismaClient } from "@attendance/db";
import type { TeamAttendanceData, TeamAttendanceRow, TeamAttendanceStatus } from "./types";
import {
  currentReportingLineWhere,
  employmentAccessInclude,
  getEmploymentEmail,
  getEmploymentName,
  getEmploymentRoleKey
} from "../../../lib/employment";

const db = createPrismaClient(process.env.DATABASE_URL as string);
const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: true
});

function getEmployeeStatus(
  scanTimes: Date[],
  shiftInTime: string,
  shiftOutTime: string,
  emptyStatus: TeamAttendanceStatus
): TeamAttendanceStatus {
  if (!scanTimes.length) return emptyStatus;
  const evaluation = evaluateShiftAttendance({
    firstScanTime: scanTimes[0]!,
    lastScanTime: scanTimes.at(-1)!,
    shiftInTime,
    shiftOutTime,
    graceMinutes: 20,
    halfDayThresholdHours: 3
  });
  return evaluation.status === "HALF_DAY" ? "LATE" : "PRESENT";
}

function getMetrics(rows: TeamAttendanceRow[]): TeamAttendanceData["metrics"] {
  return rows.reduce(
    (metrics, row) => {
      if (row.status === "PRESENT" || row.status === "LATE") metrics.present++;
      if (row.status === "LATE") metrics.late++;
      if (row.status === "ABSENT") metrics.absent++;
      if (row.status === "HOLIDAY" || row.status === "WEEKEND") metrics.exempt++;
      return metrics;
    },
    { total: rows.length, present: 0, late: 0, absent: 0, exempt: 0 }
  );
}

export async function getTeamAttendanceData(
  employeeId: string,
  companyWide: boolean,
  organizationId: string
): Promise<TeamAttendanceData> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const employees = await db.employment.findMany({
    where: companyWide
      ? { organizationId, status: "ACTIVE" }
      : {
          organizationId,
          status: "ACTIVE",
          subordinateLines: {
            some: {
              supervisorEmploymentId: employeeId,
              ...currentReportingLineWhere()
            }
          }
        },
    include: {
      ...employmentAccessInclude(),
      shiftAssignments: {
        where: { effectiveTo: null },
        orderBy: { effectiveFrom: "desc" },
        take: 1,
        include: { shift: true }
      }
    },
    orderBy: { employeeCode: "asc" }
  });
  const [setting, holiday, scans] = await Promise.all([
    db.companySetting.findUnique({
      where: { organizationId_key: { organizationId, key: "weekly_off_days" } }
    }),
    db.holiday.findUnique({
      where: { organizationId_date: { organizationId, date: start } }
    }),
    db.scanEvent.findMany({
      where: {
        employeeId: { in: employees.map(({ id }) => id) },
        serverReceivedAt: { gte: start, lte: end }
      },
      orderBy: { serverReceivedAt: "asc" }
    })
  ]);
  const offDays = Array.isArray(setting?.value) ? (setting.value as number[]) : [0];
  const emptyStatus: TeamAttendanceStatus = holiday
    ? "HOLIDAY"
    : offDays.includes(now.getDay())
      ? "WEEKEND"
      : "ABSENT";
  const rows = employees.map((employee) => {
    const times = scans
      .filter((scan) => scan.employeeId === employee.id)
      .map((scan) => scan.serverReceivedAt);
    return {
      id: employee.id,
      fullName: getEmploymentName(employee),
      email: getEmploymentEmail(employee),
      roleName: getEmploymentRoleKey(employee),
      scanCount: times.length,
      firstIn: times[0] ? timeFormatter.format(times[0]) : "—",
      lastOut: times.length > 1 ? timeFormatter.format(times.at(-1)!) : "—",
      status: getEmployeeStatus(
        times,
        employee.shiftAssignments[0]?.shift.startTime ?? "09:00",
        employee.shiftAssignments[0]?.shift.endTime ?? "17:00",
        emptyStatus
      )
    };
  });
  const dateText = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(now);
  return {
    rows,
    dateText,
    dayNote: holiday?.name ?? (emptyStatus === "WEEKEND" ? "Weekly Off-Day" : undefined),
    metrics: getMetrics(rows)
  };
}
