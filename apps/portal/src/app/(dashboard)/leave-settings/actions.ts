"use me";
"use server";

import { revalidatePath } from "next/cache";
import { createPrismaClient } from "@attendance/db";
import { getCurrentUser } from "../../../lib/session";

const db = createPrismaClient(process.env.DATABASE_URL as string);

export async function createLeaveType(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || (user.roleName !== "hr" && user.roleName !== "owner")) {
    return { error: "Unauthorized. HR or Owner role required." };
  }

  const name = (formData.get("name") as string)?.trim();
  const code = (formData.get("code") as string)?.trim().toUpperCase().replace(/\s+/g, "_");
  const description = (formData.get("description") as string)?.trim() || null;
  const accrualFrequency =
    (formData.get("accrualFrequency") as "MONTHLY" | "ANNUALLY") || "ANNUALLY";
  const defaultAllocation = parseFloat((formData.get("defaultAllocation") as string) || "0");
  const allowCarryForward = formData.get("allowCarryForward") === "true";
  const maxCarryForwardDays = parseFloat((formData.get("maxCarryForwardDays") as string) || "0");
  const isPaid = formData.get("isPaid") !== "false";

  if (!name || !code) {
    return { error: "Name and code are required." };
  }

  if (isNaN(defaultAllocation) || defaultAllocation < 0) {
    return { error: "Default allocation must be a valid non-negative number." };
  }

  try {
    const existing = await db.leaveTypeConfig.findUnique({
      where: { organizationId_code: { organizationId: user.organizationId, code } }
    });
    if (existing) {
      return { error: `A leave type with code "${code}" already exists.` };
    }

    const createdType = await db.leaveTypeConfig.create({
      data: {
        organizationId: user.organizationId,
        name,
        code,
        description,
        accrualFrequency,
        defaultAllocation,
        allowCarryForward,
        maxCarryForwardDays,
        isPaid,
        isActive: true
      }
    });

    // Automatically create/update leave balances for active employees for the current year
    const currentYear = new Date().getFullYear();
    const employees = await db.employment.findMany({ select: { id: true } });

    const accrued = defaultAllocation;

    for (const emp of employees) {
      await db.leaveBalance.upsert({
        create: {
          employeeId: emp.id,
          year: currentYear,
          leaveTypeId: createdType.id,
          allocated: defaultAllocation,
          accrued,
          used: 0,
          carriedOver: 0
        },
        update: {},
        where: {
          employeeId_year_leaveTypeId: {
            employeeId: emp.id,
            year: currentYear,
            leaveTypeId: createdType.id
          }
        }
      });
    }

    revalidatePath("/leave-settings");
    revalidatePath("/my-leave-requests");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create leave type.";
    console.error("Failed to create leave type:", err);
    return { error: message };
  }
}

export async function toggleLeaveTypeStatus(id: string, isActive: boolean) {
  const user = await getCurrentUser();
  if (!user || (user.roleName !== "hr" && user.roleName !== "owner")) {
    return { error: "Unauthorized. HR or Owner role required." };
  }

  try {
    await db.leaveTypeConfig.update({
      where: { id },
      data: { isActive }
    });

    revalidatePath("/leave-settings");
    revalidatePath("/my-leave-requests");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update leave type status.";
    return { error: message };
  }
}
