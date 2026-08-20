"use server";

import { getCurrentUser } from "../../../lib/session";
import { hasPermission } from "../../../lib/rbac";
import { createPrismaClient } from "@attendance/db";
import { revalidatePath } from "next/cache";
import type { AttendanceCorrectionRequestState } from "./types";
import { employmentAccessInclude, getEmploymentRoleKey } from "../../../lib/employment";
import { canManagerActOnEmployeeRequest } from "../../../lib/resource-authorization";

const db = createPrismaClient(process.env.DATABASE_URL as string);

export async function submitManualRequest(
  _prevState: AttendanceCorrectionRequestState,
  formData: FormData
): Promise<AttendanceCorrectionRequestState> {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Unauthorized: Please log in to submit requests." };
  }

  if (user.roleName === "owner") {
    return { error: "Company Owners cannot submit manual attendance requests." };
  }

  const punchType = formData.get("punchType") as string;
  const dateStr = formData.get("date") as string;
  const timeStr = formData.get("time") as string;
  const reason = (formData.get("reason") as string)?.trim();

  if (!dateStr || !timeStr) {
    return { error: "Both date and time are required." };
  }

  if (!reason) {
    return { error: "Reason for manual request is required." };
  }

  const timestamp = new Date(`${dateStr}T${timeStr}:00`);

  if (isNaN(timestamp.getTime())) {
    return { error: "Invalid date or time format provided." };
  }

  const managerLine = await db.reportingLine.findFirst({
    where: {
      subordinateEmploymentId: user.employeeId,
      type: "PRIMARY",
      validUntil: null
    }
  });

  const isRegularEmployee = user.roleName === "employee";
  // Regular employees start at PENDING_MANAGER (Stage 1), managers/HR start at PENDING_HR (Stage 2)
  const initialStatus = isRegularEmployee && managerLine ? "PENDING_MANAGER" : "PENDING_HR";

  const punchLabel = punchType === "CHECK_OUT" ? "Check-Out" : "Check-In";
  const formattedReason = `[${punchLabel}] ${reason}`;

  await db.manualAttendanceRequest.create({
    data: {
      employeeId: user.employeeId,
      createdByUserAccountId: user.userAccountId,
      type: "ADD_SCAN",
      requestedTimestamp: timestamp,
      reason: formattedReason,
      status: initialStatus
    }
  });

  revalidatePath("/my-attendance-correction-requests");
  revalidatePath("/my-attendance");

  const stageLabel =
    initialStatus === "PENDING_MANAGER"
      ? "Sent to Manager for 1st approval."
      : "Sent to HR for approval.";
  return {
    success: `Manual ${punchLabel} request submitted successfully! ${stageLabel}`
  };
}

export async function approveRequest(requestId: string): Promise<AttendanceCorrectionRequestState> {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Unauthorized: Please log in." };
  }

  const request = await db.manualAttendanceRequest.findUnique({
    where: { id: requestId },
    include: {
      employee: {
        include: employmentAccessInclude()
      }
    }
  });

  if (!request) {
    return { error: "Request not found" };
  }

  if (request.status === "APPROVED") {
    return { error: "Request is already approved." };
  }

  if (request.status === "REJECTED") {
    return { error: "Request has been rejected." };
  }

  const requesterRole = getEmploymentRoleKey(request.employee);
  const isHRRequest = requesterRole === "hr";
  const isSelf =
    user.employeeId === request.employeeId || user.userAccountId === request.createdByUserAccountId;

  // RULE 1: HR requests can ONLY be approved by the Owner (HR cannot self-approve or approve fellow HR)
  if (isHRRequest) {
    if (user.roleName !== "owner") {
      return {
        error: "Unauthorized: Requests for HR staff can ONLY be approved by the Company Owner."
      };
    }
  }

  const userRole = user.roleName?.toLowerCase() || "";
  const isOwnerOrAdmin = userRole === "owner" || userRole === "admin";

  // RULE 2: No self-approval (except Owner / Admin)
  if (isSelf && !isOwnerOrAdmin) {
    return { error: "Unauthorized: You cannot approve your own manual attendance request." };
  }

  // Stage 1: Manager / Supervisor / Approver Stage (PENDING_MANAGER -> PENDING_HR)
  if (request.status === "PENDING_MANAGER") {
    if (userRole === "hr") {
      return {
        error:
          "Stage 1 Approval must be completed by the direct Manager first before HR can approve."
      };
    }

    const canApproveStage1 =
      hasPermission(user, "approvals") ||
      ["manager", "supervisor", "team_lead", "owner", "admin"].includes(userRole);

    if (!canApproveStage1) {
      return {
        error:
          "Unauthorized: 1st stage approval must be completed by an authorized Manager or Approver."
      };
    }

    if (!(await canManagerActOnEmployeeRequest(user, request.employeeId))) {
      return {
        error: "Unauthorized: You can only approve requests submitted by your direct reports."
      };
    }

    await db.manualAttendanceRequest.update({
      where: { id: requestId },
      data: { status: "PENDING_HR" }
    });

    revalidatePath("/employee-attendance-correction-requests");
    revalidatePath("/my-attendance-correction-requests");
    revalidatePath("/my-attendance");

    return { success: "1st Stage Approval completed! Request advanced to HR for final approval." };
  }

  // Stage 2: HR or Owner Approval (PENDING_HR -> APPROVED)
  if (request.status === "PENDING_HR") {
    if (isHRRequest && !isOwnerOrAdmin) {
      return { error: "Unauthorized: HR requests can only be approved by the Company Owner." };
    }

    const canApproveStage2 =
      userRole === "hr" || isOwnerOrAdmin || hasPermission(user, "company_attendance");

    if (!canApproveStage2) {
      return { error: "Unauthorized: Final stage approval must be completed by HR or Owner." };
    }

    await db.manualAttendanceRequest.update({
      where: { id: requestId },
      data: {
        status: "APPROVED",
        appliedAt: new Date()
      }
    });

    if (request.requestedTimestamp) {
      let device = await db.device.findFirst({
        where: { organizationId: user.organizationId, status: "ACTIVE" }
      });
      if (!device) {
        device = await db.device.findFirst({ where: { organizationId: user.organizationId } });
      }

      if (device) {
        await db.scanEvent.create({
          data: {
            organizationId: user.organizationId,
            deviceId: device.id,
            employeeId: request.employeeId,
            scannerTemplateId: 1,
            serverReceivedAt: request.requestedTimestamp,
            createdAt: request.requestedTimestamp
          }
        });
      }
    }

    revalidatePath("/employee-attendance-correction-requests");
    revalidatePath("/my-attendance-correction-requests");
    revalidatePath("/my-attendance");

    return { success: "Approval completed! Missing scan timestamp added to attendance table." };
  }

  return { error: "Invalid request state." };
}

