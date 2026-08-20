"use server";

import { revalidatePath } from "next/cache";
import { createPrismaClient } from "@attendance/db";
import { getCurrentUser } from "../../../lib/session";

import { calculateAvailableBalance } from "@attendance/attendance-core";
import { employmentAccessInclude, getEmploymentRoleKey } from "../../../lib/employment";
import { hasPermission } from "../../../lib/rbac";
import { canManagerActOnEmployeeRequest } from "../../../lib/resource-authorization";

const db = createPrismaClient(process.env.DATABASE_URL as string);

interface LeaveReqForDeduction {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  totalDays: number;
  leaveType: {
    isPaid: boolean;
    defaultAllocation?: number;
  };
}

async function applyLeaveBalanceDeduction(
  leaveReq: LeaveReqForDeduction,
  currentYear: number,
  overrideAllPaid: boolean,
  organizationId: string
) {
  let paidToDeduct: number;
  let unpaidToDeduct: number;

  if (leaveReq.leaveType.isPaid) {
    if (overrideAllPaid) {
      paidToDeduct = leaveReq.totalDays;
      unpaidToDeduct = 0;
    } else {
      const balance = await db.leaveBalance.findUnique({
        where: {
          employeeId_year_leaveTypeId: {
            employeeId: leaveReq.employeeId,
            year: currentYear,
            leaveTypeId: leaveReq.leaveTypeId
          }
        }
      });
      const availablePaid = balance
        ? calculateAvailableBalance(balance.accrued, balance.carriedOver, balance.used)
        : 0;
      paidToDeduct = Math.min(leaveReq.totalDays, Math.max(0, availablePaid));
      unpaidToDeduct = leaveReq.totalDays - paidToDeduct;
    }
  } else {
    paidToDeduct = 0;
    unpaidToDeduct = leaveReq.totalDays;
  }

  // 1. Update Paid Leave Balance
  if (paidToDeduct > 0) {
    const balance = await db.leaveBalance.findUnique({
      where: {
        employeeId_year_leaveTypeId: {
          employeeId: leaveReq.employeeId,
          year: currentYear,
          leaveTypeId: leaveReq.leaveTypeId
        }
      }
    });

    if (balance) {
      await db.leaveBalance.update({
        where: { id: balance.id },
        data: { used: balance.used + paidToDeduct }
      });
    } else {
      await db.leaveBalance.create({
        data: {
          employeeId: leaveReq.employeeId,
          year: currentYear,
          leaveTypeId: leaveReq.leaveTypeId,
          allocated: leaveReq.leaveType.defaultAllocation ?? 0,
          accrued: leaveReq.leaveType.defaultAllocation ?? 0,
          used: paidToDeduct,
          carriedOver: 0
        }
      });
    }
  }

  // 2. Update Unpaid Leave Balance if excess days exist
  if (unpaidToDeduct > 0) {
    let unpaidType = await db.leaveTypeConfig.findFirst({
      where: { organizationId, isPaid: false }
    });

    if (!unpaidType) {
      unpaidType = await db.leaveTypeConfig.create({
        data: {
          organizationId,
          code: "UNPAID",
          name: "Unpaid Leave",
          description: "Unpaid Leave / Loss of Pay (LOP)",
          isPaid: false,
          accrualFrequency: "ANNUALLY",
          defaultAllocation: 0,
          allowCarryForward: false,
          maxCarryForwardDays: 0
        }
      });
    }

    const unpaidBalance = await db.leaveBalance.findUnique({
      where: {
        employeeId_year_leaveTypeId: {
          employeeId: leaveReq.employeeId,
          year: currentYear,
          leaveTypeId: unpaidType.id
        }
      }
    });

    if (unpaidBalance) {
      await db.leaveBalance.update({
        where: { id: unpaidBalance.id },
        data: { used: unpaidBalance.used + unpaidToDeduct }
      });
    } else {
      await db.leaveBalance.create({
        data: {
          employeeId: leaveReq.employeeId,
          year: currentYear,
          leaveTypeId: unpaidType.id,
          allocated: 0,
          accrued: 0,
          used: unpaidToDeduct,
          carriedOver: 0
        }
      });
    }
  }

  // 3. Mark Leave Request as APPROVED with final paid/unpaid split
  await db.leaveRequest.update({
    where: { id: leaveReq.id },
    data: {
      status: "APPROVED",
      paidDays: paidToDeduct,
      unpaidDays: unpaidToDeduct
    }
  });
}

