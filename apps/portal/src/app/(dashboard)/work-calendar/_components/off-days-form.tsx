"use client";

import { useActionState } from "react";
import { updateWeeklyOffDays } from "../actions";
import { weekdayNames } from "../constants";

const policies = [
  {
    value: "sun_only",
    title: "Sunday Only",
    description: "Mon–Sat workdays (6 days work / 1 day off)"
  },
  {
    value: "sat_sun",
    title: "Saturday & Sunday",
    description: "Mon–Fri workdays (5 days work / 2 days off)"
  },
  {
    value: "fri_sat",
    title: "Friday & Saturday",
    description: "Sun–Thu workdays (Middle East policy)"
  },
  { value: "fri_only", title: "Friday Only", description: "Sat–Thu workdays" }
];

function PolicyOption({
  policy,
  selected
}: {
  policy: (typeof policies)[number];
  selected: string;
}) {
  return (
    <label
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        padding: 12,
        borderRadius: 8,
        background: "rgba(255,255,255,.04)",
        cursor: "pointer"
      }}
    >
      <input
        type="radio"
        name="offDaysType"
        value={policy.value}
        defaultChecked={selected === policy.value}
      />
      <div>
        <strong>{policy.title}</strong> – {policy.description}
      </div>
    </label>
  );
}

function CustomPolicy({ offDays, selected }: { offDays: number[]; selected: string }) {
  return (
    <label
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        padding: 12,
        borderRadius: 8,
        background: "rgba(255,255,255,.04)",
        cursor: "pointer"
      }}
    >
      <input
        type="radio"
        name="offDaysType"
        value="custom"
        defaultChecked={selected === "custom"}
      />
      <div>
        <strong>Custom Off-Days</strong>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
          {weekdayNames.map((day, idx) => (
            <label
              key={day}
              style={{
                display: "inline-flex",
                gap: 6,
                alignItems: "center",
                fontSize: ".9rem"
              }}
            >
              <input
                type="checkbox"
                name="customOffDays"
                value={idx}
                defaultChecked={offDays.includes(idx)}
              />
              {day}
            </label>
          ))}
        </div>
      </div>
    </label>
  );
}

export function OffDaysForm({
  offDays,
  offDaysType,
  offDaysText
}: {
  offDays: number[];
  offDaysType: string;
  offDaysText: string;
}) {
  const [, formAction, isPending] = useActionState(async (_: unknown, formData: FormData) => {
    await updateWeeklyOffDays(formData);
    return null;
  }, null);

  return (
    <section className="panel" style={{ cursor: "default" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h2>Weekly Off-Days Policy</h2>
        <span style={{ color: "#60a5fa" }}>Active: {offDaysText || "None"}</span>
      </div>
      <p className="muted">
        Employees without scans on off-days are marked as <strong>WEEKEND</strong> instead of{" "}
        <strong>ABSENT</strong>.
      </p>
      <form
        action={formAction}
        style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 20 }}
      >
        {policies.map((policy) => (
          <PolicyOption key={policy.value} policy={policy} selected={offDaysType} />
        ))}
        <CustomPolicy offDays={offDays} selected={offDaysType} />
        <button type="submit" className="btn-primary" disabled={isPending}>
          {isPending ? (
            <>
              <span className="spinner spinner-sm" aria-hidden="true" />
              <span>Saving Policy...</span>
            </>
          ) : (
            "Save Workday Policy"
          )}
        </button>
      </form>
    </section>
  );
}
