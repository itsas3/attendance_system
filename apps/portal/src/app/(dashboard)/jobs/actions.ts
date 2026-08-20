"use server";

import { getCurrentUser } from "../../../lib/session";
import { createPrismaClient } from "@attendance/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isHr } from "./permissions";
import type { ApplicationState, JobPostingState } from "./types";

const db = createPrismaClient(process.env.DATABASE_URL as string);

const MAX_CV_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_CV_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

const APPLICATION_STATUSES = ["SUBMITTED", "REVIEWED", "SHORTLISTED", "REJECTED", "HIRED"] as const;

export async function createJobPosting(
  prevState: JobPostingState,
  formData: FormData
): Promise<JobPostingState> {
  const user = await getCurrentUser();

  if (!isHr(user)) {
    return { error: "Unauthorized: Only HR can create job postings." };
  }

  const title = (formData.get("title") as string)?.trim();
  const department = (formData.get("department") as string)?.trim();
  const location = (formData.get("location") as string)?.trim();
  const employmentType = (formData.get("employmentType") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();

  if (!title) {
    return { error: "Job title is required." };
  }

  if (!description) {
    return { error: "Job description is required." };
  }

  const job = await db.jobPosting.create({
    data: {
      organizationId: user!.organizationId,
      title,
      department: department || null,
      location: location || null,
      employmentType: employmentType || null,
      description,
      createdById: user!.userAccountId
    }
  });

  revalidatePath("/jobs");
  revalidatePath("/");

  redirect(`/jobs/${job.id}/application-steps`);
}

export async function setJobPostingStatus(formData: FormData) {
  const user = await getCurrentUser();

  if (!isHr(user)) {
    throw new Error("Unauthorized");
  }

  const id = formData.get("id") as string;
  const status = formData.get("status") as string;

  if (!id || (status !== "OPEN" && status !== "CLOSED")) {
    return;
  }

  await db.jobPosting.update({
    where: { id, organizationId: user!.organizationId },
    data: { status }
  });

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${id}`);
  revalidatePath(`/jobs/${id}/applications`);
}

export async function deleteJobPosting(formData: FormData) {
  const user = await getCurrentUser();

  if (!isHr(user)) {
    throw new Error("Unauthorized");
  }

  const id = formData.get("id") as string;
  if (!id) return;

  await db.jobPosting.delete({ where: { id, organizationId: user!.organizationId } });

  revalidatePath("/jobs");
}

export async function submitApplication(
  prevState: ApplicationState,
  formData: FormData
): Promise<ApplicationState> {
  const jobPostingId = formData.get("jobPostingId") as string;
  const fullName = (formData.get("fullName") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const cv = formData.get("cv");

  if (!jobPostingId) {
    return { error: "Missing job posting reference." };
  }

  if (!fullName) {
    return { error: "Full name is required." };
  }

  if (!phone) {
    return { error: "Phone number is required." };
  }

  if (!email || !email.includes("@")) {
    return { error: "A valid email address is required." };
  }

  if (!(cv instanceof File) || cv.size === 0) {
    return { error: "Please attach your CV." };
  }

  if (!ALLOWED_CV_TYPES.has(cv.type)) {
    return { error: "CV must be a PDF or Word document (.pdf, .doc, or .docx)." };
  }

  if (cv.size > MAX_CV_SIZE_BYTES) {
    return { error: "CV file must be smaller than 5MB." };
  }

  const job = await db.jobPosting.findUnique({
    where: { id: jobPostingId },
    include: { steps: { orderBy: { order: "asc" } } }
  });

  if (!job) {
    return { error: "This job posting no longer exists." };
  }

  if (job.status !== "OPEN") {
    return { error: "This job posting is no longer accepting applications." };
  }

  // Validate and build a response row for every step attached to this job.
  const stepResponses: {
    stepId: string;
    type: "EMAIL_CV" | "QUESTIONNAIRE" | "INTERVIEW";
    answer?: object;
    interviewerId?: string;
    scheduledAt?: Date;
  }[] = [];

  for (const step of job.steps) {
    if (step.type === "EMAIL_CV") {
      const acknowledged = formData.get(`ack_${step.id}`);
      if (!acknowledged) {
        return { error: "Please confirm every required step before submitting." };
      }
      stepResponses.push({ stepId: step.id, type: "EMAIL_CV", answer: { acknowledged: true } });
    } else if (step.type === "QUESTIONNAIRE") {
      const config = step.config as {
        questions: { id: string; prompt: string; type: string }[];
      } | null;
      const questions = config?.questions ?? [];
      const answers: { questionId: string; value: string[] }[] = [];

      for (const question of questions) {
        const values = formData
          .getAll(`q_${step.id}_${question.id}`)
          .map((v) => String(v).trim())
          .filter(Boolean);
        if (values.length === 0) {
          return { error: `Please answer: "${question.prompt}"` };
        }
        answers.push({ questionId: question.id, value: values });
      }

      stepResponses.push({ stepId: step.id, type: "QUESTIONNAIRE", answer: { answers } });
    } else if (step.type === "INTERVIEW") {
      const dateStr = formData.get(`interview_${step.id}_date`) as string;
      const timeStr = formData.get(`interview_${step.id}_time`) as string;

      if (!dateStr || !timeStr) {
        return { error: "Please choose an interview date and time." };
      }

      const scheduledAt = new Date(`${dateStr}T${timeStr}:00`);

      if (Number.isNaN(scheduledAt.getTime())) {
        return { error: "Please choose a valid interview date and time." };
      }

      stepResponses.push({
        stepId: step.id,
        type: "INTERVIEW",
        interviewerId: step.interviewerId ?? undefined,
        scheduledAt
      });
    }
  }

  const buffer = Buffer.from(await cv.arrayBuffer());

  try {
    await db.$transaction(async (tx) => {
      const application = await tx.jobApplication.create({
        data: {
          jobPostingId,
          fullName,
          phone,
          email,
          cvFileName: cv.name || "cv",
          cvFileType: cv.type || "application/octet-stream",
          cvFileSize: cv.size,
          cvFileData: buffer
        }
      });

      for (const response of stepResponses) {
        await tx.jobApplicationStepResponse.create({
          data: {
            applicationId: application.id,
            stepId: response.stepId,
            type: response.type,
            answer: response.answer ? JSON.parse(JSON.stringify(response.answer)) : undefined,
            interviewerId: response.interviewerId,
            scheduledAt: response.scheduledAt
          }
        });
      }
    });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2002") {
      return {
        error:
          "One of the interview slots you selected was just booked by someone else. Please go back and choose a different time."
      };
    }
    return { error: "Something went wrong while submitting your application. Please try again." };
  }

  revalidatePath(`/jobs/${jobPostingId}/applications`);

  return { success: "Your application has been submitted. Thank you for applying!" };
}

export async function updateApplicationStatus(formData: FormData) {
  const user = await getCurrentUser();

  if (!isHr(user)) {
    throw new Error("Unauthorized");
  }

  const applicationId = formData.get("applicationId") as string;
  const jobPostingId = formData.get("jobPostingId") as string;
  const status = formData.get("status") as string;

  if (!applicationId || !(APPLICATION_STATUSES as readonly string[]).includes(status)) {
    return;
  }

  const application = await db.jobApplication.findFirst({
    where: {
      id: applicationId,
      jobPostingId,
      jobPosting: { organizationId: user!.organizationId }
    }
  });

  if (!application) return;

  await db.jobApplication.update({
    where: { id: applicationId },
    data: { status: status as (typeof APPLICATION_STATUSES)[number] }
  });

  revalidatePath(`/jobs/${jobPostingId}/applications`);
}
