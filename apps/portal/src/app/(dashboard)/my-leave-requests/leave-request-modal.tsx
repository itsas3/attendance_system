"use client";

import { useState } from "react";
import { submitLeaveRequest } from "./actions";
import type { LeaveBalanceItem, LeaveTypeOption } from "./leave-request-types";

interface LeaveRequestModalProps {
  balances: LeaveBalanceItem[];
  leaveTypes: LeaveTypeOption[];
  onClose: () => void;
}

function LeaveRequestFields({
  balance,
  leaveTypes,
  leaveTypeId,
  setLeaveTypeId,
  startDate,
  endDate,
  setStartDate,
  setEndDate
}: {
  balance?: LeaveBalanceItem;
  leaveTypes: LeaveTypeOption[];
  leaveTypeId: string;
  setLeaveTypeId: (value: string) => void;
  startDate: string;
  endDate: string;
  setStartDate: (value: string) => void;
  setEndDate: (value: string) => void;
}) {
  return (
    <>
      <label>
        Leave Category *
        <select
          name="leaveTypeId"
          value={leaveTypeId}
          onChange={(event) => setLeaveTypeId(event.target.value)}
          required
        >
          {leaveTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name} ({type.isPaid ? "Paid" : "Unpaid"})
            </option>
          ))}
        </select>
        {balance?.isPaid && (
          <small className="muted">Available balance: {balance.available.toFixed(1)} days</small>
        )}
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label>
          Start Date *
          <input
            type="date"
            name="startDate"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            required
          />
        </label>
        <label>
          End Date *
          <input
            type="date"
            name="endDate"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            required
          />
        </label>
      </div>
      {balance?.isPaid && startDate && endDate && (
        <p className="muted" style={{ padding: 10, background: "rgba(96,165,250,.1)" }}>
          Excess days beyond your {balance.available.toFixed(1)}-day balance will be sent to HR as
          unpaid leave for review.
        </p>
      )}
      <label>
        Reason *
        <textarea
          name="reason"
          required
          rows={3}
          placeholder="Provide details for your leave request..."
        />
      </label>
    </>
  );
}

export function LeaveRequestModal({ balances, leaveTypes, onClose }: LeaveRequestModalProps) {
  const [leaveTypeId, setLeaveTypeId] = useState(leaveTypes[0]?.id ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const balance = balances.find((item) => item.leaveTypeId === leaveTypeId);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await submitLeaveRequest(new FormData(event.currentTarget));
    setSubmitting(false);
    if (result?.error) setError(result.error);
    else onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: "500px" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Submit Leave Application</h2>
          <button type="button" className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        {error && <p className="error">{error}</p>}
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "14px" }}
        >
          <LeaveRequestFields
            balance={balance}
            leaveTypes={leaveTypes}
            leaveTypeId={leaveTypeId}
            setLeaveTypeId={setLeaveTypeId}
            startDate={startDate}
            endDate={endDate}
            setStartDate={setStartDate}
            setEndDate={setEndDate}
          />
          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <button type="button" className="back-link" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? (
                <>
                  <span className="spinner spinner-sm" aria-hidden="true" />
                  <span>Submitting...</span>
                </>
              ) : (
                "Submit Application"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
