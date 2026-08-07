import { getCurrentUser } from "../../../lib/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { createPrismaClient } from "@attendance/db";
import { logout } from "../../login/actions";
import { getEmployeeNotes } from "../../team-attendance/actions";

export const dynamic = "force-dynamic";

const db = createPrismaClient(process.env.DATABASE_URL as string);

interface NotesPageProps {
  searchParams: Promise<{ employeeId?: string }>;
}

export default async function EmployeeNotesHistoryPage({ searchParams }: NotesPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const resolvedParams = await searchParams;
  const employeeId = resolvedParams.employeeId;

  if (!employeeId) {
    redirect("/my-team" as Route);
  }

  // Fetch target employee details
  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    include: {
      role: true,
      supervisor: true
    }
  });

  if (!employee) {
    return (
      <main className="app-shell">
        <div className="banner" style={{ borderColor: "#ef4444" }}>
          <p>Employee not found.</p>
        </div>
        <Link href={"/my-team" as Route} className="back-link">
          ← Back to My Team
        </Link>
      </main>
    );
  }

  // Fetch all previous notes for this employee
  const notes = await getEmployeeNotes(employeeId);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
            <Link href={"/my-team" as Route} className="back-link">
              ← Back to My Team
            </Link>
          </div>
          <h1>Notes History: {employee.fullName}</h1>
          <p className="muted">
            Viewing previous notes for <strong>{employee.fullName}</strong> ({employee.role?.name || "Employee"})
          </p>
        </div>
        <form action={logout}>
          <button type="submit" className="logout-btn">
            Sign Out
          </button>
        </form>
      </header>

      {/* Employee Details Summary Card */}
      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          padding: "20px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >
        <div>
          <h2 style={{ margin: "0 0 4px 0", fontSize: "1.3rem", color: "#f8fafc" }}>
            {employee.fullName}
          </h2>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.9rem" }}>
            {employee.email} {employee.employeeCode ? `• Code: ${employee.employeeCode}` : ""}
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <span
            style={{
              background: "rgba(139, 92, 246, 0.2)",
              color: "#c084fc",
              border: "1px solid rgba(139, 92, 246, 0.4)",
              padding: "6px 14px",
              borderRadius: "10px",
              fontWeight: 600,
              fontSize: "0.85rem"
            }}
          >
            Total Notes: {notes.length}
          </span>
        </div>
      </div>

      {/* Full Page Column List View of Previous Notes */}
      <section className="panel" style={{ cursor: "default", display: "block", marginTop: "24px" }}>
        <h2 style={{ fontSize: "1.3rem", color: "#f1f5f9", marginBottom: "20px" }}>
          Previous Recorded Notes
        </h2>

        {notes.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", color: "#64748b" }}>
            <p style={{ fontSize: "1rem", margin: 0 }}>No previous notes recorded for {employee.fullName} yet.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {notes.map((note) => (
              <div
                key={note.id}
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid var(--border)",
                  borderRadius: "14px",
                  padding: "20px 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.2)"
                }}
              >
                {/* Note Header Line */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span className={`note-badge ${note.visibility.toLowerCase()}`}>
                      {note.visibility === "PRIVATE" ? "🔒 Personal Note" : "🌐 Public Note"}
                    </span>
                    <strong style={{ fontSize: "1rem", color: "#f8fafc" }}>
                      {note.authorName} <span style={{ fontSize: "0.85rem", color: "#94a3b8", fontWeight: 400 }}>({note.authorRole})</span>
                    </strong>
                  </div>

                  <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                    {new Date(note.createdAt).toLocaleString()}
                  </span>
                </div>

                {/* Note Content */}
                <div
                  style={{
                    background: "rgba(15, 23, 42, 0.5)",
                    border: "1px solid var(--border)",
                    borderRadius: "10px",
                    padding: "16px",
                    color: "#e2e8f0",
                    fontSize: "0.95rem",
                    lineHeight: "1.6",
                    whiteSpace: "pre-wrap"
                  }}
                >
                  {note.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
