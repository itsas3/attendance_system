"use server";

import { getCurrentUser } from "../../../lib/session";
import { hasAnyPermission } from "../../../lib/rbac";
import { createPrismaClient } from "@attendance/db";
import { revalidatePath } from "next/cache";

const db = createPrismaClient(process.env.DATABASE_URL as string);

function isAuthorized(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  return hasAnyPermission(user, ["company_attendance", "reports", "enrollment"]);
}

export async function updateWeeklyOffDays(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !isAuthorized(user)) {
    throw new Error("Unauthorized");
  }

  const offDaysType = formData.get("offDaysType") as string;
  let offDays: number[];

  if (offDaysType === "custom") {
    const rawDays =
      formData.getAll("customOffDays").length > 0
        ? formData.getAll("customOffDays")
        : formData.getAll("customDays");
    offDays = rawDays
      .map((d) => parseInt(d as string, 10))
      .filter((n) => !isNaN(n) && n >= 0 && n <= 6);
  } else if (offDaysType === "sat_sun") {
    offDays = [0, 6];
  } else if (offDaysType === "fri_sat") {
    offDays = [5, 6];
  } else if (offDaysType === "fri_only") {
    offDays = [5];
  } else {
    offDays = [0];
  }

  await db.companySetting.upsert({
    create: {
      organizationId: user.organizationId,
      key: "weekly_off_days",
      value: offDays
    },
    update: {
      value: offDays
    },
    where: {
      organizationId_key: { organizationId: user.organizationId, key: "weekly_off_days" }
    }
  });

  revalidatePath("/work-calendar");
  revalidatePath("/company-attendance");
  revalidatePath("/team-attendance");
}

export async function createHoliday(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !isAuthorized(user)) {
    throw new Error("Unauthorized");
  }

  const name = (formData.get("name") as string)?.trim();
  const dateStr = (formData.get("date") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();

  if (!name || !dateStr) {
    throw new Error("Holiday name and date are required.");
  }

  const date = new Date(dateStr);
  date.setHours(0, 0, 0, 0);

  await db.holiday.upsert({
    create: {
      organizationId: user.organizationId,
      name,
      date,
      description
    },
    update: {
      name,
      description
    },
    where: {
      organizationId_date: { organizationId: user.organizationId, date }
    }
  });

  revalidatePath("/work-calendar");
  revalidatePath("/company-attendance");
  revalidatePath("/team-attendance");
}

export async function deleteHoliday(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !isAuthorized(user)) {
    throw new Error("Unauthorized");
  }

  const id = formData.get("id") as string;
  if (!id) return;

  await db.holiday.delete({
    where: { id, organizationId: user.organizationId }
  });

  revalidatePath("/work-calendar");
  revalidatePath("/company-attendance");
  revalidatePath("/team-attendance");
}
