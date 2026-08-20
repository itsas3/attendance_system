import { getCurrentUser } from "../../../lib/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createPrismaClient } from "@attendance/db";
import { logout } from "../../(auth)/login/actions";
import { PersonalRecordsForm } from "./personal-records-form";
import { ThemeSettingsSection } from "./theme-settings-section";

export const dynamic = "force-dynamic";

const db = createPrismaClient(process.env.DATABASE_URL as string);

export default async function PersonalRecordsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const employee = await db.employment.findUnique({
    where: { id: user.employeeId },
    include: { membership: { include: { person: { include: { userAccount: true } } } } }
  });

  if (!employee) {
    redirect("/login");
  }

  const initialData = {
    fullName: employee.membership.person.preferredName ?? employee.membership.person.legalName,
    email: employee.membership.person.userAccount?.loginEmail ?? "No portal account",
    employeeCode: employee.employeeCode,
    roleName: user.roleName,
    phone: employee.membership.person.phone,
    dateOfBirth: employee.membership.person.dateOfBirth?.toISOString().slice(0, 10) ?? null,
    gender: employee.membership.person.gender,
    maritalStatus: employee.membership.person.maritalStatus,
    currentAddress: employee.membership.person.currentAddress,
    permanentAddress: employee.membership.person.permanentAddress,
    emergencyContactName: employee.membership.person.emergencyContactName,
    emergencyContactPhone: employee.membership.person.emergencyContactPhone
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }}>
            <Link href="/" className="back-link">
              ← Home
            </Link>
          </div>
          <h1>My Personal Records</h1>
          <p className="muted">
            Manage your personal bio-data, contact details, and emergency information
          </p>
        </div>
        <form action={logout}>
          <button type="submit" className="logout-btn">
            Sign Out
          </button>
        </form>
      </header>

      <section style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
        <PersonalRecordsForm initialData={initialData} />
        <ThemeSettingsSection />
      </section>
    </main>
  );
}
