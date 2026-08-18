"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "../../../lib/session";
import { createPrismaClient, type Prisma } from "@attendance/db";

const db = createPrismaClient(process.env.DATABASE_URL as string);

export interface FieldDefinition {
  id: string;
  label: string;
  type: "rating" | "text" | "number" | "select";
  options?: string[];
  required?: boolean;
}

export async function createPerformanceTemplate(data: {
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  fields: FieldDefinition[];
}) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  const normRole = user.roleName?.toLowerCase();
  if (!["hr", "owner", "admin"].includes(normRole)) {
    throw new Error("Only HR, Owner, or Admin can define employee performance documents.");
  }

  const { title, description, startDate, endDate, fields } = data;

  if (!title || !title.trim()) {
    throw new Error("Document title is required.");
  }

  if (!startDate || !endDate) {
    throw new Error("Start date and end date are required.");
  }

  if (!fields || fields.length === 0) {
    throw new Error("At least one form field must be defined.");
  }

  const template = await db.performanceTemplate.create({
    data: {
      organizationId: user.organizationId,
      title: title.trim(),
      description: description?.trim() || null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      fields: fields as unknown as Prisma.InputJsonValue,
      createdById: user.userAccountId
    }
  });

  revalidatePath("/performance");
  revalidatePath("/team-attendance");

  return { success: true, id: template.id };
}

export async function deletePerformanceTemplate(id: string) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  const normRole = user.roleName?.toLowerCase();
  if (!["hr", "owner", "admin"].includes(normRole)) {
    throw new Error("Unauthorized");
  }

  await db.performanceTemplate.delete({
    where: { id, organizationId: user.organizationId }
  });

  revalidatePath("/performance");
  revalidatePath("/team-attendance");

  return { success: true };
}
