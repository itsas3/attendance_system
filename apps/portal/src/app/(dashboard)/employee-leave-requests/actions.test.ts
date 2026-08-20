import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as AttendanceDb from "@attendance/db";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  db: {
    leaveRequest: { findUnique: vi.fn(), update: vi.fn() },
    leaveApprovalStep: { update: vi.fn(), create: vi.fn() },
    leaveBalance: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    leaveTypeConfig: { findFirst: vi.fn(), create: vi.fn() },
    employment: { findFirst: vi.fn() },
    reportingLine: { findFirst: vi.fn() }
  }
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@attendance/db", async (importOriginal) => {
  const actual: typeof AttendanceDb = await importOriginal();
  return { ...actual, createPrismaClient: () => mocks.db };
});
vi.mock("../../../lib/session", () => ({ getCurrentUser: mocks.getCurrentUser }));

import { approveLeaveRequestAction, rejectLeaveRequestAction } from "./actions";

const manager = {
  userAccountId: "account-manager-a",
  authVersion: 1,
  employeeId: "employment-manager-a",
  membershipId: "membership-manager-a",
  organizationId: "organization-1",
  email: "managera@test.com",
  fullName: "Manager A",
  roleName: "manager",
  roleKeys: ["manager"],
  permissions: []
};

// An employee who reports to a DIFFERENT manager (Manager B), not the manager making the call.
const otherTeamEmployee = {
  id: "employment-other-team",
  membership: {
    person: { legalName: "Other Team Employee", preferredName: null, userAccount: null },
    roleAssignments: [{ role: { key: "employee" } }]
  },
  assignments: []
};

function pendingManagerLeaveRequest() {
  return {
    id: "leave-1",
    employeeId: otherTeamEmployee.id,
    status: "PENDING_MANAGER",
    startDate: new Date("2026-09-01T00:00:00Z"),
    endDate: new Date("2026-09-03T00:00:00Z"),
    totalDays: 3,
    leaveTypeId: "leave-type-annual",
    employee: otherTeamEmployee,
    approvalSteps: [{ id: "step-1", sequence: 1, status: "PENDING" }],
    leaveType: { isPaid: true, defaultAllocation: 14 }
  };
}

describe("leave request approval — resource-scoped authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue(manager);
  });

  it("rejects approveLeaveRequestAction when the employee does not report to the acting manager", async () => {
    mocks.db.leaveRequest.findUnique.mockResolvedValue(pendingManagerLeaveRequest());
    // No reporting line found between Manager A and the other team's employee.
    mocks.db.reportingLine.findFirst.mockResolvedValue(null);

    const result = await approveLeaveRequestAction("leave-1");

    expect(result).toEqual({
      error: "You are not the direct supervisor for this employee's leave request."
    });
    expect(mocks.db.leaveApprovalStep.update).not.toHaveBeenCalled();
    expect(mocks.db.leaveRequest.update).not.toHaveBeenCalled();
  });

  it("allows approveLeaveRequestAction and advances to PENDING_HR when the employee is a confirmed direct report", async () => {
    mocks.db.leaveRequest.findUnique.mockResolvedValue(pendingManagerLeaveRequest());
    mocks.db.reportingLine.findFirst.mockResolvedValue({
      id: "line-1",
      supervisorEmploymentId: manager.employeeId,
      subordinateEmploymentId: otherTeamEmployee.id
    });
    mocks.db.leaveApprovalStep.update.mockResolvedValue({});
    mocks.db.employment.findFirst.mockResolvedValue({ id: "employment-hr-1" });
    mocks.db.leaveApprovalStep.create.mockResolvedValue({});
    mocks.db.leaveRequest.update.mockResolvedValue({});

    const result = await approveLeaveRequestAction("leave-1");

    expect(result).toEqual({ success: true });
    expect(mocks.db.leaveApprovalStep.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "step-1" } })
    );
    expect(mocks.db.leaveRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "leave-1" }, data: { status: "PENDING_HR" } })
    );
  });

  it("rejects rejectLeaveRequestAction when the employee does not report to the acting manager", async () => {
    mocks.db.leaveRequest.findUnique.mockResolvedValue(pendingManagerLeaveRequest());
    mocks.db.reportingLine.findFirst.mockResolvedValue(null);

    const result = await rejectLeaveRequestAction("leave-1");

    expect(result).toEqual({
      error: "Unauthorized: You can only reject leave requests submitted by your direct reports."
    });
    expect(mocks.db.leaveRequest.update).not.toHaveBeenCalled();
  });

  it("blocks a plain employee role from rejecting someone else's leave request outright", async () => {
    mocks.getCurrentUser.mockResolvedValue({ ...manager, roleName: "employee" });
    mocks.db.leaveRequest.findUnique.mockResolvedValue(pendingManagerLeaveRequest());

    const result = await rejectLeaveRequestAction("leave-1");

    expect(result).toEqual({ error: "Manager or higher role required for rejection." });
    expect(mocks.db.reportingLine.findFirst).not.toHaveBeenCalled();
    expect(mocks.db.leaveRequest.update).not.toHaveBeenCalled();
  });

  it("allows an approvals-permission reviewer to reject without a direct-report relationship", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      ...manager,
      roleName: "org_admin",
      roleKeys: ["org_admin"],
      permissions: ["approvals"]
    });
    mocks.db.leaveRequest.findUnique.mockResolvedValue(pendingManagerLeaveRequest());
    mocks.db.leaveRequest.update.mockResolvedValue({});

    const result = await rejectLeaveRequestAction("leave-1");

    expect(result).toEqual({ success: true });
    expect(mocks.db.reportingLine.findFirst).not.toHaveBeenCalled();
    expect(mocks.db.leaveRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "leave-1" },
        data: { status: "REJECTED", rejectionReason: "Rejected by approver" }
      })
    );
  });

  it("allows rejectLeaveRequestAction when the employee is a confirmed direct report", async () => {
    mocks.db.leaveRequest.findUnique.mockResolvedValue(pendingManagerLeaveRequest());
    mocks.db.reportingLine.findFirst.mockResolvedValue({
      id: "line-1",
      supervisorEmploymentId: manager.employeeId,
      subordinateEmploymentId: otherTeamEmployee.id
    });
    mocks.db.leaveRequest.update.mockResolvedValue({});

    const result = await rejectLeaveRequestAction("leave-1", "Not enough coverage");

    expect(result).toEqual({ success: true });
    expect(mocks.db.leaveRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "leave-1" },
        data: { status: "REJECTED", rejectionReason: "Not enough coverage" }
      })
    );
  });
});
