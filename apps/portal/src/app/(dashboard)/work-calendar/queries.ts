import { createPrismaClient } from "@attendance/db";
import { getCurrentUser } from "../../../lib/session";

const db = createPrismaClient(process.env.DATABASE_URL as string);
export const weekdayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
];

function getOffDaysType(days: number[]): string {
  if (days.length === 1 && days[0] === 0) return "sun_only";
  if (days.length === 2 && days.includes(0) && days.includes(6)) return "sat_sun";
  if (days.length === 2 && days.includes(5) && days.includes(6)) return "fri_sat";
  if (days.length === 1 && days[0] === 5) return "fri_only";
  return "custom";
}

export async function getWorkCalendarData() {
  const user = await getCurrentUser();
  const organizationId = user?.organizationId;

  const [setting, holidays] = await Promise.all([
    organizationId
      ? db.companySetting.findUnique({
          where: { organizationId_key: { organizationId, key: "weekly_off_days" } }
        })
      : null,
    organizationId
      ? db.holiday.findMany({
          where: { organizationId },
          orderBy: { date: "asc" }
        })
      : []
  ]);
  const offDays = Array.isArray(setting?.value) ? (setting.value as number[]) : [0];
  return {
    offDays,
    offDaysType: getOffDaysType(offDays),
    offDaysText: offDays.map((day) => weekdayNames[day]).join(", "),
    holidays
  };
}
