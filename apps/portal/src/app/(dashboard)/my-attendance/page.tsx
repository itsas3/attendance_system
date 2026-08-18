import { redirect } from "next/navigation";
import { hasPermission } from "../../../lib/rbac";
import { requireCurrentUser } from "../../../lib/session";
import { ManualRequestsContainer } from "../my-attendance-correction-requests/manual-requests-container";
import { AttendanceHeader } from "./_components/attendance-header";
import { AttendanceSummary } from "./_components/attendance-summary";
import { getAttendancePageData } from "./queries";
import { WeeklyAttendanceView } from "./weekly-attendance-view";

export const dynamic = "force-dynamic";

export default async function MyAttendancePage({
  searchParams
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const user = await requireCurrentUser();
  if (!hasPermission(user, "my_attendance")) redirect("/");
  const params = await searchParams;
  const data = await getAttendancePageData(user.organizationId, user.employeeId, params.range);
  return (
    <main className="app-shell">
      <AttendanceHeader fullName={user.fullName} range={data.range} />
      <section>
        <ManualRequestsContainer />
      </section>
      <AttendanceSummary
        bannerTitle={data.bannerTitle}
        dateRange={data.dateRange}
        totalScans={data.totalScans}
        daysPresent={data.daysPresent}
        totalDays={data.weekdays.length}
      />
      <WeeklyAttendanceView weekdays={data.weekdays} />
    </main>
  );
}
