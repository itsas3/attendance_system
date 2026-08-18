import { createPrismaClient } from "@attendance/db";

const db = createPrismaClient(process.env.DATABASE_URL as string);

export async function getAnnouncements(organizationId: string) {
  const announcements = await db.announcement.findMany({
    where: { organizationId },
    include: {
      createdBy: { include: { person: { select: { legalName: true, preferredName: true } } } }
    },
    orderBy: { createdAt: "desc" }
  });
  return announcements.map((announcement) => ({
    ...announcement,
    createdBy: {
      fullName:
        announcement.createdBy.person.preferredName ?? announcement.createdBy.person.legalName
    }
  }));
}

export function markAnnouncementsViewed(employeeId: string) {
  return db.employment.update({
    where: { id: employeeId },
    data: { lastAnnouncementsViewedAt: new Date() }
  });
}
