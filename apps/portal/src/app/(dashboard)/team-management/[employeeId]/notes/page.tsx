import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { hasAccess, hasPermission } from "../../../../../lib/rbac";
import { requireCurrentUser } from "../../../../../lib/session";
import { NotesHistoryView } from "./_components/notes-history-view";
import { getNotesHistoryData } from "./queries";

export const dynamic = "force-dynamic";

export default async function EmployeeNotesHistoryPage({
  params
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const user = await requireCurrentUser();
  if (!hasAccess(user, ["my_team", "company_attendance", "team_attendance"]))
    redirect("/team-management");
  const { employeeId } = await params;
  const data = await getNotesHistoryData(
    employeeId,
    user.organizationId,
    user.employeeId,
    hasPermission(user, "company_attendance")
  );
  if (!data.employee) notFound();
  return (
    <main className="app-shell">
      <NotesHistoryView employee={data.employee} notes={data.notes} />
      <Link href="/team-management" className="back-link">
        ← Back to My Team
      </Link>
    </main>
  );
}
