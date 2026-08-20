"use client";

import { useActionState, useRef, useEffect } from "react";
import { submitManualRequest } from "./actions";
import type { AttendanceCorrectionRequestState } from "./types";

interface ManualRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const initialState: AttendanceCorrectionRequestState = {};

function ManualRequestFormFields() {
  return (
    <>
      <div className="form-group">
        <label htmlFor="punchType">Punch Type *</label>
        <select
          id="punchType"
          name="punchType"
          className="form-control"
          defaultValue="CHECK_IN"
          required
        >
          <option value="CHECK_IN">Check-In (In Punch)</option>
          <option value="CHECK_OUT">Check-Out (Out Punch)</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="date">Date *</label>
        <input id="date" name="date" type="date" className="form-control" required />
      </div>

      <div className="form-group">
        <label htmlFor="time">Time *</label>
        <input
          id="time"
          name="time"
          type="time"
          className="form-control"
          defaultValue="09:00"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="reason">Reason *</label>
        <textarea
          id="reason"
          name="reason"
          rows={3}
          className="form-control"
          placeholder="e.g., Scanner offline / Forgot fingerprint scan at entry"
          required
        />
      </div>
    </>
  );
}

export function ManualRequestModal({ isOpen, onClose }: ManualRequestModalProps) {
  const [state, formAction, isPending] = useActionState(submitManualRequest, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      const timer = setTimeout(() => {
        onClose();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [state.success, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Submit Manual Request</h2>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
          Request a missing attendance punch. Your request will be sent to HR for approval.
        </p>

        {state.error && (
          <div className="alert-error" role="alert">
            ⚠️ {state.error}
          </div>
        )}
        {state.success && (
          <div className="alert-success" role="status">
            ✅ {state.success}
          </div>
        )}

        <form
          ref={formRef}
          action={formAction}
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          <ManualRequestFormFields />
          <div
            style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "12px" }}
          >
            <button type="button" className="logout-btn" onClick={onClose} disabled={isPending}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isPending}>
              {isPending ? (
                <>
                  <span className="spinner spinner-sm" aria-hidden="true" />
                  <span>Submitting...</span>
                </>
              ) : (
                "Submit Request"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