export async function approveLeaveRequestAction(
  requestId: string,
  overrideAllPaid: boolean = false
) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Unauthorized. Please sign in." };
  }

  try {
    const leaveReq = await db.leaveRequest.findUnique({
      where: { id: requestId },
      include: {
        employee: { include: employmentAccessInclude() },
        approvalSteps: { orderBy: { sequence: "asc" } },
        leaveType: true
      }
    });

    if (!leaveReq) {
      return { error: "Leave request not found." };
    }

    if (leaveReq.employeeId === user.employeeId) {
      return { error: "You cannot approve your own leave request." };
    }

    const requesterRole = getEmploymentRoleKey(leaveReq.employee);
    const isHRRequest = requesterRole === "hr";

    // RULE: HR staff requests can ONLY be approved by the Company Owner
    if (isHRRequest && user.roleName !== "owner") {
      return {
        error:
          "Unauthorized: Leave requests for HR staff can ONLY be approved by the Company Owner."
      };
    }

    if (leaveReq.status === "APPROVED" || leaveReq.status === "REJECTED") {
      return { error: `Request is already ${leaveReq.status.toLowerCase()}.` };
    }

    const currentYear = new Date(leaveReq.startDate).getFullYear();

    if (leaveReq.status === "PENDING_MANAGER") {
      const isOwnerOrHrForStage1 = user.roleName === "hr" || user.roleName === "owner";
      const isDirectSupervisor =
        user.roleName === "manager" &&
        (await db.reportingLine.findFirst({
          where: {
            subordinateEmploymentId: leaveReq.employeeId,
            supervisorEmploymentId: user.employeeId,
            validUntil: null
          }
        })) !== null;

      if (!isOwnerOrHrForStage1 && !isDirectSupervisor) {
        return { error: "You are not the direct supervisor for this employee's leave request." };
      }

      if (!(await canManagerActOnEmployeeRequest(user, leaveReq.employeeId))) {
        return {
          error:
            "Unauthorized: You can only approve leave requests submitted by your direct reports."
        };
      }

      const step1 = leaveReq.approvalSteps.find(
        (s: (typeof leaveReq.approvalSteps)[number]) => s.sequence === 1
      );
      if (step1) {
        await db.leaveApprovalStep.update({
          where: { id: step1.id },
          data: {
            status: "APPROVED",
            decidedAt: new Date(),
            approverEmployeeId: user.employeeId
          }
        });
      }

      // If approver is HR or Owner, finalize approval immediately!
      if (user.roleName === "hr" || user.roleName === "owner") {
        await applyLeaveBalanceDeduction(
          leaveReq,
          currentYear,
          overrideAllPaid,
          user.organizationId
        );
      } else {
        // If Manager approves, advance to PENDING_HR
        const hrEmployee = await findEmploymentByRole(user.organizationId, "hr");
        const ownerEmployee = hrEmployee
          ? null
          : await findEmploymentByRole(user.organizationId, "owner");
        const hrApproverId = hrEmployee?.id ?? ownerEmployee?.id ?? null;

        if (!hrApproverId) {
          return {
            error:
              "No HR or Owner is configured for this organization to complete Stage 2 approval."
          };
        }

        await db.leaveApprovalStep.create({
          data: {
            leaveRequestId: leaveReq.id,
            sequence: 2,
            approverEmployeeId: hrApproverId,
            approverKind: "HR",
            status: "PENDING"
          }
        });

        await db.leaveRequest.update({
          where: { id: requestId },
          data: { status: "PENDING_HR" }
        });
      }
    } else if (leaveReq.status === "PENDING_HR") {
      // Stage 2 approval by HR or Owner
      if (user.roleName !== "hr" && user.roleName !== "owner") {
        return { error: "HR or Owner role required for Stage 2 approval." };
      }

      const step2 =
        leaveReq.approvalSteps.find(
          (s: (typeof leaveReq.approvalSteps)[number]) => s.sequence === 2
        ) || leaveReq.approvalSteps[0];
      if (step2) {
        await db.leaveApprovalStep.update({
          where: { id: step2.id },
          data: {
            status: "APPROVED",
            decidedAt: new Date(),
            approverEmployeeId: user.employeeId
          }
        });
      }

      // Final Approval! Update Leave Balance
      await applyLeaveBalanceDeduction(leaveReq, currentYear, overrideAllPaid, user.organizationId);
    }

    revalidatePath("/employee-leave-requests");
    revalidatePath("/my-leave-requests");
    revalidatePath("/my-attendance");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to approve leave request.";
    console.error("Approve leave request error:", err);
    return { error: message };
  }
}

export async function rejectLeaveRequestAction(requestId: string, reason?: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Unauthorized." };
  }

  try {
    const leaveReq = await db.leaveRequest.findUnique({
      where: { id: requestId },
      include: { employee: { include: employmentAccessInclude() } }
    });
    if (!leaveReq) {
      return { error: "Leave request not found." };
    }

    if (leaveReq.employeeId === user.employeeId) {
      return { error: "You cannot reject your own leave request." };
    }

    const requesterRole = getEmploymentRoleKey(leaveReq.employee);
    const isHRRequest = requesterRole === "hr";

    if (isHRRequest && user.roleName !== "owner") {
      return {
        error:
          "Unauthorized: Leave requests for HR staff can ONLY be rejected by the Company Owner."
      };
    }

    const hasRejectionAccess =
      hasPermission(user, "approvals") ||
      user.roleName === "manager" ||
      user.roleName === "hr" ||
      user.roleName === "owner";
    if (!hasRejectionAccess) {
      return { error: "Manager or higher role required for rejection." };
    }

    if (!(await canManagerActOnEmployeeRequest(user, leaveReq.employeeId))) {
      return {
        error: "Unauthorized: You can only reject leave requests submitted by your direct reports."
      };
    }

    await db.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        rejectionReason: reason || "Rejected by approver"
      }
    });

    revalidatePath("/employee-leave-requests");
    revalidatePath("/my-leave-requests");
    revalidatePath("/my-attendance");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reject leave request.";
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