export async function rejectRequest(requestId: string): Promise<AttendanceCorrectionRequestState> {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Unauthorized: Please log in." };
  }

  const request = await db.manualAttendanceRequest.findUnique({
    where: { id: requestId },
    include: {
      employee: {
        include: employmentAccessInclude()
      }
    }
  });

  if (!request) {
    return { error: "Request not found" };
  }

  const requesterRole = getEmploymentRoleKey(request.employee);
  const isHRRequest = requesterRole === "hr";
  const isSelf =
    user.employeeId === request.employeeId || user.userAccountId === request.createdByUserAccountId;

  if (isHRRequest && user.roleName !== "owner") {
    return {
      error: "Unauthorized: Requests for HR staff can ONLY be rejected by the Company Owner."
    };
  }

  if (isSelf && user.roleName !== "owner") {
    return { error: "Unauthorized: You cannot reject your own manual attendance request." };
  }

  // This function previously had no role gate at all (any authenticated employee could reject
  // any non-self, non-HR-target request). Restored to match approveRequest's gate.
  const canReject =
    hasPermission(user, "approvals") ||
    ["manager", "supervisor", "team_lead", "owner", "admin", "hr"].includes(
      user.roleName?.toLowerCase() ?? ""
    );

  if (!canReject) {
    return {
      error: "Unauthorized: Rejection must be completed by an authorized Manager, HR, or Approver."
    };
  }

  if (!(await canManagerActOnEmployeeRequest(user, request.employeeId))) {
    return {
      error: "Unauthorized: You can only reject requests submitted by your direct reports."
    };
  }

  await db.manualAttendanceRequest.update({
    where: { id: requestId },
    data: { status: "REJECTED" }
  });

  revalidatePath("/employee-attendance-correction-requests");
  revalidatePath("/my-attendance-correction-requests");
  revalidatePath("/my-attendance");

  return { success: "Request rejected." };
}

export async function deleteManualRequest(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized: Please log in.");
  }

  const id = formData.get("id") as string;
  if (!id) return;

  const request = await db.manualAttendanceRequest.findUnique({
    where: { id }
  });

  if (!request) return;

  const isOwnerOrHR = user.roleName === "owner" || user.roleName === "hr";
  const isOwnerOrCreator =
    request.employeeId === user.employeeId || request.createdByUserAccountId === user.userAccountId;

  if (!isOwnerOrHR && !isOwnerOrCreator) {
    throw new Error("Unauthorized: You can only delete your own submitted requests.");
  }

  await db.manualAttendanceRequest.delete({
    where: { id }
  });

  revalidatePath("/my-attendance-correction-requests");
  revalidatePath("/my-attendance");
  revalidatePath("/employee-attendance-correction-requests");
}
