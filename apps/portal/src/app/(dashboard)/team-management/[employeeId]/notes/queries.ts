import { createPrismaClient } from "@attendance/db";
import { getEmployeeNotes } from "../../../team-attendance/actions";
import {
  currentReportingLineWhere,
  employmentAccessInclude,
  getEmploymentEmail,
  getEmploymentName,
  getEmploymentRoleKey
} from "../../../../../lib/employment";

const db = createPrismaClient(process.env.DATABASE_URL as string);

export async function getNotesHistoryData(
  employeeId: string,
  organizationId: string,
  viewerEmployeeId?: string,
  companyWide: boolean = false
) {
  const where = companyWide
    ? { id: employeeId, organizationId }
    : {
        id: employeeId,
        organizationId,
        subordinateLines: {
          some: {
            supervisorEmploymentId: viewerEmployeeId,
            ...currentReportingLineWhere()
          }
        }
      };

  const employment = await db.employment.findFirst({
    where,
    include: employmentAccessInclude()
  });

  if (!employment) {
    return { employee: null, notes: [] };
  }

  const notes = await getEmployeeNotes(employeeId);
  const employee = {
    id: employment.id,
    fullName: getEmploymentName(employment),
    email: getEmploymentEmail(employment),
    employeeCode: employment.employeeCode,
    role: { name: getEmploymentRoleKey(employment) }
  };
  return { employee, notes };
}
