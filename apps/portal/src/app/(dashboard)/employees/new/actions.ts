"use server";

import { createPrismaClient } from "@attendance/db";
import { hashSync } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "../../../../lib/session";
import { parseCreateEmployeeForm, validateCreateEmployeeInput } from "../_lib/employee-form";
import { canCreateEmployees } from "../permissions";
import type { CreateEmployeeInput, CreateEmployeeState } from "../types";

const db = createPrismaClient(process.env.DATABASE_URL as string);

async function getEmployeeConflict(
  organizationId: string,
  input: CreateEmployeeInput
): Promise<string | null> {
  if (input.grantDashboardAccess) {
    const existingEmail = await db.userAccount.findUnique({ where: { loginEmail: input.email } });
    if (existingEmail) return `An account with the email "${input.email}" already exists.`;
  }

  if (input.employeeCode) {
    const existingCode = await db.employment.findUnique({
      where: {
        organizationId_employeeCode: { organizationId, employeeCode: input.employeeCode }
      }
    });
    if (existingCode) return `Employee code "${input.employeeCode}" is already in use.`;
  }

  return null;
}

export async function createEmployee(
  _previousState: CreateEmployeeState,
  formData: FormData
): Promise<CreateEmployeeState> {
  const user = await getCurrentUser();
  if (!user || !canCreateEmployees(user)) {
    return { error: "Unauthorized: You do not have permission to enroll employees." };
  }

  const input = parseCreateEmployeeForm(formData);
  const validationError = validateCreateEmployeeInput(input);
  if (validationError) return { error: validationError };

  const conflict = await getEmployeeConflict(user.organizationId, input);
  if (conflict) return { error: conflict };

  const [unit, position] = await Promise.all([
    db.organizationUnit.findFirst({
      where: { id: input.organizationUnitId, organizationId: user.organizationId, isActive: true }
    }),
    db.position.findFirst({
      where: { id: input.positionId, organizationId: user.organizationId, isActive: true }
    })
  ]);
  if (!unit || !position) return { error: "The selected unit or position is not available." };

  await db.$transaction(async (tx) => {
    const person = await tx.person.create({
      data: {
        legalName: input.fullName,
        personalEmail: input.email || null,
        userAccount: input.grantDashboardAccess
          ? {
              create: {
                loginEmail: input.email,
                passwordHash: hashSync(input.password, 10),
                status: "ACTIVE"
              }
            }
          : undefined
      }
    });

    const membership = await tx.organizationMembership.create({
      data: {
        organizationId: user.organizationId,
        personId: person.id,
        status: "ACTIVE",
        joinedAt: new Date()
      }
    });

    const employment = await tx.employment.create({
      data: {
        organizationId: user.organizationId,
        membershipId: membership.id,
        employeeCode: input.employeeCode || null,
        status: "ACTIVE",
        type: "PERMANENT",
        hiredAt: new Date()
      }
    });

    await tx.employmentAssignment.create({
      data: {
        employmentId: employment.id,
        organizationUnitId: unit.id,
        positionId: position.id,
        type: "PRIMARY",
        validFrom: new Date(),
        timezone: input.timezone
      }
    });

    if (input.supervisorId) {
      const supervisor = await tx.employment.findFirst({
        where: { id: input.supervisorId, organizationId: user.organizationId, status: "ACTIVE" }
      });
      if (supervisor) {
        await tx.reportingLine.create({
          data: {
            subordinateEmploymentId: employment.id,
            supervisorEmploymentId: supervisor.id,
            validFrom: new Date()
          }
        });
      }
    }

    const shift = await tx.shift.create({
      data: {
        organizationId: user.organizationId,
        name: `${input.fullName} default shift`,
        timezone: input.timezone,
        startTime: input.shiftInTime,
        endTime: input.shiftOutTime,
        workdays: [1, 2, 3, 4, 5]
      }
    });
    await tx.shiftAssignment.create({
      data: { employeeId: employment.id, shiftId: shift.id, effectiveFrom: new Date() }
    });
  });

  revalidatePath("/employees");
  return {
    success: `New employee "${input.fullName}"${input.email ? ` (${input.email})` : ""} created successfully!`
  };
}
