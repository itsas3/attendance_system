"use client";

import { useActionState } from "react";
import { createHoliday } from "../actions";

export function HolidayForm() {
  const [, formAction, isPending] = useActionState(async (_: unknown, formData: FormData) => {
    await createHoliday(formData);
    return null;
  }, null);

  return (
    <section className="panel" style={{ cursor: "default" }}>
      <h2>Add Official Company Holiday</h2>
      <p className="muted">
        Employees without scans on holiday dates are marked as <strong>HOLIDAY</strong>.
      </p>
      <form
        action={formAction}
        style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 20 }}
      >
        <label>
          Holiday Name
          <input name="name" placeholder="e.g. Eid-ul-Fitr, New Year's Day" required />
        </label>
        <label>
          Date
          <input name="date" type="date" required />
        </label>
        <label>
          Description (Optional)
          <input name="description" placeholder="Short note or description" />
        </label>
        <button type="submit" className="btn-primary" disabled={isPending}>
          {isPending ? (
            <>
              <span className="spinner spinner-sm" aria-hidden="true" />
              <span>Adding Holiday...</span>
            </>
          ) : (
            "+ Add Holiday Date"
          )}
        </button>
      </form>
    </section>
  );
}
