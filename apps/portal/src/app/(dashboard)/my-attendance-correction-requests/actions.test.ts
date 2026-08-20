import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as AttendanceDb from "@attendance/db";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  db: {
    manualAttendanceRequest: { findUnique: vi.fn(), update: vi.fn() },
    reportingLine: { findFirst: vi.fn() },
    device: { findFirst: vi.fn() },
    scanEvent: { create: vi.fn() }
  }
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@attendance/db", async (importOriginal) => {
  const actual: typeof AttendanceDb = await importOriginal();
  return { ...actual, createPrismaClient: () => mocks.db };
});
vi.mock("../../../lib/session", () => ({ getCurrentUser: mocks.getCurrentUser }));

import { approveRequest, rejectRequest } from "./actions";

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

function pendingManagerRequest() {
  return {
    id: "request-1",
    employeeId: otherTeamEmployee.id,
    createdByUserAccountId: "account-other-team",
    status: "PENDING_MANAGER",
    requestedTimestamp: new Date("2026-08-01T09:00:00Z"),
    employee: otherTeamEmployee
  };
}

describe("attendance correction approval — resource-scoped authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue(manager);
  });

  it("rejects approveRequest when the employee does not report to the acting manager", async () => {
    mocks.db.manualAttendanceRequest.findUnique.mockResolvedValue(pendingManagerRequest());
    // No reporting line found between Manager A and the other team's employee.
    mocks.db.reportingLine.findFirst.mockResolvedValue(null);

    const result = await approveRequest("request-1");

    expect(result).toEqual({
      error: "Unauthorized: You can only approve requests submitted by your direct reports."
    });
    expect(mocks.db.manualAttendanceRequest.update).not.toHaveBeenCalled();
  });

  it("allows approveRequest when the employee is confirmed as a direct report", async () => {
    mocks.db.manualAttendanceRequest.findUnique.mockResolvedValue(pendingManagerRequest());
    mocks.db.reportingLine.findFirst.mockResolvedValue({
      id: "line-1",
      supervisorEmploymentId: manager.employeeId,
      subordinateEmploymentId: otherTeamEmployee.id
    });
    mocks.db.manualAttendanceRequest.update.mockResolvedValue({});

    const result = await approveRequest("request-1");

    expect(result).toEqual({
      success: "1st Stage Approval completed! Request advanced to HR for final approval."
    });
    expect(mocks.db.manualAttendanceRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "request-1" }, data: { status: "PENDING_HR" } })
    );
  });

  it("rejects rejectRequest when the employee does not report to the acting manager", async () => {
    mocks.db.manualAttendanceRequest.findUnique.mockResolvedValue(pendingManagerRequest());
    mocks.db.reportingLine.findFirst.mockResolvedValue(null);

    const result = await rejectRequest("request-1");

    expect(result).toEqual({
      error: "Unauthorized: You can only reject requests submitted by your direct reports."
    });
    expect(mocks.db.manualAttendanceRequest.update).not.toHaveBeenCalled();
  });

  it("blocks a plain employee role from rejecting someone else's request outright", async () => {
    mocks.getCurrentUser.mockResolvedValue({ ...manager, roleName: "employee" });
    mocks.db.manualAttendanceRequest.findUnique.mockResolvedValue(pendingManagerRequest());

    const result = await rejectRequest("request-1");

    expect(result).toEqual({
      error: "Unauthorized: Rejection must be completed by an authorized Manager, HR, or Approver."
    });
    expect(mocks.db.reportingLine.findFirst).not.toHaveBeenCalled();
    expect(mocks.db.manualAttendanceRequest.update).not.toHaveBeenCalled();
  });
});
