"use server";

import { getCurrentUser } from "../../../lib/session";
import { createPrismaClient } from "@attendance/db";
import { revalidatePath } from "next/cache";
import { canManageAnnouncements } from "./permissions";
import type { AnnouncementActionState } from "./types";

const db = createPrismaClient(process.env.DATABASE_URL as string);

export async function createAnnouncement(
  _prevState: AnnouncementActionState,
  formData: FormData
): Promise<AnnouncementActionState> {
  const user = await getCurrentUser();

  if (!canManageAnnouncements(user)) {
    return { error: "Unauthorized: Only HR can post announcements." };
  }

  const title = (formData.get("title") as string)?.trim();
  const content = (formData.get("content") as string)?.trim();

  if (!title) {
    return { error: "Announcement title is required." };
  }

  if (!content) {
    return { error: "Announcement content is required." };
  }

  await db.announcement.create({
    data: {
      organizationId: user!.organizationId,
      title,
      content,
      createdById: user!.userAccountId
    }
  });

  revalidatePath("/announcements");
  revalidatePath("/");

  return { success: `Announcement "${title}" has been posted.` };
}

export async function deleteAnnouncement(formData: FormData) {
  const user = await getCurrentUser();

  if (!canManageAnnouncements(user)) {
    throw new Error("Unauthorized");
  }

  const id = formData.get("id") as string;
  if (!id) return;

  await db.announcement.delete({ where: { id, organizationId: user!.organizationId } });

  revalidatePath("/announcements");
  revalidatePath("/");
}
