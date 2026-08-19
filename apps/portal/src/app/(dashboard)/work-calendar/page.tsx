import { redirect } from "next/navigation";
import { hasAnyPermission } from "../../../lib/rbac";
import { requireCurrentUser } from "../../../lib/session";
import { HolidayForm } from "./_components/holiday-form";
import { HolidaysTable } from "./_components/holidays-table";
import { OffDaysForm } from "./_components/off-days-form";
import { WorkCalendarHeader } from "./_components/work-calendar-header";
import { getWorkCalendarData } from "./queries";

export const dynamic = "force-dynamic";

export default async function WorkCalendarPage() {
  const user = await requireCurrentUser();
  if (!hasAnyPermission(user, ["company_attendance", "reports", "enrollment"])) redirect("/");
  const data = await getWorkCalendarData(user.organizationId);
  return (
    <main className="app-shell">
      <WorkCalendarHeader />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))",
          gap: 24
        }}
      >
        <OffDaysForm
          offDays={data.offDays}
          offDaysType={data.offDaysType}
          offDaysText={data.offDaysText}
        />
        <HolidayForm />
      </div>
      <HolidaysTable holidays={data.holidays} />
    </main>
  );
}
