import { UnauthorizedView } from "../../../components/unauthorized-view";
import { requireCurrentUser } from "../../../lib/session";
import { AttendanceMetricCards } from "./_components/attendance-metric-cards";
import { CompanyAttendanceHeader } from "./_components/company-attendance-header";
import { PunchStream } from "./_components/punch-stream";
import { RoleBreakdown } from "./_components/role-breakdown";
import { resolveCompanyAttendanceFilter } from "./_lib/filters";
import { calculateAttendanceMetrics, getRoleBreakdown } from "./_lib/metrics";
import { canViewCompanyAttendance } from "./permissions";
import { getCompanyAttendanceData } from "./queries";

export const dynamic = "force-dynamic";

type CompanyAttendancePageProps = {
  searchParams: Promise<{ range?: string; employeeId?: string }>;
};

export default async function CompanyAttendancePage({ searchParams }: CompanyAttendancePageProps) {
  const user = await requireCurrentUser();

  if (!canViewCompanyAttendance(user)) {
    return <UnauthorizedView featureName="Company Attendance Metrics" />;
  }

  const filter = resolveCompanyAttendanceFilter(await searchParams);
  const { activeEmployees, activeDevicesCount, periodScans } = await getCompanyAttendanceData(
    user.organizationId,
    filter
  );
  const selectedEmployee = activeEmployees.find(({ id }) => id === filter.selectedEmployeeId);
  const metrics = calculateAttendanceMetrics(activeEmployees, periodScans, selectedEmployee);
  const roleBreakdown = getRoleBreakdown(activeEmployees);
  const subtitle = selectedEmployee
    ? `Filter: ${selectedEmployee.fullName} (${filter.rangeTitle})`
    : `Filter: All Staff (${filter.rangeTitle})`;
  const simpleEmployees = activeEmployees.map(({ id, fullName, roleName }) => ({
    id,
    fullName,
    roleName
  }));

  return (
    <main className="app-shell">
      <CompanyAttendanceHeader
        employees={simpleEmployees}
        range={filter.range}
        selectedEmployeeId={filter.selectedEmployeeId}
        subtitle={subtitle}
      />
      <AttendanceMetricCards
        activeDevicesCount={activeDevicesCount}
        metrics={metrics}
        scanCount={periodScans.length}
        selectedEmployeeName={selectedEmployee?.fullName}
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "24px"
        }}
      >
        <RoleBreakdown breakdown={roleBreakdown} total={activeEmployees.length} />
        <PunchStream
          rangeTitle={filter.rangeTitle}
          scans={periodScans}
          selectedEmployeeName={selectedEmployee?.fullName}
        />
      </div>
    </main>
  );
}
