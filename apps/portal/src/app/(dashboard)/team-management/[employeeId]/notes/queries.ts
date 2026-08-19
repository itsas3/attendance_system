import { createPrismaClient } from "@attendance/db";
import { getEmployeeNotes } from "../../../team-attendance/actions";
import {
  employmentAccessInclude,
  getEmploymentEmail,
  getEmploymentName,
  getEmploymentRoleKey
} from "../../../../../lib/employment";

const db = createPrismaClient(process.env.DATABASE_URL as string);

export async function getNotesHistoryData(employeeId: string, organizationId: string) {
  const [employment, notes] = await Promise.all([
    db.employment.findFirst({
      where: { id: employeeId, organizationId },
      include: employmentAccessInclude()
    }),
    getEmployeeNotes(employeeId)
  ]);
  const employee = employment
    ? {
        id: employment.id,
        fullName: getEmploymentName(employment),
        email: getEmploymentEmail(employment),
        employeeCode: employment.employeeCode,
        role: { name: getEmploymentRoleKey(employment) }
      }
    : null;
  return { employee, notes };
}
