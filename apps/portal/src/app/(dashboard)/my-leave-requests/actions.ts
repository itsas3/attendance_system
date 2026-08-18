"use server";

import { revalidatePath } from "next/cache";
import { createPrismaClient } from "@attendance/db";
import { calculateWorkingDays, calculateAvailableBalance } from "@attendance/attendance-core";
import { getCurrentUser } from "../../../lib/session";

const db = createPrismaClient(process.env.DATABASE_URL as string);

export async function submitLeaveRequest(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Unauthorized. Please sign in." };
  }

  if (user.roleName === "owner") {
    return { error: "Company Owners cannot submit leave applications." };
  }

  const leaveTypeId = (formData.get("leaveTypeId") as string)?.trim();
  const startDateStr = (formData.get("startDate") as string)?.trim();
  const endDateStr = (formData.get("endDate") as string)?.trim();
  const reason = (formData.get("reason") as string)?.trim();

  if (!leaveTypeId || !startDateStr || !endDateStr || !reason) {
    return { error: "All fields (Leave Type, Start Date, End Date, Reason) are required." };
  }

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return { error: "Invalid date format." };
  }

  if (startDate > endDate) {
    return { error: "Start date cannot be after end date." };
  }

  // 1. Fetch holidays and off-days for business day calculation
  const holidays = await db.holiday.findMany({
    where: { organizationId: user.organizationId },
    select: { date: true }
  });
  const offDaysSetting = await db.companySetting.findUnique({
    where: { organizationId_key: { organizationId: user.organizationId, key: "weekly_off_days" } }
  });
  const offDaysArray = Array.isArray(offDaysSetting?.value)
    ? (offDaysSetting.value as number[])
    : [0];

  const totalWorkingDays = calculateWorkingDays(
    startDate,
    endDate,
    holidays.map((h) => h.date),
    offDaysArray
  );

  if (totalWorkingDays <= 0) {
    return { error: "Selected date range contains no working days (all weekend/holidays)." };
  }

  // 2. Fetch employee balance for this leave type for the current year
  const currentYear = startDate.getFullYear();
  const leaveType = await db.leaveTypeConfig.findUnique({ where: { id: leaveTypeId } });
  if (!leaveType || !leaveType.isActive) {
    return { error: "Selected leave category is invalid or inactive." };
  }

  const balance = await db.leaveBalance.findUnique({
    where: {
      employeeId_year_leaveTypeId: {
        employeeId: user.employeeId,
        year: currentYear,
        leaveTypeId
      }
    }
  });

  // Calculate estimated paid vs unpaid split at submission
  let estPaidDays: number;
  let estUnpaidDays: number;

  if (leaveType.isPaid) {
    const available = balance
      ? calculateAvailableBalance(balance.accrued, balance.carriedOver, balance.used)
      : 0;
    estPaidDays = Math.min(totalWorkingDays, Math.max(0, available));
    estUnpaidDays = totalWorkingDays - estPaidDays;
  } else {
    estPaidDays = 0;
    estUnpaidDays = totalWorkingDays;
  }

  try {
    // 3. Determine initial approval status and steps based on applicant role
    const employeeRecord = await db.employment.findUnique({
      where: { id: user.employeeId },
      include: {
        subordinateLines: {
          where: { type: "PRIMARY", validUntil: null },
          take: 1
        }
      }
    });

    const roleName = user.roleName;
    const isRegularEmployee = roleName === "employee";

    // Regular employees with a direct manager start at PENDING_MANAGER (Stage 1)
    // Managers, HR staff, and employees without a direct manager start at PENDING_HR (Stage 2 / Owner)
    const initialStatus =
      isRegularEmployee && employeeRecord?.subordinateLines[0] ? "PENDING_MANAGER" : "PENDING_HR";

    const leaveReq = await db.leaveRequest.create({
      data: {
        employeeId: user.employeeId,
        leaveTypeId,
        startDate,
        endDate,
        totalDays: totalWorkingDays,
        paidDays: estPaidDays,
        unpaidDays: estUnpaidDays,
        reason,
        status: initialStatus,
        appliedAt: new Date()
      }
    });

    // Create Approval Steps
    const supervisorId = employeeRecord?.subordinateLines[0]?.supervisorEmploymentId;
    if (initialStatus === "PENDING_MANAGER" && supervisorId) {
      await db.leaveApprovalStep.create({
        data: {
          leaveRequestId: leaveReq.id,
          sequence: 1,
          approverEmployeeId: supervisorId,
          approverKind: "MANAGER",
          status: "PENDING"
        }
      });
    } else {
      // Direct Stage 2 (HR / Owner stage)
      const ownerEmployee = await findEmploymentByRole(user.organizationId, "owner");
      const hrEmployee = await findEmploymentByRole(user.organizationId, "hr");

      // For HR staff applications, the approver is the Company Owner
      const approverId =
        roleName === "hr"
          ? ownerEmployee?.id || user.employeeId
          : hrEmployee?.id || ownerEmployee?.id || user.employeeId;

      await db.leaveApprovalStep.create({
        data: {
          leaveRequestId: leaveReq.id,
          sequence: 1,
          approverEmployeeId: approverId,
          approverKind: roleName === "hr" ? "OWNER" : "HR",
          status: "PENDING"
        }
      });
    }

    revalidatePath("/my-leave-requests");
    revalidatePath("/my-attendance");
    revalidatePath("/employee-leave-requests");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to submit leave request.";
    console.error("Leave request submission error:", err);
    return { error: message };
  }
}

function findEmploymentByRole(organizationId: string, roleKey: string) {
  return db.employment.findFirst({
    where: {
      organizationId,
      status: "ACTIVE",
      OR: [
        { membership: { roleAssignments: { some: { role: { key: roleKey }, revokedAt: null } } } },
        {
          assignments: {
            some: {
              validUntil: null,
              position: { defaultRoleMappings: { some: { role: { key: roleKey } } } }
            }
          }
        }
      ]
    }
  });
}

export async function cancelLeaveRequest(requestId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Unauthorized." };
  }

  try {
    const req = await db.leaveRequest.findUnique({ where: { id: requestId } });
    if (!req || req.employeeId !== user.employeeId) {
      return { error: "Request not found or not owned by you." };
    }

    if (req.status === "APPROVED") {
      return { error: "Cannot cancel an already approved leave request." };
    }

    await db.leaveRequest.update({
      where: { id: requestId },
      data: { status: "CANCELLED" }
    });

    revalidatePath("/my-leave-requests");
    revalidatePath("/my-attendance");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to cancel leave request.";
    return { error: message };
  }
}
