"use client";

import { useActionState } from "react";
import { updatePersonalRecords, type PersonalRecordsState } from "./actions";

type PersonalRecordsData = {
  fullName: string;
  email: string;
  employeeCode: string | null;
  roleName: string;
  phone: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  maritalStatus: string | null;
  currentAddress: string | null;
  permanentAddress: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
};

const initialState: PersonalRecordsState = {};
const readOnlyStyle = {
  opacity: 0.85,
  cursor: "not-allowed",
  background: "var(--background-secondary)"
};

function StaffProfileFields({ data }: { data: PersonalRecordsData }) {
  const fields = [
    ["Full Name", data.fullName, "text"],
    ["Email Address", data.email, "email"],
    ["Employee Code", data.employeeCode || "N/A", "text"],
    ["Assigned Role", data.roleName, "text"]
  ];
  return (
    <section
      id="staff-profile"
      style={{ borderBottom: "1px solid var(--border)", paddingBottom: "24px" }}
    >
      <h3
        style={{
          color: "var(--accent)",
          margin: "0 0 16px 0",
          fontSize: "1.2rem",
          fontWeight: 700
        }}
      >
        Staff Profile (Read-only)
      </h3>
      <div className="form-grid">
        {fields.map(([label, value, type]) => (
          <div className="form-group" key={label}>
            <label>{label}</label>
            <input
              type={type}
              className="form-control"
              value={value}
              readOnly
              style={readOnlyStyle}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function BioDataFields({ data }: { data: PersonalRecordsData }) {
  return (
    <section
      id="bio-data"
      style={{ borderBottom: "1px solid var(--border)", paddingBottom: "24px" }}
    >
      <h3
        style={{
          color: "var(--accent)",
          margin: "0 0 16px 0",
          fontSize: "1.2rem",
          fontWeight: 700
        }}
      >
        Bio-data
      </h3>
      <div className="form-grid">
        <div className="form-group">
          <label htmlFor="dateOfBirth">Date of Birth</label>
          <input
            id="dateOfBirth"
            name="dateOfBirth"
            type="date"
            className="form-control"
            defaultValue={data.dateOfBirth || ""}
          />
        </div>
        <div className="form-group">
          <label htmlFor="gender">Gender</label>
          <select
            id="gender"
            name="gender"
            className="form-control"
            defaultValue={data.gender || ""}
          >
            <option value="">Select Gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="maritalStatus">Marital Status</label>
          <select
            id="maritalStatus"
            name="maritalStatus"
            className="form-control"
            defaultValue={data.maritalStatus || ""}
          >
            <option value="">Select Status</option>
            <option value="single">Single</option>
            <option value="married">Married</option>
            <option value="divorced">Divorced</option>
            <option value="widowed">Widowed</option>
          </select>
        </div>
      </div>
    </section>
  );
}

function ContactFields({ data }: { data: PersonalRecordsData }) {
  return (
    <section
      id="contact-details"
      style={{ borderBottom: "1px solid var(--border)", paddingBottom: "24px" }}
    >
      <h3
        style={{
          color: "var(--accent)",
          margin: "0 0 16px 0",
          fontSize: "1.2rem",
          fontWeight: 700
        }}
      >
        Contact Details
      </h3>
      <div className="form-grid">
        <div className="form-group">
          <label htmlFor="phone">Phone Number</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            className="form-control"
            defaultValue={data.phone || ""}
          />
        </div>
        <div className="form-group">
          <label htmlFor="currentAddress">Current Address</label>
          <input
            id="currentAddress"
            name="currentAddress"
            className="form-control"
            defaultValue={data.currentAddress || ""}
          />
        </div>
        <div className="form-group">
          <label htmlFor="permanentAddress">Permanent Address</label>
          <input
            id="permanentAddress"
            name="permanentAddress"
            className="form-control"
            defaultValue={data.permanentAddress || ""}
          />
        </div>
      </div>
    </section>
  );
}

function EmergencyContactFields({ data }: { data: PersonalRecordsData }) {
  return (
    <section id="emergency-contact">
      <h3
        style={{
          color: "var(--accent)",
          margin: "0 0 16px 0",
          fontSize: "1.2rem",
          fontWeight: 700
        }}
      >
        Emergency Contact Information
      </h3>
      <div className="form-grid">
        <div className="form-group">
          <label htmlFor="emergencyContactName">Contact Name</label>
          <input
            id="emergencyContactName"
            name="emergencyContactName"
            className="form-control"
            defaultValue={data.emergencyContactName || ""}
          />
        </div>
        <div className="form-group">
          <label htmlFor="emergencyContactPhone">Contact Phone</label>
          <input
            id="emergencyContactPhone"
            name="emergencyContactPhone"
            type="tel"
            className="form-control"
            defaultValue={data.emergencyContactPhone || ""}
          />
        </div>
      </div>
    </section>
  );
}

export function PersonalRecordsForm({ initialData }: { initialData: PersonalRecordsData }) {
  const [state, formAction, isPending] = useActionState(updatePersonalRecords, initialState);

  return (
    <form action={formAction} className="form-panel" style={{ gap: "28px" }}>
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
      <StaffProfileFields data={initialData} />
      <BioDataFields data={initialData} />
      <ContactFields data={initialData} />
      <EmergencyContactFields data={initialData} />
      <button type="submit" className="btn-primary" disabled={isPending}>
        {isPending ? (
          <>
            <span className="spinner spinner-sm" aria-hidden="true" />
            <span>Saving changes...</span>
          </>
        ) : (
          "Save Personal Records"
        )}
      </button>
    </form>
  );
}
