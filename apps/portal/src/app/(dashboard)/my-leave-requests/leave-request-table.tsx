"use client";

import { getPendingHRStatusText } from "../../../lib/rbac";
import { cancelLeaveRequest } from "./actions";
import type { LeaveRequestItem, LeaveStatusFilter } from "./leave-request-types";

const statusLabels: Partial<Record<LeaveRequestItem["status"], string>> = {
  PENDING_MANAGER: "Pending Manager",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled"
};

interface LeaveRequestTableProps {
  requests: LeaveRequestItem[];
  allRequestCount: number;
  filter: LeaveStatusFilter;
  userRole: string;
  isFiltering?: boolean;
  onFilterChange: (filter: LeaveStatusFilter) => void;
  onCreate: () => void;
}

function LeaveRequestRow({
  request,
  userRole,
  onCancel
}: {
  request: LeaveRequestItem;
  userRole: string;
  onCancel: () => void;
}) {
  const pending = request.status === "PENDING_MANAGER" || request.status === "PENDING_HR";
  const label =
    request.status === "PENDING_HR"
      ? getPendingHRStatusText(userRole, userRole, true)
      : statusLabels[request.status];
  return (
    <tr>
      <td>
        <strong>{request.leaveTypeName}</strong>
      </td>
      <td>
        {request.startDateStr} – {request.endDateStr}
      </td>
      <td>
        {request.totalDays} day(s)
        {request.status === "APPROVED" && (request.unpaidDays ?? 0) > 0 && (
          <div className="muted">
            {request.paidDays} paid / {request.unpaidDays} unpaid
          </div>
        )}
      </td>
      <td>
        {request.reason}
        {request.rejectionReason && <div className="error">{request.rejectionReason}</div>}
      </td>
      <td>
        <span className={`status-badge status-${request.status.toLowerCase().replace("_", "-")}`}>
          {label}
        </span>
      </td>
      <td>
        {pending && (
          <button type="button" className="danger-btn" onClick={onCancel}>
            Cancel
          </button>
        )}
      </td>
    </tr>
  );
}

export function LeaveRequestTable({
  requests,
  allRequestCount,
  filter,
  userRole,
  isFiltering,
  onFilterChange,
  onCreate
}: LeaveRequestTableProps) {
  const handleCancel = async (id: string) => {
    if (confirm("Are you sure you want to cancel this leave request?"))
      await cancelLeaveRequest(id);
  };

  return (
    <section className="panel" style={{ cursor: "default" }}>
      <div
        style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}
      >
        <div>
          <h2>My Leave Applications ({requests.length})</h2>
          <p className="muted">Track your applications and approval status.</p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          {isFiltering && (
            <span
              className="spinner spinner-sm"
              style={{ borderColor: "rgba(96,165,250,.4) transparent transparent transparent" }}
              aria-label="Filtering"
            />
          )}
          <select
            value={filter}
            onChange={(event) => onFilterChange(event.target.value as LeaveStatusFilter)}
            aria-label="Status filter"
          >
            <option value="all">All ({allRequestCount})</option>
            <option value="pending">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="cancelled">Cancelled / Rejected</option>
          </select>
          <button type="button" className="btn-primary" onClick={onCreate}>
            + Apply for Leave
          </button>
        </div>
      </div>
      {requests.length === 0 ? (
        <p className="muted">No leave requests match this filter.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr>
                <th>Leave Category</th>
                <th>Date Range</th>
                <th>Working Days</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <LeaveRequestRow
                  key={request.id}
                  request={request}
                  userRole={userRole}
                  onCancel={() => void handleCancel(request.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
