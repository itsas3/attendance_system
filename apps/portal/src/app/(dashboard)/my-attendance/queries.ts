import { classifyDailyScans, evaluateShiftAttendance } from "@attendance/attendance-core";
import { createPrismaClient } from "@attendance/db";
import { formatDateRange, getFixedAttendanceRange, type AttendanceRange } from "./_lib/date-range";
import type { AttendancePageData, WeekdayData } from "./types";

const db = createPrismaClient(process.env.DATABASE_URL as string);
const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

async function resolveRange(
  organizationId: string,
  range: string,
  employeeId: string
): Promise<AttendanceRange> {
  const fixed = getFixedAttendanceRange(range);
  if (fixed) return fixed;
  const earliest = await db.scanEvent.findFirst({
    where: { organizationId, employeeId },
    orderBy: { serverReceivedAt: "asc" },
    select: { serverReceivedAt: true }
  });
  const startDate = new Date(earliest?.serverReceivedAt ?? new Date());
  if (!earliest) startDate.setDate(startDate.getDate() - 30);
  startDate.setHours(0, 0, 0, 0);
  const now = new Date();
  return {
    startDate,
    endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
    bannerTitle: "All Time Attendance History"
  };
}

async function getSources(
  organizationId: string,
  employeeId: string,
  { startDate, endDate }: AttendanceRange
) {
  return Promise.all([
    db.employment.findUnique({
      where: { id: employeeId },
      select: {
        shiftAssignments: {
          where: { effectiveTo: null },
          orderBy: { effectiveFrom: "desc" },
          take: 1,
          select: { shift: { select: { startTime: true, endTime: true } } }
        }
      }
    }),
    db.companySetting.findUnique({
      where: { organizationId_key: { organizationId, key: "weekly_off_days" } }
    }),
    db.holiday.findMany({
      where: { organizationId, date: { gte: startDate, lte: endDate } }
    }),
    db.leaveRequest.findMany({
      where: {
        employeeId,
        status: { in: ["APPROVED", "PENDING_MANAGER", "PENDING_HR"] },
        startDate: { lte: endDate },
        endDate: { gte: startDate }
      },
      include: { leaveType: true }
    }),
    db.scanEvent.findMany({
      where: { organizationId, employeeId, serverReceivedAt: { gte: startDate, lte: endDate } },
      orderBy: { serverReceivedAt: "asc" }
    })
  ]);
}

type Sources = Awaited<ReturnType<typeof getSources>>;

function sameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function includesDay(startValue: Date, endValue: Date, day: Date): boolean {
  const start = new Date(startValue);
  const end = new Date(endValue);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return day >= start && day <= end;
}

function getEmptyDayStatus(day: Date, sources: Sources, offDays: number[]): Partial<WeekdayData> {
  const [, , holidays, leaveRequests] = sources;
  const leave = leaveRequests.find((item) => includesDay(item.startDate, item.endDate, day));
  if (leave)
    return {
      status: leave.status === "APPROVED" ? "APPROVED_LEAVE" : "PENDING_LEAVE",
      leaveTypeName: leave.leaveType.name
    };
  const holiday = holidays.find((item) => sameDay(new Date(item.date), day));
  if (holiday) return { status: "HOLIDAY", holidayName: holiday.name };
  return { status: offDays.includes(day.getDay()) ? "WEEKEND" : "ABSENT" };
}

function buildDay(day: Date, sources: Sources, offDays: number[]): WeekdayData {
  const [employee, , , , scans] = sources;
  const dayScans = scans.filter((scan) => sameDay(new Date(scan.serverReceivedAt), day));
  const dayName = dayNames[day.getDay()]!;
  const formatted = dayScans.map((scan) => ({
    id: scan.id,
    timeStr: new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    }).format(scan.serverReceivedAt),
    occurredAt: scan.serverReceivedAt
  }));
  const result: WeekdayData = {
    dayName,
    dateStr: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(day),
    fullDate: day,
    scans: classifyDailyScans(formatted, dayName),
    attendanceValue: 0
  };
  if (!dayScans.length) return { ...result, ...getEmptyDayStatus(day, sources, offDays) };
  const evaluation = evaluateShiftAttendance({
    firstScanTime: dayScans[0]!.serverReceivedAt,
    lastScanTime: dayScans.at(-1)!.serverReceivedAt,
    shiftInTime: employee?.shiftAssignments[0]?.shift.startTime ?? "09:00",
    shiftOutTime: employee?.shiftAssignments[0]?.shift.endTime ?? "17:00",
    graceMinutes: 20,
    halfDayThresholdHours: 3
  });
  return {
    ...result,
    status: evaluation.status,
    attendanceValue: evaluation.value,
    evaluationReason: evaluation.reason
  };
}

function buildDays(range: AttendanceRange, sources: Sources): WeekdayData[] {
  const value = sources[1]?.value;
  const offDays = Array.isArray(value) ? (value as number[]) : [0];
  const days: WeekdayData[] = [];
  const date = new Date(range.startDate);
  while (date <= range.endDate) {
    days.push(buildDay(new Date(date), sources, offDays));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

export async function getAttendancePageData(
  organizationId: string,
  employeeId: string,
  requestedRange?: string
): Promise<AttendancePageData> {
  const rangeName = requestedRange ?? "last_week";
  const range = await resolveRange(organizationId, rangeName, employeeId);
  const sources = await getSources(organizationId, employeeId, range);
  const weekdays = buildDays(range, sources);
  const totalScans = sources[4].length;
  return {
    range: rangeName,
    bannerTitle: range.bannerTitle,
    dateRange: formatDateRange(range.startDate, range.endDate),
    weekdays,
    totalScans,
    daysPresent: weekdays.reduce((sum, day) => sum + (day.attendanceValue ?? 0), 0)
  };
}
