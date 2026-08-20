"use client";

import { useState, useTransition } from "react";
import { LeaveBalanceCards } from "./leave-balance-cards";
import { LeaveRequestModal } from "./leave-request-modal";
import { LeaveRequestTable } from "./leave-request-table";
import type {
  LeaveBalanceItem,
  LeaveRequestItem,
  LeaveStatusFilter,
  LeaveTypeOption
} from "./leave-request-types";

export type { LeaveBalanceItem, LeaveRequestItem, LeaveTypeOption } from "./leave-request-types";

interface LeaveRequestsClientProps {
  balances: LeaveBalanceItem[];
  activeTypes: LeaveTypeOption[];
  myRequests: LeaveRequestItem[];
  userRole?: string;
}

export function LeaveRequestsClient({
  balances,
  activeTypes,
  myRequests,
  userRole = "employee"
}: LeaveRequestsClientProps) {
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<LeaveStatusFilter>("all");
  const [isFiltering, startTransition] = useTransition();

  const handleFilterChange = (newFilter: LeaveStatusFilter) => {
    startTransition(() => {
      setFilter(newFilter);
    });
  };

  const filteredRequests = myRequests.filter((request) => {
    if (filter === "pending")
      return request.status === "PENDING_MANAGER" || request.status === "PENDING_HR";
    if (filter === "approved") return request.status === "APPROVED";
    if (filter === "cancelled")
      return request.status === "CANCELLED" || request.status === "REJECTED";
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <LeaveBalanceCards balances={balances} />
      <LeaveRequestTable
        requests={filteredRequests}
        allRequestCount={myRequests.length}
        filter={filter}
        userRole={userRole}
        isFiltering={isFiltering}
        onFilterChange={handleFilterChange}
        onCreate={() => setShowModal(true)}
      />
      {showModal && (
        <LeaveRequestModal
          balances={balances}
          leaveTypes={activeTypes}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
