"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "../../../lib/session";
import { createPrismaClient } from "@attendance/db";
import {
  currentReportingLineWhere,
  employmentAccessInclude,
  getEmploymentName,
  getEmploymentRoleKey
} from "../../../lib/employment";
import { hasPermission } from "../../../lib/rbac";

const db = createPrismaClient(process.env.DATABASE_URL as string);

export async function addEmployeeNote(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  const employeeId = formData.get("employeeId") as string;
  const content = formData.get("content") as string;
  const visibility = (formData.get("visibility") as "PUBLIC" | "PRIVATE") || "PRIVATE";

  if (!employeeId || !content || !content.trim()) {
    throw new Error("Employee ID and note content are required.");
  }

  const companyWide = hasPermission(user, "company_attendance");
  const targetEmployment = await db.employment.findFirst({
    where: companyWide
      ? { id: employeeId, organizationId: user.organizationId }
      : {
          id: employeeId,
          organizationId: user.organizationId,
          subordinateLines: {
            some: {
              supervisorEmploymentId: user.employeeId,
              ...currentReportingLineWhere()
            }
          }
        }
  });

  if (!targetEmployment) {
    throw new Error("Unauthorized or employee not found.");
  }

  await db.employeeNote.create({
    data: {
      employeeId,
      authorId: user.employeeId,
      content: content.trim(),
      visibility
    }
  });

  revalidatePath("/team-attendance");
  return { success: true };
}

export async function getEmployeeNotes(employeeId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return [];
  }

  const notes = await db.employeeNote.findMany({
    where: {
      employeeId,
      OR: [{ visibility: "PUBLIC" }, { authorId: user.employeeId }]
    },
    include: {
      author: {
        include: employmentAccessInclude()
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return notes.map((n) => ({
    id: n.id,
    content: n.content,
    visibility: n.visibility,
    createdAt: n.createdAt.toISOString(),
    authorName: getEmploymentName(n.author),
    authorRole: getEmploymentRoleKey(n.author),
    isOwn: n.authorId === user.employeeId
  }));
}

export async function submitPerformanceEvaluation(data: {
  templateId: string;
  employeeId: string;
  responses: Record<string, string | number>;
  comments?: string;
}) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  const { templateId, employeeId, responses, comments } = data;

  if (!templateId || !employeeId || !responses) {
    throw new Error("Missing required evaluation details.");
  }

  // Verify template is active
  const template = await db.performanceTemplate.findFirst({
    where: { id: templateId, organizationId: user.organizationId }
  });

  if (!template) {
    throw new Error("Performance template not found.");
  }

  const now = new Date();
  if (now < new Date(template.startDate) || now > new Date(template.endDate)) {
    throw new Error("Performance evaluation window is not active.");
  }

  // Compute overall score if ratings/numeric responses are provided
  let numericSum = 0;
  let numericCount = 0;
  for (const val of Object.values(responses)) {
    const num = Number(val);
    if (!isNaN(num) && num > 0) {
      numericSum += num;
      numericCount++;
    }
  }

  const overallScore = numericCount > 0 ? Number((numericSum / numericCount).toFixed(2)) : null;

  await db.performanceEvaluation.upsert({
    where: {
      templateId_employeeId_evaluatorId: {
        templateId,
        employeeId,
        evaluatorId: user.employeeId
      }
    },
    create: {
      templateId,
      employeeId,
      evaluatorId: user.employeeId,
      responses,
      overallScore,
      comments: comments || null
    },
    update: {
      responses,
      overallScore,
      comments: comments || null,
      submittedAt: new Date()
    }
  });

  revalidatePath("/team-attendance");
  revalidatePath("/performance");
  return { success: true };
}
