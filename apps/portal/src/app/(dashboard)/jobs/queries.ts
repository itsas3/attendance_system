import { createPrismaClient } from "@attendance/db";

const db = createPrismaClient(process.env.DATABASE_URL as string);

export function getJobPostings(organizationId: string | undefined, includeClosed: boolean) {
  const orgFilter = organizationId ? { organizationId } : {};
  return db.jobPosting.findMany({
    where: includeClosed ? orgFilter : { ...orgFilter, status: "OPEN" },
    include: { _count: { select: { applications: true } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }]
  });
}
