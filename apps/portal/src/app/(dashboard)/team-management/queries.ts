import { createPrismaClient } from "@attendance/db";
import type {
  ActivePerformanceTemplate,
  PerformanceTemplateField,
  TeamMemberSummary
} from "./types";
import {
  currentReportingLineWhere,
  employmentAccessInclude,
  getEmploymentEmail,
  getEmploymentName,
  getEmploymentRoleKey
} from "../../../lib/employment";

const db = createPrismaClient(process.env.DATABASE_URL as string);

export async function getTeamManagementData(
  employeeId: string,
  companyWide: boolean,
  organizationId: string
): Promise<{ members: TeamMemberSummary[]; activeTemplate: ActivePerformanceTemplate | null }> {
  const employees = await db.employment.findMany({
    where: companyWide
      ? { organizationId, status: "ACTIVE" }
      : {
          organizationId,
          status: "ACTIVE",
          subordinateLines: {
            some: {
              supervisorEmploymentId: employeeId,
              ...currentReportingLineWhere()
            }
          }
        },
    include: employmentAccessInclude(),
    orderBy: { employeeCode: "asc" }
  });
  const now = new Date();
  const template = await db.performanceTemplate.findFirst({
    where: { organizationId, startDate: { lte: now }, endDate: { gte: now } },
    orderBy: { createdAt: "desc" }
  });
  const members = employees.map((employee) => ({
    id: employee.id,
    fullName: getEmploymentName(employee),
    email: getEmploymentEmail(employee),
    employeeCode: employee.employeeCode,
    roleName: getEmploymentRoleKey(employee)
  }));
  const activeTemplate = template
    ? {
        id: template.id,
        title: template.title,
        description: template.description,
        fields: template.fields as unknown as PerformanceTemplateField[],
        startDate: template.startDate.toISOString(),
        endDate: template.endDate.toISOString()
      }
    : null;
  return { members, activeTemplate };
}
