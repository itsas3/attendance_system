import { getCurrentUser } from "../../../lib/session";
import { JobPostingsGrid } from "./_components/job-postings-grid";
import { JobsHeader } from "./_components/jobs-header";
import { isHr } from "./permissions";
import { getJobPostings } from "./queries";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const user = await getCurrentUser();
  const userIsHr = isHr(user);
  const jobs = await getJobPostings(user?.organizationId, userIsHr);
  return (
    <main className="app-shell">
      <JobsHeader signedIn={Boolean(user)} isHr={userIsHr} />
      <JobPostingsGrid jobs={jobs} isHr={userIsHr} />
    </main>
  );
}
